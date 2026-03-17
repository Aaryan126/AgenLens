/**
 * Step-up authentication approvals page.
 *
 * Shows history of all CIBA step-up events: pending approvals,
 * approved actions, denied requests, and expired timeouts.
 */

"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StepUpEvent } from "@/lib/types";

export default function ApprovalsPage() {
  const [events, setEvents] = useState<StepUpEvent[]>([]);

  useEffect(() => {
    // Fetch step-up events. In a full implementation, this would
    // be a dedicated API endpoint.
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/activity?limit=100");
        if (response.ok) {
          const json = await response.json();
          // Filter to activities with step-up events.
          const stepUpActivities = (json.data || []).filter(
            (a: { stepUpId: string | null }) => a.stepUpId
          );
          setEvents(
            stepUpActivities.map(
              (a: {
                id: string;
                userId: string;
                stepUpId: string;
                agentType: string;
                action: string;
                stepUpResult: string;
                createdAt: string;
              }) => ({
                id: a.id,
                userId: a.userId,
                activityId: a.id,
                agentType: a.agentType,
                actionDescription: a.action,
                cibaAuthReqId: a.stepUpId,
                status: a.stepUpResult || "pending",
                requestedAt: new Date(a.createdAt),
                resolvedAt: null,
                tokenExpiresAt: null,
              })
            )
          );
        }
      } catch {
        // Handle silently.
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  const pending = events.filter((e) => e.status === "pending");
  const resolved = events.filter((e) => e.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Step-Up Approvals</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          CIBA step-up authentication events. Sensitive actions require your
          explicit approval.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Pending"
          value={pending.length}
          icon={Clock}
          color="text-yellow-400"
        />
        <StatCard
          label="Approved"
          value={events.filter((e) => e.status === "approved").length}
          icon={CheckCircle}
          color="text-green-400"
        />
        <StatCard
          label="Denied"
          value={events.filter((e) => e.status === "denied").length}
          icon={XCircle}
          color="text-red-400"
        />
        <StatCard
          label="Expired"
          value={events.filter((e) => e.status === "expired").length}
          icon={Timer}
          color="text-gray-400"
        />
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <ShieldAlert className="h-5 w-5" />
              Pending Approvals ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((event) => (
              <StepUpEventRow key={event.id} event={event} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Approval History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resolved.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
              <ShieldCheck className="mb-3 h-8 w-8" />
              <p className="text-sm">No step-up authentication events yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resolved.map((event) => (
                <StepUpEventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepUpEventRow({ event }: { event: StepUpEvent }) {
  const statusConfig: Record<
    string,
    { badge: "success" | "destructive" | "warning" | "secondary"; label: string }
  > = {
    pending: { badge: "warning", label: "Pending" },
    approved: { badge: "success", label: "Approved" },
    denied: { badge: "destructive", label: "Denied" },
    expired: { badge: "secondary", label: "Expired" },
  };

  const config = statusConfig[event.status] || statusConfig.expired;

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {event.agentType.charAt(0).toUpperCase() +
              event.agentType.slice(1)}{" "}
            Agent
          </span>
          <Badge variant={config.badge}>{config.label}</Badge>
        </div>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {event.actionDescription}
        </p>
      </div>
      <span className="text-xs text-[var(--muted-foreground)]">
        {new Date(event.requestedAt).toLocaleString()}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)] ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
