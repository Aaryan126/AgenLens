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
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
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
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Activity feed - takes 3 columns */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Live Activity Feed</span>
                <span className="flex items-center gap-1.5 text-xs font-normal text-[var(--muted-foreground)]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  Live
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              <ActivityFeed maxItems={20} />
            </CardContent>
          </Card>
        </div>

        {/* Quick info panel - takes 2 columns */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Delegation Chain</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]">
                <p className="text-sm">
                  Send a message in Chat to see the delegation chain
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]">
                <p className="text-sm">No pending step-up approvals</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Agent cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Agent Permissions</h2>
        <AgentCardsGrid />
      </div>
    </div>
  );
}
