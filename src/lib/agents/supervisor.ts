/**
 * Supervisor agent for AgenLens.
 *
 * The supervisor is the top-level orchestrator that receives user requests,
 * decomposes them into sub-tasks, delegates to specialized sub-agents,
 * and synthesizes their results into a coherent response.
 *
 * Architecture:
 * - User sends a natural language request via the chat interface
 * - Supervisor analyzes the request and determines which sub-agents are needed
 * - Each sub-agent is invoked with its own scoped tools (all routed through the proxy)
 * - Supervisor collects results and produces a final response
 *
 * The supervisor itself never calls external APIs directly.
 */

import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import {
  listCalendarEvents,
  getCalendarEvent,
  createCalendarEvent,
  searchEmails,
  readEmail,
  sendEmail,
  listPullRequests,
  listIssues,
  createIssue,
  getRepository,
  searchSlackMessages,
  listSlackChannels,
  postSlackMessage,
  searchDriveFiles,
  getDriveFile,
} from "@/lib/agents/tools";

/** LLM instance shared across agent nodes. */
const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

/** System prompt for the supervisor that controls task decomposition. */
const SUPERVISOR_SYSTEM_PROMPT = `You are the AgenLens Supervisor Agent. You orchestrate specialized sub-agents to help users manage their work across Google Calendar, Gmail, GitHub, Slack, and Google Drive.

Your role:
1. Analyze the user's request and determine which sub-agents are needed.
2. Delegate specific sub-tasks to the appropriate sub-agents using the available tools.
3. Synthesize results from all sub-agents into a clear, helpful response.

Available sub-agents and their capabilities:
- Calendar Agent: Read calendar events, check availability, create events (needs approval)
- Email Agent: Search and read Gmail messages, send emails (needs approval)
- GitHub Agent: Read repos, PRs, issues, create issues (needs approval)
- Slack Agent: Search messages, list channels, post messages (needs approval)
- Drive Agent: Search and read file metadata from Google Drive

Important rules:
- Only use the sub-agents that are relevant to the user's request.
- Write operations (creating events, sending emails, posting messages, creating issues) require user approval via step-up authentication. Inform the user when an approval is needed.
- If a sub-agent's request is blocked by a policy, explain what happened and suggest alternatives.
- Always synthesize results into a clear narrative. Don't dump raw API data.
- If you're unsure what the user wants, ask for clarification.`;

/** Tools grouped by sub-agent for clear organization. */
const ALL_TOOLS = [
  // Calendar
  listCalendarEvents,
  getCalendarEvent,
  createCalendarEvent,
  // Email
  searchEmails,
  readEmail,
  sendEmail,
  // GitHub
  listPullRequests,
  listIssues,
  createIssue,
  getRepository,
  // Slack
  searchSlackMessages,
  listSlackChannels,
  postSlackMessage,
  // Drive
  searchDriveFiles,
  getDriveFile,
];

/**
 * Builds the LangGraph state graph for the supervisor agent.
 *
 * The graph has two nodes:
 * - "supervisor": The LLM node that reasons about the request and invokes tools
 * - "tools": Executes the tool calls made by the supervisor
 *
 * The graph loops between supervisor and tools until the supervisor
 * produces a final response without tool calls.
 *
 * @returns Compiled LangGraph runnable
 */
export function buildSupervisorGraph() {
  const llmWithTools = llm.bindTools(ALL_TOOLS);

  /**
   * Supervisor node: processes the current state and decides
   * whether to invoke tools or produce a final response.
   */
  async function supervisorNode(
    state: typeof MessagesAnnotation.State
  ): Promise<{ messages: BaseMessage[] }> {
    const messages = [
      new SystemMessage(SUPERVISOR_SYSTEM_PROMPT),
      ...state.messages,
    ];

    const response = await llmWithTools.invoke(messages);
    return { messages: [response] };
  }

  /**
   * Tools node: executes all tool calls from the supervisor's response.
   * Each tool call routes through the AgenLens proxy.
   */
  async function toolsNode(
    state: typeof MessagesAnnotation.State
  ): Promise<{ messages: BaseMessage[] }> {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls =
      "tool_calls" in lastMessage
        ? (lastMessage.tool_calls as Array<{
            id?: string;
            name: string;
            args: Record<string, unknown>;
          }>)
        : [];

    if (toolCalls.length === 0) {
      return { messages: [] };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolMap = new Map<string, (typeof ALL_TOOLS)[number]>(ALL_TOOLS.map((t) => [t.name, t] as any));
    const results: BaseMessage[] = [];

    for (const toolCall of toolCalls) {
      const selectedTool = toolMap.get(toolCall.name);

      if (!selectedTool) {
        const { ToolMessage } = await import("@langchain/core/messages");
        results.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
          })
        );
        continue;
      }

      try {
        // Cast needed because the union of all tool types makes invoke non-callable.
        const invokable = selectedTool as { invoke: (args: unknown, config?: unknown) => Promise<unknown> };
        const result = await invokable.invoke(toolCall.args, {
          configurable: state.messages[0]
            ? ((state.messages[0] as HumanMessage).additional_kwargs
                ?.configurable as Record<string, unknown>)
            : {},
        });

        const { ToolMessage } = await import("@langchain/core/messages");
        results.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: typeof result === "string" ? result : JSON.stringify(result),
          })
        );
      } catch (error) {
        const { ToolMessage } = await import("@langchain/core/messages");
        results.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: JSON.stringify({
              error: error instanceof Error ? error.message : "Tool execution failed",
            }),
          })
        );
      }
    }

    return { messages: results };
  }

  /**
   * Routing function: determines whether to continue tool execution
   * or end the conversation.
   */
  function shouldContinue(
    state: typeof MessagesAnnotation.State
  ): "tools" | typeof END {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls =
      "tool_calls" in lastMessage
        ? (lastMessage.tool_calls as Array<unknown>)
        : [];

    if (toolCalls.length > 0) {
      return "tools";
    }

    return END;
  }

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("supervisor", supervisorNode)
    .addNode("tools", toolsNode)
    .addEdge("__start__", "supervisor")
    .addConditionalEdges("supervisor", shouldContinue, {
      tools: "tools",
      [END]: END,
    })
    .addEdge("tools", "supervisor");

  return graph.compile();
}

/**
 * Invokes the supervisor agent with a user message.
 *
 * This is the main entry point for the chat interface. It creates a new
 * graph invocation with the user's message and agent configuration.
 *
 * @param userMessage - The user's natural language request
 * @param config - Session, request, and auth configuration for the proxy
 * @returns The supervisor's final response text
 */
export async function invokeSupervisor(
  userMessage: string,
  config: {
    sessionId: string;
    requestId: string;
    userId: string;
    userAccessToken: string;
  }
): Promise<string> {
  const graph = buildSupervisorGraph();

  const result = await graph.invoke({
    messages: [
      new HumanMessage({
        content: userMessage,
        additional_kwargs: {
          configurable: config,
        },
      }),
    ],
  });

  const lastMessage = result.messages[result.messages.length - 1];
  return typeof lastMessage.content === "string"
    ? lastMessage.content
    : JSON.stringify(lastMessage.content);
}
