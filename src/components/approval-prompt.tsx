/**
 * Approval prompt component.
 *
 * Polls for pending step-up approvals and renders them either:
 * - Inline in the chat (replacing the loading indicator)
 * - As a toast notification on other pages
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="mb-5 flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15">
        <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" />
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
      <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] text-green-400">
          <Check className="h-3.5 w-3.5" />
          Action approved
        </div>
      </div>
    );
  }

  if (item.status === "denied") {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] text-red-400">
          <X className="h-3.5 w-3.5" />
          Action denied
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border border-yellow-500/20 bg-yellow-500/5",
      compact ? "w-80 p-3 shadow-lg" : "px-4 py-3",
    )}>
      <div className="space-y-2.5">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" />
          <div>
            <p className="text-[13px] font-medium">Approval Required</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {item.actionDescription}
            </p>
            {item.targetService && (
              <div className="mt-1 flex gap-1.5">
                <Badge variant="outline">{item.targetService}</Badge>
                {item.httpMethod && <Badge variant="outline">{item.httpMethod}</Badge>}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
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
    </div>
  );
}
