/**
 * Analytics page.
 *
 * Shows usage metrics, trends, and insights about agent activity.
 */

"use client";

import { useState, useEffect } from "react";
import { ChartBar, TrendingUp, ShieldAlert, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { agentLabel } from "@/lib/agent-ui";
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
        blockedActions: agentActivities.filter((a) => a.policyResult === "blocked").length,
        stepUpActions: agentActivities.filter((a) => a.policyResult === "step_up_required").length,
        avgDurationMs: Math.round(
          agentActivities.reduce((sum, a) => sum + a.durationMs, 0) / agentActivities.length
        ),
      });
    }

    computed.sort((a, b) => b.totalActions - a.totalActions);
    setStats(computed);
  };

  const totalActions = activities.length;
  const totalBlocked = activities.filter((a) => a.policyResult === "blocked").length;
  const blockRate = totalActions > 0 ? ((totalBlocked / totalActions) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-xs text-[var(--muted-foreground)]">
          Agent usage metrics and security insights
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total API Calls", value: totalActions, icon: ChartBar, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Block Rate", value: `${blockRate}%`, icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Active Agent Types", value: stats.length, icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10" },
          {
            label: "Avg Response Time",
            value: activities.length > 0
              ? `${Math.round(activities.reduce((sum, a) => sum + a.durationMs, 0) / activities.length)}ms`
              : "0ms",
            icon: Clock,
            color: "text-yellow-400",
            bg: "bg-yellow-500/10",
          },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-semibold leading-tight">{stat.value}</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-agent breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--muted-foreground)]">
              <ChartBar className="mb-2 h-6 w-6" />
              <p className="text-xs">No activity data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.map((stat) => {
                const successRate = ((stat.totalActions - stat.blockedActions) / stat.totalActions) * 100;

                return (
                  <div key={stat.agentType} className="flex items-center gap-4">
                    <span className="w-16 text-xs font-medium">
                      {agentLabel(stat.agentType)}
                    </span>

                    <div className="flex-1">
                      <div className="flex h-5 overflow-hidden rounded-full bg-[var(--secondary)]">
                        <div
                          className="rounded-l-full bg-green-500/50 transition-all"
                          style={{ width: `${successRate}%` }}
                        />
                        <div
                          className="bg-red-500/50 transition-all"
                          style={{ width: `${100 - successRate}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex w-44 items-center justify-end gap-3 text-[11px] text-[var(--muted-foreground)]">
                      <span>{stat.totalActions} total</span>
                      <span className="text-red-400">{stat.blockedActions} blocked</span>
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
