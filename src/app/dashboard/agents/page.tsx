/**
 * Agent management page.
 * Displays detailed cards for all sub-agents with their permissions,
 * connections, and activity counts.
 */

import { AgentCardsGrid } from "@/components/dashboard/agent-cards";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Management</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          View and control permissions for each sub-agent. Each agent gets scoped tokens from Auth0 Token Vault.
        </p>
      </div>

      <AgentCardsGrid />
    </div>
  );
}
