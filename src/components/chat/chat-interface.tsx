/**
 * Chat interface component for interacting with the supervisor agent.
 *
 * Provides a message input and conversation view. Messages are sent to
 * the supervisor agent API, which orchestrates sub-agents and returns
 * synthesized responses. Messages are persisted to the database.
 */

"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { Send, Bot, User, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { ApprovalPrompt } from "@/components/approval-prompt";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  requestId?: string;
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Starts a fresh conversation by clearing state and generating a new sessionId. */
  const startNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
  };

  /** Loads the most recent chat session from the database. */
  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/messages");
      if (!response.ok) return;

      const json = await response.json();
      if (json.data && json.data.length > 0) {
        setSessionId(json.sessionId || null);
        setMessages(
          json.data.map((m: { id: string; role: string; content: string; requestId?: string; createdAt: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            requestId: m.requestId || undefined,
            timestamp: new Date(m.createdAt),
          }))
        );
      }
    } catch {
      // Silently fail on load.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Saves a message to the database. */
  const saveMessage = async (msg: { sessionId: string; role: string; content: string; requestId?: string }) => {
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
    } catch {
      // Silently fail on save.
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
        }),
      });

      const json = await response.json();

      if (response.ok) {
        const activeSessionId = json.data.sessionId || sessionId;
        if (activeSessionId) {
          setSessionId(activeSessionId);
        }

        // Save user message.
        await saveMessage({
          sessionId: activeSessionId,
          role: "user",
          content: userMessage.content,
        });

        let content = json.data.response;

        // Detect token expiry in the agent's response.
        const tokenExpired = /token.*(expired|invalid)|authentication credentials|not.*authorized|session.*expired/i.test(content);
        if (tokenExpired) {
          content += "\n\n---\nYour connection token may have expired. [Click here to reconnect your Google account](/api/connect?connection=google-oauth2).";
        }

        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content,
          requestId: json.data.requestId,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Save assistant message.
        await saveMessage({
          sessionId: activeSessionId,
          role: "assistant",
          content,
          requestId: json.data.requestId,
        });
      } else if (response.status === 401) {
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content: "Your session has expired. Please sign in again to continue.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setTimeout(() => { window.location.href = "/auth/login"; }, 3000);
      } else {
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content: `Error: ${json.error || "Something went wrong. Please try again."}`,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: "assistant",
        content:
          "Failed to reach the agent. Please check your connection and try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* New Chat button - shown when there are messages */}
      {messages.length > 0 && (
        <div className="flex justify-end border-b border-[var(--border)] px-4 py-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={startNewChat} disabled={isLoading}>
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-[var(--muted-foreground)]">
            <Bot className="mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
              AgenLens Supervisor
            </h3>
            <p className="mb-4 max-w-md text-center text-sm">
              I can help you manage your work across Google Calendar, Gmail,
              GitHub, Slack, and Google Drive. All actions are proxied, logged,
              and policy-controlled.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Prep me for my next meeting",
                "Summarize this week on GitHub",
                "Find recent emails from my team",
                "Search Slack for project updates",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--accent)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}

            <Card
              className={`max-w-[70%] px-4 py-3 ${
                message.role === "user"
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--secondary)]"
              }`}
            >
              <MessageContent text={message.content} />
              {message.requestId && (
                <a
                  href={`/dashboard/activity/${message.requestId}`}
                  className="mt-2 block text-xs text-[var(--muted-foreground)] hover:underline"
                >
                  View agent activity for this request
                </a>
              )}
            </Card>

            {message.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)]">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <>
            <ApprovalPrompt mode="inline" />
            <div className="mb-4 flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <Card className="bg-[var(--secondary)] px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Orchestrating sub-agents...
                </div>
              </Card>
            </div>
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border)] p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the supervisor agent..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Renders message text with full markdown formatting. */
function MessageContent({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-lg font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold">{children}</h3>,
          p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-[var(--foreground)]">{children}</strong>,
          em: ({ children }) => <em className="italic text-[var(--muted-foreground)]">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--primary)] underline hover:opacity-80">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <pre className="my-2 overflow-x-auto rounded-lg bg-[var(--background)] p-3 text-xs">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-[var(--background)] px-1.5 py-0.5 text-xs font-mono">
                {children}
              </code>
            );
          },
          hr: () => <hr className="my-3 border-[var(--border)]" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-[var(--primary)] pl-3 text-[var(--muted-foreground)]">
              {children}
            </blockquote>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
