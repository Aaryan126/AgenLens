/**
 * LangGraph tool definitions for AgenLens sub-agents.
 *
 * Each tool represents an API action a sub-agent can perform. All tools
 * route through the AgenLens proxy - they never call external APIs directly.
 * The proxy handles token injection, policy enforcement, and logging.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

const PROXY_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Makes a request through the AgenLens proxy.
 * This is the only way sub-agents can reach external APIs.
 *
 * @param agentType - The sub-agent making the request
 * @param method - HTTP method
 * @param targetUrl - The external API URL to call
 * @param body - Request body (optional)
 * @param sessionId - Current session ID
 * @param requestId - Current request group ID
 * @param userId - The authenticated user's ID
 * @param userAccessToken - The user's Auth0 access token
 * @returns The proxied response
 */
async function callProxy(params: {
  agentType: string;
  method: string;
  targetUrl: string;
  body?: unknown;
  sessionId: string;
  requestId: string;
  userId: string;
  userAccessToken: string;
  providerTokens?: Record<string, string>;
}): Promise<unknown> {
  const response = await fetch(`${PROXY_BASE_URL}/api/proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentType: params.agentType,
      method: params.method,
      url: params.targetUrl,
      body: params.body,
      sessionId: params.sessionId,
      requestId: params.requestId,
      userId: params.userId,
      userAccessToken: params.userAccessToken,
      providerTokens: params.providerTokens,
    }),
  });

  return response.json();
}

// ---------------------------------------------------------------------------
// Calendar Agent Tools
// ---------------------------------------------------------------------------

/** Lists upcoming calendar events within a time range. */
export const listCalendarEvents = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const timeMin = input.timeMin || new Date().toISOString();
    const timeMax =
      input.timeMax ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=${input.maxResults || 10}&singleEvents=true&orderBy=startTime`;

    return JSON.stringify(
      await callProxy({
        agentType: "calendar",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "list_calendar_events",
    description:
      "List upcoming Google Calendar events. Use to check schedules, find meetings, and get event details including attendees and descriptions.",
    schema: z.object({
      timeMin: z.string().optional().describe("Start of time range (ISO 8601)"),
      timeMax: z.string().optional().describe("End of time range (ISO 8601)"),
      maxResults: z.number().optional().describe("Maximum events to return (default 10)"),
    }),
  }
);

/** Gets details of a specific calendar event by ID. */
export const getCalendarEvent = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}`;

    return JSON.stringify(
      await callProxy({
        agentType: "calendar",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "get_calendar_event",
    description: "Get details of a specific Google Calendar event by its ID.",
    schema: z.object({
      eventId: z.string().describe("The calendar event ID"),
    }),
  }
);

/** Creates a new calendar event (requires step-up auth). */
export const createCalendarEvent = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url =
      "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    return JSON.stringify(
      await callProxy({
        agentType: "calendar",
        method: "POST",
        targetUrl: url,
        body: {
          summary: input.summary,
          description: input.description,
          start: { dateTime: input.startTime, timeZone: input.timeZone },
          end: { dateTime: input.endTime, timeZone: input.timeZone },
          attendees: input.attendees?.map((email: string) => ({ email })),
        },
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "create_calendar_event",
    description:
      "Create a new Google Calendar event. This requires user approval via step-up authentication.",
    schema: z.object({
      summary: z.string().describe("Event title"),
      description: z.string().optional().describe("Event description"),
      startTime: z.string().describe("Start time (ISO 8601)"),
      endTime: z.string().describe("End time (ISO 8601)"),
      timeZone: z.string().optional().describe("Timezone (e.g., 'America/New_York')"),
      attendees: z.array(z.string()).optional().describe("Attendee email addresses"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Email Agent Tools
// ---------------------------------------------------------------------------

/** Searches Gmail messages matching a query. */
export const searchEmails = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(input.query)}&maxResults=${input.maxResults || 10}`;

    return JSON.stringify(
      await callProxy({
        agentType: "email",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "search_emails",
    description:
      "Search Gmail messages using Gmail search syntax (e.g., 'from:sarah subject:API redesign').",
    schema: z.object({
      query: z.string().describe("Gmail search query"),
      maxResults: z.number().optional().describe("Maximum results (default 10)"),
    }),
  }
);

/** Reads a specific email message by ID. */
export const readEmail = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://www.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(input.messageId)}?format=full`;

    return JSON.stringify(
      await callProxy({
        agentType: "email",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "read_email",
    description:
      "Read a specific Gmail message by ID. Returns the full message including headers and snippet.",
    schema: z.object({
      messageId: z.string().describe("The Gmail message ID"),
    }),
  }
);

/** Sends an email (requires step-up auth). */
export const sendEmail = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const rawEmail = [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "",
      input.body,
    ].join("\r\n");

    const encodedEmail = Buffer.from(rawEmail).toString("base64url");

    const url = "https://www.googleapis.com/gmail/v1/users/me/messages/send";

    return JSON.stringify(
      await callProxy({
        agentType: "email",
        method: "POST",
        targetUrl: url,
        body: { raw: encodedEmail },
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "send_email",
    description:
      "Send an email via Gmail. This requires user approval via step-up authentication.",
    schema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Email body text"),
    }),
  }
);

// ---------------------------------------------------------------------------
// GitHub Agent Tools
// ---------------------------------------------------------------------------

/** Lists pull requests for a repository. */
export const listPullRequests = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls?state=${input.state || "open"}&per_page=${input.perPage || 10}`;

    return JSON.stringify(
      await callProxy({
        agentType: "github",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "list_pull_requests",
    description: "List pull requests for a GitHub repository.",
    schema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      state: z.enum(["open", "closed", "all"]).optional().describe("PR state filter"),
      perPage: z.number().optional().describe("Results per page (default 10)"),
    }),
  }
);

/** Lists issues for a repository. */
export const listIssues = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues?state=${input.state || "open"}&per_page=${input.perPage || 10}`;

    return JSON.stringify(
      await callProxy({
        agentType: "github",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "list_issues",
    description: "List issues for a GitHub repository.",
    schema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      state: z.enum(["open", "closed", "all"]).optional().describe("Issue state filter"),
      perPage: z.number().optional().describe("Results per page (default 10)"),
    }),
  }
);

/** Creates a new GitHub issue (requires step-up auth). */
export const createIssue = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues`;

    return JSON.stringify(
      await callProxy({
        agentType: "github",
        method: "POST",
        targetUrl: url,
        body: {
          title: input.title,
          body: input.body,
          labels: input.labels,
        },
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "create_issue",
    description:
      "Create a new issue in a GitHub repository. This requires user approval.",
    schema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      title: z.string().describe("Issue title"),
      body: z.string().optional().describe("Issue body"),
      labels: z.array(z.string()).optional().describe("Labels to apply"),
    }),
  }
);

/** Gets repository details. */
export const getRepository = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;

    return JSON.stringify(
      await callProxy({
        agentType: "github",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "get_repository",
    description: "Get details about a GitHub repository.",
    schema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Slack Agent Tools
// ---------------------------------------------------------------------------

/** Searches Slack messages matching a query. */
export const searchSlackMessages = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://slack.com/api/search.messages?query=${encodeURIComponent(input.query)}&count=${input.count || 10}`;

    return JSON.stringify(
      await callProxy({
        agentType: "slack",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "search_slack_messages",
    description: "Search Slack messages across all channels the user has access to.",
    schema: z.object({
      query: z.string().describe("Search query"),
      count: z.number().optional().describe("Number of results (default 10)"),
    }),
  }
);

/** Lists Slack channels. */
export const listSlackChannels = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=${input.limit || 20}`;

    return JSON.stringify(
      await callProxy({
        agentType: "slack",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "list_slack_channels",
    description: "List Slack channels the user has access to.",
    schema: z.object({
      limit: z.number().optional().describe("Max channels to return (default 20)"),
    }),
  }
);

/** Posts a message to a Slack channel (requires step-up auth). */
export const postSlackMessage = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = "https://slack.com/api/chat.postMessage";

    return JSON.stringify(
      await callProxy({
        agentType: "slack",
        method: "POST",
        targetUrl: url,
        body: {
          channel: input.channel,
          text: input.text,
        },
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "post_slack_message",
    description:
      "Post a message to a Slack channel. This requires user approval via step-up authentication.",
    schema: z.object({
      channel: z.string().describe("Channel ID or name"),
      text: z.string().describe("Message text"),
    }),
  }
);

// ---------------------------------------------------------------------------
// Drive Agent Tools
// ---------------------------------------------------------------------------

/** Searches Google Drive files. */
export const searchDriveFiles = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(input.query)}&pageSize=${input.pageSize || 10}&fields=files(id,name,mimeType,modifiedTime,webViewLink,owners)`;

    return JSON.stringify(
      await callProxy({
        agentType: "drive",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "search_drive_files",
    description:
      "Search Google Drive files using Drive search syntax (e.g., \"name contains 'report'\").",
    schema: z.object({
      query: z.string().describe("Drive search query"),
      pageSize: z.number().optional().describe("Max results (default 10)"),
    }),
  }
);

/** Gets metadata for a specific Drive file. */
export const getDriveFile = tool(
  async (input, config) => {
    const { sessionId, requestId, userId, userAccessToken, providerTokens } =
      config?.configurable ?? {};

    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType,modifiedTime,webViewLink,owners,size,shared`;

    return JSON.stringify(
      await callProxy({
        agentType: "drive",
        method: "GET",
        targetUrl: url,
        sessionId,
        requestId,
        userId,
        userAccessToken,
        providerTokens,
      })
    );
  },
  {
    name: "get_drive_file",
    description: "Get metadata for a specific Google Drive file by ID.",
    schema: z.object({
      fileId: z.string().describe("The Drive file ID"),
    }),
  }
);
