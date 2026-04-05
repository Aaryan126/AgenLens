/**
 * Delegation chain component for the dashboard.
 *
 * Shows the most recent request's agent delegation chain, with a
 * dropdown to browse other recent requests. Each chain entry shows
 * the agent type, action, and policy result.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Mail,
  Github,
  MessageSquare,
  HardDrive,
  Bot,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ArrowDown,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import type { AgentActivity, AgentType } from "@/lib/types";

const agentIcons: Record<AgentType, React.ElementType> = {
  supervisor: Bot,
  calendar: Calendar,
  email: Mail,
  github: Github,
  slack: MessageSquare,
  drive: HardDrive,
};

const agentColors: Record<AgentType, string> = {
  supervisor: "text-indigo-400",
  calendar: "text-amber-400",
  email: "text-red-400",
  github: "text-purple-400",
  slack: "text-green-400",
  drive: "text-blue-400",
};

interface RecentRequest {
  requestId: string;
  agentTypes: string[];
  count: number;
  latestAt: string;
}

export function DelegationChain() {
  const [requests, setRequests] = useState<RecentRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch recent request IDs.
  useEffect(() => {
    async function fetchRecent() {
      try {
        const res = await fetch("/api/activity?limit=50");
        if (!res.ok) return;
        const json = await res.json();
        const allActivities: AgentActivity[] = json.data || [];

        // Group by requestId.
        const grouped = new Map<string, { agents: Set<string>; count: number; latestAt: string }>();
        for (const a of allActivities) {
          const existing = grouped.get(a.requestId);
          if (existing) {
            existing.agents.add(a.agentType);
            existing.count++;
          } else {
            grouped.set(a.requestId, {
              agents: new Set([a.agentType]),
              count: 1,
              latestAt: a.createdAt,
            });
          }
        }

        const recentReqs: RecentRequest[] = Array.from(grouped.entries()).map(
          ([reqId, data]) => ({
            requestId: reqId,
            agentTypes: Array.from(data.agents),
            count: data.count,
            latestAt: data.latestAt,
          })
        );

        setRequests(recentReqs);
        if (recentReqs.length > 0 && !selectedRequestId) {
          setSelectedRequestId(recentReqs[0].requestId);
        }
      } catch {
        // Handle silently.
      } finally {
        setLoading(false);
      }
    }

    fetchRecent();
    const interval = setInterval(fetchRecent, 15000);
    return () => clearInterval(interval);
  }, [selectedRequestId]);

  // Fetch activities for the selected request.
  useEffect(() => {
    if (!selectedRequestId) return;

    async function fetchChain() {
      try {
        const res = await fetch(`/api/activity?requestId=${selectedRequestId}&limit=50`);
        if (!res.ok) return;
        const json = await res.json();
        setActivities(json.data || []);
      } catch {
        // Handle silently.
      }
    }

    fetchChain();
  }, [selectedRequestId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[var(--muted-foreground)]">
        Loading...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]">
        <p className="text-sm">Send a message in Chat to see the delegation chain</p>
      </div>
    );
  }

  const selected = requests.find((r) => r.requestId === selectedRequestId);

  return (
    <div className="space-y-3">
      {/* Request selector */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs"
        >
          <span className="truncate font-mono">
            {selected ? selected.requestId : "Select request"}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", showDropdown && "rotate-180")} />
        </button>

        {showDropdown && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
            {requests.map((req) => (
              <button
                key={req.requestId}
                onClick={() => {
                  setSelectedRequestId(req.requestId);
                  setShowDropdown(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-[var(--accent)]",
                  req.requestId === selectedRequestId && "bg-[var(--accent)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate font-mono">{req.requestId.substring(0, 20)}...</span>
                  <Badge variant="secondary" className="text-[10px]">{req.count} actions</Badge>
                </span>
                <span className="text-[var(--muted-foreground)]">{timeAgo(new Date(req.latestAt))}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chain visualization */}
      <div className="space-y-0">
        {activities.map((activity, index) => {
          const agentType = activity.agentType as AgentType;
          const Icon = agentIcons[agentType] || Bot;
          const colorClass = agentColors[agentType] || "text-gray-400";

          return (
            <div key={activity.id}>
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--accent)]">
                <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded", colorClass)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{activity.action}</p>
                </div>
                <PolicyDot result={activity.policyResult} />
              </div>
              {index < activities.length - 1 && (
                <div className="flex justify-center">
                  <ArrowDown className="h-3 w-3 text-[var(--muted-foreground)]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Link to full detail */}
      {selectedRequestId && activities.length > 0 && (
        <Link
          href={`/dashboard/activity/${selectedRequestId}`}
          className="flex items-center justify-center gap-1 text-xs text-[var(--primary)] hover:underline"
        >
          View full details <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

/** Small colored dot indicating policy result. */
function PolicyDot({ result }: { result: string }) {
  const color =
    result === "allowed"
      ? "bg-green-500"
      : result === "blocked"
        ? "bg-red-500"
        : "bg-yellow-500";

  return <div className={cn("h-2 w-2 shrink-0 rounded-full", color)} title={result} />;
}
