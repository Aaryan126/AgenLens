/**
 * Chat interface component for interacting with the supervisor agent.
 *
 * Provides a message input and conversation view. Messages are sent to
 * the supervisor agent API, which orchestrates sub-agents and returns
 * synthesized responses. Messages are persisted to the database.
 */

"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { Send, Bot, User, Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const inputRef = useRef<HTMLInputElement>(null);

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

        await saveMessage({
          sessionId: activeSessionId,
          role: "user",
          content: userMessage.content,
        });

        let content = json.data.response;

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
        content: "Failed to reach the agent. Please check your connection and try again.",
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
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">Loading conversation...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold">Agent Chat</h1>
          <span className="text-xs text-[var(--muted-foreground)]">
            All actions are proxied, logged, and policy-controlled
          </span>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-[var(--muted-foreground)]" onClick={startNewChat} disabled={isLoading}>
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
              <Sparkles className="h-6 w-6 text-[var(--primary)]" />
            </div>
            <h3 className="mb-1 text-base font-semibold">
              AgenLens Supervisor
            </h3>
            <p className="mb-8 max-w-sm text-center text-[13px] leading-relaxed text-[var(--muted-foreground)]">
              I can help you manage your work across Calendar, Gmail,
              GitHub, and Drive. All actions are proxied and policy-controlled.
            </p>
            <div className="grid w-full max-w-lg grid-cols-2 gap-2.5">
              {[
                { text: "Prep me for my next meeting", icon: "calendar" },
                { text: "Summarize this week on GitHub", icon: "github" },
                { text: "Find recent emails from my team", icon: "email" },
                { text: "Search my Drive for recent docs", icon: "drive" },
              ].map((suggestion) => (
                <button
                  key={suggestion.text}
                  onClick={() => {
                    setInput(suggestion.text);
                    inputRef.current?.focus();
                  }}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left text-[13px] text-[var(--muted-foreground)] transition-colors hover:border-[var(--border)]/80 hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-5 flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10">
                    <Bot className="h-3.5 w-3.5 text-[var(--primary)]" />
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    message.role === "user"
                      ? "rounded-br-md bg-[var(--primary)] text-white"
                      : "rounded-bl-md bg-[var(--secondary)]"
                  }`}
                >
                  <MessageContent text={message.content} isUser={message.role === "user"} />
                  {message.requestId && (
                    <a
                      href={`/dashboard/activity/${message.requestId}`}
                      className="mt-1.5 block text-[11px] text-[var(--muted-foreground)] hover:underline"
                    >
                      View agent activity
                    </a>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)]">
                    <User className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <>
                <ApprovalPrompt mode="inline" />
                <div className="mb-5 flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10">
                    <Bot className="h-3.5 w-3.5 text-[var(--primary)]" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-[var(--secondary)] px-4 py-2.5">
                    <div className="flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Orchestrating sub-agents...
                    </div>
                  </div>
                </div>
              </>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area - pill style */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 transition-colors focus-within:border-[var(--primary)]/50"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the supervisor agent..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="h-8 w-8 shrink-0 rounded-xl"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Renders message text with full markdown formatting. */
function MessageContent({ text, isUser }: { text: string; isUser?: boolean }) {
  return (
    <div className={`prose prose-sm max-w-none text-[13px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${isUser ? "prose-invert" : "prose-invert"}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-3 text-sm font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2 text-[13px] font-semibold">{children}</h3>,
          p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic text-[var(--muted-foreground)]">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--primary)] underline decoration-[var(--primary)]/30 hover:decoration-[var(--primary)]">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
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
              <code className="rounded-md bg-[var(--background)]/50 px-1.5 py-0.5 text-xs font-mono">
                {children}
              </code>
            );
          },
          hr: () => <hr className="my-3 border-[var(--border)]" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-[var(--primary)]/30 pl-3 text-[var(--muted-foreground)]">
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
