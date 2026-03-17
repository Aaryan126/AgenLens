/**
 * Analytics page.
 *
 * Shows usage metrics, trends, and insights about agent activity.
 * Includes breakdowns by agent type, service, policy results, etc.
 */

"use client";

import { useState, useEffect } from "react";
import { ChartBar, TrendingUp, ShieldAlert, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AgentActivity } from "@/lib/types";

interface AgentStats {
  agentType: string;
  totalActions: number;
  blockedActions: number;
  stepUpActions: number;
  avgDurationMs: number;
}

export default function AnalyticsPage() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [stats, setStats] = useState<AgentStats[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/activity?limit=500");
        if (response.ok) {
          const json = await response.json();
          const data = json.data || [];
          setActivities(data);
          computeStats(data);
        }
      } catch {
        // Handle silently.
      }
    };

    fetchData();
  }, []);

  const computeStats = (data: AgentActivity[]) => {
    const byAgent = new Map<string, AgentActivity[]>();
    for (const activity of data) {
      const existing = byAgent.get(activity.agentType) || [];
      existing.push(activity);
      byAgent.set(activity.agentType, existing);
    }

    const computed: AgentStats[] = [];
    for (const [agentType, agentActivities] of byAgent) {
      computed.push({
        agentType,
        totalActions: agentActivities.length,
        blockedActions: agentActivities.filter(
          (a) => a.policyResult === "blocked"
        ).length,
        stepUpActions: agentActivities.filter(
          (a) => a.policyResult === "step_up_required"
        ).length,
        avgDurationMs: Math.round(
          agentActivities.reduce((sum, a) => sum + a.durationMs, 0) /
            agentActivities.length
        ),
      });
    }

    computed.sort((a, b) => b.totalActions - a.totalActions);
    setStats(computed);
  };

  const totalActions = activities.length;
  const totalBlocked = activities.filter(
    (a) => a.policyResult === "blocked"
  ).length;
  const blockRate =
    totalActions > 0 ? ((totalBlocked / totalActions) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Agent usage metrics and security insights
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)] text-blue-400">
              <ChartBar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalActions}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Total API Calls
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)] text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{blockRate}%</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Block Rate
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)] text-green-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.length}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Active Agent Types
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)] text-yellow-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {activities.length > 0
                  ? `${Math.round(activities.reduce((sum, a) => sum + a.durationMs, 0) / activities.length)}ms`
                  : "0ms"}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Avg Response Time
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-agent breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
              <ChartBar className="mb-3 h-8 w-8" />
              <p className="text-sm">No activity data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.map((stat) => {
                const successRate =
                  ((stat.totalActions - stat.blockedActions) /
                    stat.totalActions) *
                  100;

                return (
                  <div
                    key={stat.agentType}
                    className="flex items-center gap-4"
                  >
                    <span className="w-20 text-sm font-medium">
                      {stat.agentType.charAt(0).toUpperCase() +
                        stat.agentType.slice(1)}
                    </span>

                    {/* Bar */}
                    <div className="flex-1">
                      <div className="flex h-6 overflow-hidden rounded-md bg-[var(--secondary)]">
                        <div
                          className="bg-green-500/60 transition-all"
                          style={{
                            width: `${successRate}%`,
                          }}
                        />
                        <div
                          className="bg-red-500/60 transition-all"
                          style={{
                            width: `${100 - successRate}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex w-48 items-center justify-end gap-4 text-xs text-[var(--muted-foreground)]">
                      <span>{stat.totalActions} total</span>
                      <span className="text-red-400">
                        {stat.blockedActions} blocked
                      </span>
                      <span>{stat.avgDurationMs}ms avg</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
