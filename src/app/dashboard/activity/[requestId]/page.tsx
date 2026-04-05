/**
 * Activity detail page for a specific request.
 *
 * Shows all sub-agent actions triggered by a single user request,
 * forming a delegation chain view. Each action displays the agent type,
 * target service, HTTP method, policy result, and duration.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  Clock,
  ArrowLeft,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

export default function ActivityDetailPage() {
  const params = useParams();
  const requestId = params.requestId as string;
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const response = await fetch(`/api/activity?requestId=${requestId}&limit=100`);
        if (response.ok) {
          const json = await response.json();
          setActivities(json.data || []);
        }
      } catch {
        // Handle silently.
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [requestId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--muted-foreground)]">
        <Clock className="mr-2 h-5 w-5 animate-spin" />
        Loading activity...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/activity"
          className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Activity Log
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Request Detail</h1>
        <p className="mt-1 font-mono text-sm text-[var(--muted-foreground)]">
          {requestId}
        </p>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
            <Bot className="mb-3 h-8 w-8" />
            <p className="text-sm">No agent activity found for this request</p>
            <p className="text-xs">
              The agents may not have made any external API calls for this request
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--muted-foreground)]">Total Actions</p>
                <p className="mt-1 text-2xl font-bold">{activities.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--muted-foreground)]">Agents Used</p>
                <p className="mt-1 text-2xl font-bold">
                  {new Set(activities.map((a) => a.agentType)).size}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--muted-foreground)]">Blocked</p>
                <p className="mt-1 text-2xl font-bold text-red-400">
                  {activities.filter((a) => a.policyResult === "blocked").length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--muted-foreground)]">Total Duration</p>
                <p className="mt-1 text-2xl font-bold">
                  {activities.reduce((sum, a) => sum + a.durationMs, 0)}ms
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Delegation chain */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delegation Chain</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {activities.map((activity, index) => {
                const agentType = activity.agentType as AgentType;
                const Icon = agentIcons[agentType] || Bot;
                const colorClass = agentColors[agentType] || "text-gray-400";

                return (
                  <div key={activity.id}>
                    <div
                      className={cn(
                        "flex items-start gap-4 rounded-lg border border-transparent p-4 transition-colors hover:border-[var(--border)] hover:bg-[var(--accent)]",
                        activity.policyResult === "blocked" && "border-red-500/20 bg-red-500/5"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)]",
                          colorClass
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-semibold", colorClass)}>
                            {agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {activity.httpMethod}
                          </Badge>
                          <PolicyBadge result={activity.policyResult} />
                        </div>

                        <p className="mt-1 text-sm">{activity.action}</p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                          <span>Service: {activity.targetService}</span>
                          <span>Status: {activity.responseStatus}</span>
                          <span>Duration: {activity.durationMs}ms</span>
                          <span>
                            {new Date(activity.createdAt).toLocaleTimeString()}
                          </span>
                        </div>

                        {activity.scopesUsed.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {activity.scopesUsed.map((scope) => (
                              <Badge key={scope} variant="secondary" className="text-xs">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {index < activities.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

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
