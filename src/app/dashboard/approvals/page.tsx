/**
 * Step-up approvals page.
 *
 * Shows pending approvals with Approve/Deny buttons, and a history
 * of all resolved step-up events.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface StepUpEvent {
  id: string;
  userId: string;
  agentType: string;
  actionDescription: string;
  targetService: string | null;
  httpMethod: string | null;
  endpoint: string | null;
  status: string;
  requestedAt: string;
  resolvedAt: string | null;
}

export default function ApprovalsPage() {
  const [events, setEvents] = useState<StepUpEvent[]>([]);
  const [resolving, setResolving] = useState<Set<string>>(new Set());

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/approvals?limit=50");
      if (response.ok) {
        const json = await response.json();
        setEvents(json.data || []);
      }
    } catch {
      // Handle silently.
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const handleResolve = async (id: string, action: "approve" | "deny") => {
    setResolving((prev) => new Set(prev).add(id));
    try {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      fetchEvents();
    } catch {
      // Handle silently.
    } finally {
      setResolving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const pending = events.filter((e) => e.status === "pending");
  const approved = events.filter((e) => e.status === "approved");
  const denied = events.filter((e) => e.status === "denied");
  const expired = events.filter((e) => e.status === "expired");
  const resolved = events.filter((e) => e.status !== "pending");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Step-Up Approvals</h1>
        <p className="text-xs text-[var(--muted-foreground)]">
          Sensitive agent actions require your explicit approval before proceeding.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Pending", value: pending.length, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          { label: "Approved", value: approved.length, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Denied", value: denied.length, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Expired", value: expired.length, icon: Timer, color: "text-gray-400", bg: "bg-gray-500/10" },
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

      {/* Pending approvals */}
      {pending.length > 0 && (
        <Card className="border-yellow-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <ShieldAlert className="h-4 w-4" />
              Pending Approvals ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-lg border border-yellow-500/15 bg-yellow-500/5 p-3.5">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">
                      {event.agentType.charAt(0).toUpperCase() + event.agentType.slice(1)} Agent
                    </span>
                    <Badge variant="warning">Pending</Badge>
                    {event.targetService && <Badge variant="outline">{event.targetService}</Badge>}
                    {event.httpMethod && <Badge variant="outline">{event.httpMethod}</Badge>}
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                    {event.actionDescription}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    Requested {new Date(event.requestedAt).toLocaleString()}
                  </p>
                </div>
                <div className="ml-4 flex gap-1.5">
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => handleResolve(event.id, "approve")}
                    disabled={resolving.has(event.id)}
                  >
                    {resolving.has(event.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handleResolve(event.id, "deny")}
                    disabled={resolving.has(event.id)}
                  >
                    <X className="h-3 w-3" />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Approval History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resolved.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--muted-foreground)]">
              <ShieldCheck className="mb-2 h-6 w-6" />
              <p className="text-xs">No step-up events yet</p>
              <p className="mt-0.5 text-[11px]">Try asking the agent to send an email or create a calendar event</p>
            </div>
          ) : (
            <div className="space-y-1.5">
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
  const statusConfig: Record<string, { badge: "success" | "destructive" | "warning" | "secondary"; label: string; icon: React.ElementType }> = {
    pending: { badge: "warning", label: "Pending", icon: Clock },
    approved: { badge: "success", label: "Approved", icon: CheckCircle },
    denied: { badge: "destructive", label: "Denied", icon: XCircle },
    expired: { badge: "secondary", label: "Expired", icon: Timer },
  };

  const config = statusConfig[event.status] || statusConfig.expired;
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-center gap-3">
        <StatusIcon className={`h-3.5 w-3.5 ${event.status === "approved" ? "text-green-400" : event.status === "denied" ? "text-red-400" : "text-gray-400"}`} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">
              {event.agentType.charAt(0).toUpperCase() + event.agentType.slice(1)} Agent
            </span>
            <Badge variant={config.badge}>{config.label}</Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
            {event.actionDescription}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[11px] text-[var(--muted-foreground)]">
          {new Date(event.requestedAt).toLocaleString()}
        </p>
        {event.resolvedAt && (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Resolved {new Date(event.resolvedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
