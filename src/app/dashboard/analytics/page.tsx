/**
 * Analytics page.
 *
 * Shows interactive charts and metrics about agent activity including
 * activity over time, agent distribution, policy results breakdown,
 * response time trends, and per-service usage.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { ChartBar, TrendingUp, ShieldAlert, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { agentLabel } from "@/lib/agent-ui";
import type { AgentActivity } from "@/lib/types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/** Agent type to color mapping for charts. */
const AGENT_CHART_COLORS: Record<string, string> = {
  calendar: "#f59e0b",
  email: "#ef4444",
  github: "#a855f7",
  drive: "#3b82f6",
  supervisor: "#6366f1",
};

/** Policy result colors. */
const POLICY_COLORS = {
  allowed: "#22c55e",
  blocked: "#ef4444",
  step_up_required: "#f59e0b",
};

type TimeRange = "24h" | "7d" | "30d" | "all";

export default function AnalyticsPage() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/activity?limit=1000");
        if (response.ok) {
          const json = await response.json();
          setActivities(json.data || []);
        }
      } catch {
        // Handle silently.
      }
    };
    fetchData();
  }, []);

  /** Filter activities by selected time range. */
  const filteredActivities = useMemo(() => {
    if (timeRange === "all") return activities;
    const now = Date.now();
    const ranges: Record<TimeRange, number> = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      all: Infinity,
    };
    const cutoff = now - ranges[timeRange];
    return activities.filter((a) => new Date(a.createdAt).getTime() > cutoff);
  }, [activities, timeRange]);

  /** Summary stats. */
  const totalActions = filteredActivities.length;
  const totalBlocked = filteredActivities.filter((a) => a.policyResult === "blocked").length;
  const totalStepUp = filteredActivities.filter((a) => a.policyResult === "step_up_required").length;
  const blockRate = totalActions > 0 ? ((totalBlocked / totalActions) * 100).toFixed(1) : "0";
  const avgDuration = totalActions > 0
    ? Math.round(filteredActivities.reduce((sum, a) => sum + a.durationMs, 0) / totalActions)
    : 0;
  const uniqueAgents = new Set(filteredActivities.map((a) => a.agentType)).size;

  /** Activity over time data (grouped by time bucket). */
  const timeSeriesData = useMemo(() => {
    if (filteredActivities.length === 0) return [];

    const useHours = timeRange === "24h";
    const buckets = new Map<string, { label: string; allowed: number; blocked: number; stepUp: number }>();

    for (const a of filteredActivities) {
      const d = new Date(a.createdAt);
      const key = useHours
        ? `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`
        : `${d.getMonth() + 1}/${d.getDate()}`;

      if (!buckets.has(key)) {
        buckets.set(key, { label: key, allowed: 0, blocked: 0, stepUp: 0 });
      }
      const bucket = buckets.get(key)!;
      if (a.policyResult === "blocked") bucket.blocked++;
      else if (a.policyResult === "step_up_required") bucket.stepUp++;
      else bucket.allowed++;
    }

    return Array.from(buckets.values());
  }, [filteredActivities, timeRange]);

  /** Agent distribution data for pie chart. */
  const agentDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of filteredActivities) {
      counts.set(a.agentType, (counts.get(a.agentType) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name: agentLabel(name), value, agentType: name }))
      .sort((a, b) => b.value - a.value);
  }, [filteredActivities]);

  /** Per-agent policy breakdown for stacked bar chart. */
  const agentPolicyData = useMemo(() => {
    const byAgent = new Map<string, { allowed: number; blocked: number; stepUp: number }>();
    for (const a of filteredActivities) {
      if (!byAgent.has(a.agentType)) {
        byAgent.set(a.agentType, { allowed: 0, blocked: 0, stepUp: 0 });
      }
      const entry = byAgent.get(a.agentType)!;
      if (a.policyResult === "blocked") entry.blocked++;
      else if (a.policyResult === "step_up_required") entry.stepUp++;
      else entry.allowed++;
    }
    return Array.from(byAgent.entries())
      .map(([agent, data]) => ({
        agent: agentLabel(agent),
        ...data,
      }))
      .sort((a, b) => (b.allowed + b.blocked + b.stepUp) - (a.allowed + a.blocked + a.stepUp));
  }, [filteredActivities]);

  /** Response time by agent for bar chart. */
  const responseTimeData = useMemo(() => {
    const byAgent = new Map<string, { total: number; count: number; max: number }>();
    for (const a of filteredActivities) {
      if (!byAgent.has(a.agentType)) {
        byAgent.set(a.agentType, { total: 0, count: 0, max: 0 });
      }
      const entry = byAgent.get(a.agentType)!;
      entry.total += a.durationMs;
      entry.count++;
      entry.max = Math.max(entry.max, a.durationMs);
    }
    return Array.from(byAgent.entries())
      .map(([agent, data]) => ({
        agent: agentLabel(agent),
        agentType: agent,
        avg: Math.round(data.total / data.count),
        max: data.max,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [filteredActivities]);

  /** Top services. */
  const serviceData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of filteredActivities) {
      counts.set(a.targetService, (counts.get(a.targetService) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredActivities]);

  const isEmpty = filteredActivities.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Analytics</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Agent usage metrics and security insights
          </p>
        </div>
        <div className="flex gap-1">
          {(["24h", "7d", "30d", "all"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setTimeRange(range)}
            >
              {range === "all" ? "All" : range}
            </Button>
          ))}
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total API Calls", value: totalActions, icon: ChartBar, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Block Rate", value: `${blockRate}%`, icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Active Agents", value: uniqueAgents, icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Avg Response", value: `${avgDuration}ms`, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
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

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-[var(--muted-foreground)]">
            <ChartBar className="mb-2 h-6 w-6" />
            <p className="text-xs">No activity data yet</p>
            <p className="mt-0.5 text-[11px]">Start a conversation in the chat to generate analytics</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Activity over time */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAllowed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="allowed" stackId="1" stroke="#22c55e" fill="url(#gradAllowed)" strokeWidth={2} />
                    <Area type="monotone" dataKey="blocked" stackId="1" stroke="#ef4444" fill="url(#gradBlocked)" strokeWidth={2} />
                    <Area type="monotone" dataKey="stepUp" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" />Allowed</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Blocked</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-500" />Step-Up</span>
              </div>
            </CardContent>
          </Card>

          {/* Two-column charts */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Agent distribution pie */}
            <Card>
              <CardHeader>
                <CardTitle>Agent Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={agentDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {agentDistribution.map((entry) => (
                          <Cell key={entry.agentType} fill={AGENT_CHART_COLORS[entry.agentType] || "#6366f1"} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {agentDistribution.map((entry) => (
                    <span key={entry.agentType} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AGENT_CHART_COLORS[entry.agentType] }} />
                      {entry.name} ({entry.value})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Policy results by agent - stacked bar */}
            <Card>
              <CardHeader>
                <CardTitle>Policy Results by Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentPolicyData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis dataKey="agent" type="category" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={70} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="allowed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={20} />
                      <Bar dataKey="blocked" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={20} />
                      <Bar dataKey="stepUp" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second row of charts */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Response time by agent */}
            <Card>
              <CardHeader>
                <CardTitle>Response Time by Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={responseTimeData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                      <XAxis dataKey="agent" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} name="Avg (ms)" />
                      <Bar dataKey="max" fill="#3b82f6" fillOpacity={0.3} radius={[4, 4, 0, 0]} barSize={28} name="Max (ms)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top services */}
            <Card>
              <CardHeader>
                <CardTitle>Top Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {serviceData.map((item, i) => {
                    const maxCount = serviceData[0]?.count || 1;
                    const pct = (item.count / maxCount) * 100;

                    return (
                      <div key={item.service} className="flex items-center gap-3">
                        <span className="w-5 text-right text-[11px] font-medium text-[var(--muted-foreground)]">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-medium">{item.service}</span>
                            <span className="text-[11px] text-[var(--muted-foreground)]">{item.count} calls</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]">
                            <div
                              className="h-full rounded-full bg-[var(--primary)] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {serviceData.length === 0 && (
                    <p className="py-6 text-center text-xs text-[var(--muted-foreground)]">No service data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agentPolicyData.map((stat) => {
                  const total = stat.allowed + stat.blocked + stat.stepUp;
                  const successRate = (stat.allowed / total) * 100;

                  return (
                    <div key={stat.agent} className="flex items-center gap-4">
                      <span className="w-16 text-xs font-medium">{stat.agent}</span>
                      <div className="flex-1">
                        <div className="flex h-5 overflow-hidden rounded-full bg-[var(--secondary)]">
                          <div className="rounded-l-full bg-green-500/50 transition-all" style={{ width: `${successRate}%` }} />
                          <div className="bg-red-500/50 transition-all" style={{ width: `${100 - successRate}%` }} />
                        </div>
                      </div>
                      <div className="flex w-44 items-center justify-end gap-3 text-[11px] text-[var(--muted-foreground)]">
                        <span>{total} total</span>
                        <span className="text-red-400">{stat.blocked} blocked</span>
                        <span>{responseTimeData.find((r) => r.agent === stat.agent)?.avg || 0}ms avg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Custom tooltip for Recharts. */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-lg">
      {label && <p className="mb-1 text-[11px] font-medium">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[var(--muted-foreground)]">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Custom tooltip for the pie chart. */
function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { agentType: string } }> }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AGENT_CHART_COLORS[entry.payload.agentType] }} />
        <span className="font-medium">{entry.name}</span>
        <span className="text-[var(--muted-foreground)]">{entry.value} calls</span>
      </div>
    </div>
  );
}
