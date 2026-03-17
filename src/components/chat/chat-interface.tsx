/**
 * Chat interface component for interacting with the supervisor agent.
 *
 * Provides a message input and conversation view. Messages are sent to
 * the supervisor agent API, which orchestrates sub-agents and returns
 * synthesized responses. Inline indicators show which sub-agents are active.
 */

"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        if (json.data.sessionId) {
          setSessionId(json.data.sessionId);
        }

        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: json.data.response,
          requestId: json.data.requestId,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
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

  return (
    <div className="flex h-full flex-col">
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
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
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
