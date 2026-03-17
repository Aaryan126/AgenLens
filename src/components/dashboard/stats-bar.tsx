/**
 * Stats bar component showing key metrics at the top of the dashboard.
 * Displays total actions, blocked actions, step-up auths, and active agents.
 */

"use client";

import { Activity, ShieldAlert, ShieldCheck, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsBarProps {
  totalActions: number;
  blockedActions: number;
  stepUpAuths: number;
  activeAgents: number;
}

export function StatsBar({
  totalActions,
  blockedActions,
  stepUpAuths,
  activeAgents,
}: StatsBarProps) {
  const stats = [
    {
      label: "Total Actions",
      value: totalActions,
      icon: Activity,
      color: "text-blue-400",
    },
    {
      label: "Blocked",
      value: blockedActions,
      icon: ShieldAlert,
      color: "text-red-400",
    },
    {
      label: "Step-Up Auths",
      value: stepUpAuths,
      icon: ShieldCheck,
      color: "text-yellow-400",
    },
    {
      label: "Active Agents",
      value: activeAgents,
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
