/**
 * Live activity feed component for the dashboard.
 *
 * Displays a real-time, scrolling feed of all agent actions as they happen.
 * Each entry shows the sub-agent, action description, target service,
 * policy result, and timestamp. Color-coded by agent type for quick scanning.
 */

"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Mail,
  Github,
  MessageSquare,
  HardDrive,
  Bot,
  ShieldAlert,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import type { AgentActivity, AgentType } from "@/lib/types";

/** Maps agent types to their icon components. */
const agentIcons: Record<AgentType, React.ElementType> = {
  supervisor: Bot,
  calendar: Calendar,
  email: Mail,
  github: Github,
  slack: MessageSquare,
  drive: HardDrive,
};

/** Maps agent types to their CSS color variables. */
const agentColors: Record<AgentType, string> = {
  supervisor: "text-indigo-400",
  calendar: "text-amber-400",
  email: "text-red-400",
  github: "text-purple-400",
  slack: "text-green-400",
  drive: "text-blue-400",
};

interface ActivityFeedProps {
  /** Initial activities to display (from server). */
  initialActivities?: AgentActivity[];
  /** Maximum number of items to display. */
  maxItems?: number;
  /** Filter by agent type. */
  agentFilter?: AgentType;
}

export function ActivityFeed({
  initialActivities = [],
  maxItems = 50,
  agentFilter,
}: ActivityFeedProps) {
  const [activities, setActivities] =
    useState<AgentActivity[]>(initialActivities);

  // Poll for new activities every 3 seconds.
  // In production, this would use WebSocket via Socket.io.
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const params = new URLSearchParams({ limit: String(maxItems) });
        if (agentFilter) params.set("agentType", agentFilter);

        const response = await fetch(`/api/activity?${params}`);
        if (response.ok) {
          const json = await response.json();
          setActivities(json.data || []);
        }
      } catch {
        // Silently handle fetch errors - feed will retry on next interval.
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 3000);

    return () => clearInterval(interval);
  }, [maxItems, agentFilter]);

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
        <Bot className="mb-3 h-8 w-8" />
        <p className="text-sm">No agent activity yet</p>
        <p className="text-xs">
          Start a conversation in the chat to see agent actions here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => {
        const agentType = activity.agentType as AgentType;
        const Icon = agentIcons[agentType] || Bot;
        const colorClass = agentColors[agentType] || "text-gray-400";

        return (
          <div
            key={activity.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-[var(--border)] hover:bg-[var(--accent)]",
              activity.policyResult === "blocked" &&
                "border-red-500/20 bg-red-500/5"
            )}
          >
            {/* Agent icon */}
            <div
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)]",
                colorClass
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Action details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium", colorClass)}>
                  {agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {activity.targetService}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[var(--foreground)]">
                {activity.action}
              </p>
            </div>

            {/* Status and time */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              <PolicyBadge result={activity.policyResult} />
              <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                <Clock className="h-3 w-3" />
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
          <ShieldCheck className="h-3 w-3" />
          Allowed
        </Badge>
      );
    case "blocked":
      return (
        <Badge variant="destructive" className="gap-1">
          <ShieldAlert className="h-3 w-3" />
          Blocked
        </Badge>
      );
    case "step_up_required":
      return (
        <Badge variant="warning" className="gap-1">
          <ShieldAlert className="h-3 w-3" />
          Step-Up
        </Badge>
      );
    default:
      return <Badge variant="secondary">{result}</Badge>;
  }
}
