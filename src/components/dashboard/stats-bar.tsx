/**
 * Stats bar component showing key metrics at the top of the dashboard.
 *
 * Accepts initial server-rendered values as props and then polls
 * /api/stats every 30 seconds to keep them fresh. The initial props
 * prevent a flash of zeros on first load.
 */

"use client";

import { useEffect, useState } from "react";
import { Activity, ShieldAlert, ShieldCheck, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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

/** Polling interval in milliseconds. */
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
    {
      label: "Total Actions",
      value: data.totalActions,
      icon: Activity,
      color: "text-blue-400",
    },
    {
      label: "Blocked",
      value: data.blockedActions,
      icon: ShieldAlert,
      color: "text-red-400",
    },
    {
      label: "Step-Up Auths",
      value: data.stepUpAuths,
      icon: ShieldCheck,
      color: "text-yellow-400",
    },
    {
      label: "Active Agents",
      value: data.activeAgents,
      icon: Bot,
      color: "text-green-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)] ${stat.color}`}
            >
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {stat.label}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
