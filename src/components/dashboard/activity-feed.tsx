/**
 * Live activity feed component for the dashboard.
 *
 * Displays a real-time, scrolling feed of all agent actions as they happen.
 * Each entry shows the sub-agent, action description, target service,
 * policy result, and timestamp. Color-coded by agent type for quick scanning.
 */

"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Clock, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import { agentIcons, agentColors, agentLabel } from "@/lib/agent-ui";
import type { AgentActivity, AgentType } from "@/lib/types";

interface ActivityFeedProps {
  initialActivities?: AgentActivity[];
  maxItems?: number;
  agentFilter?: AgentType;
}

export function ActivityFeed({
  initialActivities = [],
  maxItems = 50,
  agentFilter,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<AgentActivity[]>(initialActivities);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const params = new URLSearchParams({ limit: String(maxItems) });
        if (agentFilter) params.set("agentType", agentFilter);

        const response = await fetch(`/api/activity?${params}`);
        if (response.ok) {
          const json = await response.json();
          setActivities(json.data || []);
          setError(false);
        } else if (response.status === 401) {
          setError(true);
        }
      } catch {
        setError(true);
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 3000);
    return () => clearInterval(interval);
  }, [maxItems, agentFilter]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-[var(--muted-foreground)]">
        <ShieldAlert className="mb-2 h-6 w-6 text-red-400" />
        <p className="text-xs">Failed to load activity</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-[var(--muted-foreground)]">
        <Bot className="mb-2 h-6 w-6" />
        <p className="text-xs">No agent activity yet</p>
        <p className="mt-0.5 text-[11px]">
          Start a conversation in the chat to see actions here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {activities.map((activity) => {
        const agentType = activity.agentType as AgentType;
        const Icon = agentIcons[agentType] || Bot;
        const colorClass = agentColors[agentType] || "text-gray-400";

        return (
          <div
            key={activity.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-[var(--accent)]",
              activity.policyResult === "blocked" && "border-red-500/10 bg-red-500/5"
            )}
          >
            <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)]", colorClass)}>
              <Icon className="h-3 w-3" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-[11px] font-medium", colorClass)}>
                  {agentLabel(agentType)} Agent
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {activity.targetService}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-[var(--foreground)]">
                {activity.action}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <PolicyBadge result={activity.policyResult} />
              <span className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo(new Date(activity.createdAt))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Renders a badge for the policy evaluation result. */
function PolicyBadge({ result }: { result: string }) {
  switch (result) {
    case "allowed":
      return (
        <Badge variant="success" className="gap-1">
          <ShieldCheck className="h-2.5 w-2.5" />
          Allowed
        </Badge>
      );
    case "blocked":
      return (
        <Badge variant="destructive" className="gap-1">
          <ShieldAlert className="h-2.5 w-2.5" />
          Blocked
        </Badge>
      );
    case "step_up_required":
      return (
        <Badge variant="warning" className="gap-1">
          <ShieldAlert className="h-2.5 w-2.5" />
          Step-Up
        </Badge>
      );
    default:
      return <Badge variant="secondary">{result}</Badge>;
  }
}
