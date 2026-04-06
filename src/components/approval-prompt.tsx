/**
 * Approval prompt component.
 *
 * Polls for pending step-up approvals and renders them either:
 * - Inline in the chat (replacing the loading indicator)
 * - As a toast notification on other pages
 *
 * The component auto-polls every 2 seconds and renders approval cards
 * with Approve/Deny buttons. After resolution, shows a status badge
 * briefly before disappearing.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PendingApproval {
  id: string;
  agentType: string;
  actionDescription: string;
  targetService: string | null;
  httpMethod: string | null;
  requestedAt: string;
}

interface ApprovalPromptProps {
  /** Render mode: inline shows in chat flow, toast shows as floating notification. */
  mode: "inline" | "toast";
}

export function ApprovalPrompt({ mode }: ApprovalPromptProps) {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState<Map<string, "approved" | "denied">>(new Map());

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals?status=pending&limit=5");
      if (!res.ok) return;
      const json = await res.json();
      setPending(json.data || []);
    } catch {
      // Keep showing last state.
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 2000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleResolve = async (id: string, action: "approve" | "deny") => {
    setResolving((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        setResolved((prev) => new Map(prev).set(id, action === "approve" ? "approved" : "denied"));
        setPending((prev) => prev.filter((p) => p.id !== id));
      }
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

  // Clear resolved items after 3 seconds.
  useEffect(() => {
    if (resolved.size === 0) return;
    const timer = setTimeout(() => {
      setResolved(new Map());
    }, 3000);
    return () => clearTimeout(timer);
  }, [resolved]);

  const allItems = [
    ...pending.map((p) => ({ ...p, status: "pending" as const })),
    ...Array.from(resolved.entries()).map(([id, status]) => ({
      id,
      agentType: "",
      actionDescription: status === "approved" ? "Action approved" : "Action denied",
      targetService: null,
      httpMethod: null,
      requestedAt: new Date().toISOString(),
      status,
    })),
  ];

  if (allItems.length === 0) return null;

  if (mode === "toast") {
    return (
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {allItems.map((item) => (
          <ApprovalCard
            key={item.id}
            item={item}
            resolving={resolving.has(item.id)}
            onResolve={handleResolve}
            compact
          />
        ))}
      </div>
    );
  }

  // Inline mode for chat.
  return (
    <div className="mb-4 flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-500/20">
        <ShieldAlert className="h-4 w-4 text-yellow-400" />
      </div>
      <div className="flex flex-col gap-2">
        {allItems.map((item) => (
          <ApprovalCard
            key={item.id}
            item={item}
            resolving={resolving.has(item.id)}
            onResolve={handleResolve}
            compact={false}
          />
        ))}
      </div>
    </div>
  );
}

interface ApprovalCardProps {
  item: {
    id: string;
    agentType: string;
    actionDescription: string;
    targetService: string | null;
    httpMethod: string | null;
    status: "pending" | "approved" | "denied";
  };
  resolving: boolean;
  onResolve: (id: string, action: "approve" | "deny") => void;
  compact: boolean;
}

function ApprovalCard({ item, resolving, onResolve, compact }: ApprovalCardProps) {
  if (item.status === "approved") {
    return (
      <Card className="border-green-500/30 bg-green-500/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-green-400">
          <Check className="h-4 w-4" />
          Action approved - proceeding...
        </div>
      </Card>
    );
  }

  if (item.status === "denied") {
    return (
      <Card className="border-red-500/30 bg-red-500/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <X className="h-4 w-4" />
          Action denied
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-yellow-500/30 bg-yellow-500/5",
      compact ? "p-3" : "px-4 py-3",
      compact && "w-96 shadow-lg"
    )}>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
          <div>
            <p className="text-sm font-medium">Approval Required</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {item.actionDescription}
            </p>
            {item.targetService && (
              <div className="mt-1 flex gap-2">
                <Badge variant="outline" className="text-xs">{item.targetService}</Badge>
                {item.httpMethod && <Badge variant="outline" className="text-xs">{item.httpMethod}</Badge>}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1"
            onClick={() => onResolve(item.id, "approve")}
            disabled={resolving}
          >
            {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => onResolve(item.id, "deny")}
            disabled={resolving}
          >
            <X className="h-3 w-3" />
            Deny
          </Button>
        </div>
      </div>
    </Card>
  );
}
