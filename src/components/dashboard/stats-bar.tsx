/**
 * Stats bar component showing key metrics at the top of the dashboard.
 *
 * Accepts initial server-rendered values as props and then polls
 * /api/stats every 30 seconds to keep them fresh.
 */

"use client";

import { useEffect, useState } from "react";
import { Activity, ShieldAlert, ShieldCheck, Bot } from "lucide-react";

interface StatsData {
  totalActions: number;
  blockedActions: number;
  stepUpAuths: number;
  activeAgents: number;
}

interface StatsBarProps {
  totalActions: number;
  blockedActions: number;
  stepUpAuths: number;
  activeAgents: number;
}

const POLL_INTERVAL = 30_000;

export function StatsBar(props: StatsBarProps) {
  const [data, setData] = useState<StatsData>({
    totalActions: props.totalActions,
    blockedActions: props.blockedActions,
    stepUpAuths: props.stepUpAuths,
    activeAgents: props.activeAgents,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        }
      } catch {
        // Keep showing last known values.
      }
    }

    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: "Total Actions", value: data.totalActions, icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Blocked", value: data.blockedActions, icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Step-Up Auths", value: data.stepUpAuths, icon: ShieldCheck, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Active Agents", value: data.activeAgents, icon: Bot, color: "text-green-400", bg: "bg-green-500/10" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </div>
          <div>
            <p className="text-xl font-semibold leading-tight">{stat.value}</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {stat.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
