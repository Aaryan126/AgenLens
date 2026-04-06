/**
 * Chat page for interacting with the supervisor agent.
 * Full-screen chat interface with sidebar navigation.
 * Redirects to login if the user is not authenticated.
 */

import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { auth0 } from "@/lib/auth0/client";

export default async function ChatPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="ml-60 flex flex-1 flex-col">
        <ChatInterface />
      </main>
    </div>
  );
}
