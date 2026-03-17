/**
 * Chat page for interacting with the supervisor agent.
 * Full-screen chat interface with sidebar navigation.
 */

import { Sidebar } from "@/components/dashboard/sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";

export default function ChatPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="ml-64 flex flex-1 flex-col">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <h1 className="text-lg font-semibold">Agent Chat</h1>
          <span className="ml-3 text-sm text-[var(--muted-foreground)]">
            All actions are proxied, logged, and policy-controlled
          </span>
        </div>
        <ChatInterface />
      </main>
    </div>
  );
}
