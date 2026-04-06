/**
 * Activity detail page for a specific request.
 *
 * Shows all sub-agent actions triggered by a single user request,
 * forming a delegation chain view.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, Clock, ArrowLeft, ArrowDown, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { agentIcons, agentColors, agentLabel } from "@/lib/agent-ui";
import type { AgentActivity, AgentType } from "@/lib/types";

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
        <Clock className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">Loading activity...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/activity"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Activity Log
      </Link>

      <div>
        <h1 className="text-lg font-semibold">Request Detail</h1>
        <p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">
          {requestId}
        </p>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-[var(--muted-foreground)]">
            <Bot className="mb-2 h-6 w-6" />
            <p className="text-xs">No agent activity found for this request</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Total Actions", value: activities.length },
              { label: "Agents Used", value: new Set(activities.map((a) => a.agentType)).size },
              { label: "Blocked", value: activities.filter((a) => a.policyResult === "blocked").length, color: "text-red-400" },
              { label: "Total Duration", value: `${activities.reduce((sum, a) => sum + a.durationMs, 0)}ms` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-[11px] text-[var(--muted-foreground)]">{stat.label}</p>
                <p className={`mt-1 text-xl font-semibold ${stat.color || ""}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Delegation chain */}
          <Card>
            <CardHeader>
              <CardTitle>Delegation Chain</CardTitle>
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
                        "flex items-start gap-3.5 rounded-lg border border-transparent p-3.5 transition-colors hover:bg-[var(--accent)]",
                        activity.policyResult === "blocked" && "border-red-500/10 bg-red-500/5"
                      )}
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)]", colorClass)}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-medium", colorClass)}>
                            {agentLabel(agentType)} Agent
                          </span>
                          <Badge variant="outline">{activity.httpMethod}</Badge>
                          <PolicyBadge result={activity.policyResult} />
                        </div>

                        <p className="mt-1 text-[13px]">{activity.action}</p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted-foreground)]">
                          <span>Service: {activity.targetService}</span>
                          <span>Status: {activity.responseStatus}</span>
                          <span>Duration: {activity.durationMs}ms</span>
                          <span>{new Date(activity.createdAt).toLocaleTimeString()}</span>
                        </div>

                        {activity.scopesUsed.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {activity.scopesUsed.map((scope) => (
                              <Badge key={scope} variant="secondary">{scope}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {index < activities.length - 1 && (
                      <div className="flex justify-center py-0.5">
                        <ArrowDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
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
