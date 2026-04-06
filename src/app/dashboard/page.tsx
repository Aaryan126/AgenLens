/**
 * Dashboard overview page.
 *
 * Shows key metrics from the database, the live activity feed,
 * and agent permission cards in a single view.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AgentCardsGrid } from "@/components/dashboard/agent-cards";
import { DelegationChain } from "@/components/dashboard/delegation-chain";
import { auth0 } from "@/lib/auth0/client";
import { db } from "@/lib/db";

export default async function DashboardOverview() {
  const session = await auth0.getSession();
  const userId = session?.user.sub;

  let totalActions = 0;
  let blockedActions = 0;
  let stepUpAuths = 0;
  let activeAgentCount = 0;

  if (userId) {
    const [total, blocked, stepUps, agents] = await Promise.all([
      db.agentActivity.count({ where: { userId } }),
      db.agentActivity.count({ where: { userId, policyResult: "blocked" } }),
      db.stepUpEvent.count({ where: { userId } }),
      db.agentActivity.groupBy({ by: ["agentType"], where: { userId } }),
    ]);
    totalActions = total;
    blockedActions = blocked;
    stepUpAuths = stepUps;
    activeAgentCount = agents.length;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-xs text-[var(--muted-foreground)]">
          Monitor and control your AI agents in real-time
        </p>
      </div>

      {/* Stats */}
      <StatsBar
        totalActions={totalActions}
        blockedActions={blockedActions}
        stepUpAuths={stepUpAuths}
        activeAgents={activeAgentCount}
      />

      {/* Main content grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Activity feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Live Activity Feed</span>
                <span className="flex items-center gap-1.5 text-[11px] font-normal text-[var(--muted-foreground)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                  Live
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              <ActivityFeed maxItems={20} />
            </CardContent>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Delegation Chain</CardTitle>
            </CardHeader>
            <CardContent>
              <DelegationChain />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-6 text-[var(--muted-foreground)]">
                <p className="text-xs">No pending step-up approvals</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Agent cards */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Agent Permissions</h2>
        <AgentCardsGrid />
      </div>
    </div>
  );
}
