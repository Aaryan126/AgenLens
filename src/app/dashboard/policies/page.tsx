/**
 * Policy management page.
 *
 * Allows users to create, edit, and toggle per-agent policies.
 * Policies are evaluated by the proxy before forwarding each API request.
 */

"use client";

import { useState, useEffect } from "react";
import { Plus, Shield, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AgentPolicy } from "@/lib/types";

const policyTypeLabels: Record<string, string> = {
  allowlist: "Allowlist",
  blocklist: "Blocklist",
  rate_limit: "Rate Limit",
  time_restriction: "Time Restriction",
  resource_restriction: "Resource Restriction",
};

const policyTypeDescriptions: Record<string, string> = {
  allowlist: "Only allow specific methods or endpoints",
  blocklist: "Block specific methods or endpoints",
  rate_limit: "Limit the number of requests in a time window",
  time_restriction: "Only allow actions during specific hours",
  resource_restriction: "Restrict access to specific resources",
};

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<AgentPolicy[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await fetch("/api/policies");
      if (response.ok) {
        const json = await response.json();
        setPolicies(json.data || []);
      }
    } catch {
      // Handle fetch error silently.
    }
  };

  const togglePolicy = async (id: string, enabled: boolean) => {
    try {
      await fetch("/api/policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      fetchPolicies();
    } catch {
      // Handle toggle error silently.
    }
  };

  const deletePolicy = async (id: string) => {
    try {
      await fetch("/api/policies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchPolicies();
    } catch {
      // Handle delete error silently.
    }
  };

  const createPolicy = async (formData: {
    agentType: string;
    policyType: string;
    rules: Record<string, unknown>;
  }) => {
    try {
      await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setShowCreateForm(false);
      fetchPolicies();
    } catch {
      // Handle create error silently.
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Policy Rules</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Define per-agent rules enforced by the proxy before every API call
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create Policy
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreatePolicyForm
          onSubmit={createPolicy}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Policy list */}
      {policies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Shield className="mb-2 h-6 w-6 text-[var(--muted-foreground)]" />
            <p className="text-xs text-[var(--muted-foreground)]">
              No policies defined yet. Create one to constrain agent behavior.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePolicy(policy.id, policy.enabled)}
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {policy.enabled ? (
                      <ToggleRight className="h-5 w-5 text-green-400" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">
                        {policy.agentType.charAt(0).toUpperCase() + policy.agentType.slice(1)} Agent
                      </span>
                      <Badge variant="outline">
                        {policyTypeLabels[policy.policyType] || policy.policyType}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                      {JSON.stringify(policy.rules)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => deletePolicy(policy.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Policy type reference */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Policy Types</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(policyTypeLabels).map(([type, label]) => (
            <div
              key={type}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <p className="text-xs font-medium">{label}</p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                {policyTypeDescriptions[type]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Preset policy templates for quick creation. */
const presets = [
  {
    label: "Block Email Agent from sending",
    agentType: "email",
    policyType: "blocklist",
    rules: { methods: ["POST"], endpoints: ["/send"] },
    description: "Prevents the Email Agent from sending any emails, even with approval.",
  },
  {
    label: "Block Email Agent from deleting",
    agentType: "email",
    policyType: "blocklist",
    rules: { methods: ["DELETE"] },
    description: "Prevents the Email Agent from deleting any emails.",
  },
  {
    label: "Calendar Agent: read only",
    agentType: "calendar",
    policyType: "allowlist",
    rules: { methods: ["GET"] },
    description: "Calendar Agent can only read events, never create or modify.",
  },
  {
    label: "GitHub Agent: rate limit 10 req/hour",
    agentType: "github",
    policyType: "rate_limit",
    rules: { maxRequests: 10, windowMinutes: 60 },
    description: "Limits the GitHub Agent to 10 API calls per hour.",
  },
  {
    label: "No agent actions outside business hours",
    agentType: "email",
    policyType: "time_restriction",
    rules: { allowedHoursStart: 9, allowedHoursEnd: 17 },
    description: "Email Agent can only operate between 9 AM and 5 PM.",
  },
  {
    label: "Drive Agent: block specific folders",
    agentType: "drive",
    policyType: "resource_restriction",
    rules: { blockedResources: ["confidential", "private"] },
    description: "Blocks Drive Agent from accessing files with 'confidential' or 'private' in the path.",
  },
];

/** Form for creating a new policy, with presets and manual JSON editing. */
function CreatePolicyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: {
    agentType: string;
    policyType: string;
    rules: Record<string, unknown>;
  }) => void;
  onCancel: () => void;
}) {
  const [agentType, setAgentType] = useState("email");
  const [policyType, setPolicyType] = useState("blocklist");
  const [rulesJson, setRulesJson] = useState('{"methods": ["POST"], "endpoints": ["/send"]}');
  const [jsonError, setJsonError] = useState(false);

  const applyPreset = (preset: typeof presets[number]) => {
    setAgentType(preset.agentType);
    setPolicyType(preset.policyType);
    setRulesJson(JSON.stringify(preset.rules, null, 2));
    setJsonError(false);
  };

  const handleSubmit = () => {
    try {
      const rules = JSON.parse(rulesJson);
      setJsonError(false);
      onSubmit({ agentType, policyType, rules });
    } catch {
      setJsonError(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Policy</CardTitle>
        <CardDescription>Use a preset or configure manually</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Presets */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Quick Presets
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className="rounded-lg border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--primary)]/30 hover:bg-[var(--accent)]"
              >
                <p className="text-xs font-medium">{preset.label}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Agent Type
            </label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/50"
            >
              <option value="calendar">Calendar</option>
              <option value="email">Email</option>
              <option value="github">GitHub</option>
              <option value="drive">Drive</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Policy Type
            </label>
            <select
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/50"
            >
              <option value="blocklist">Blocklist</option>
              <option value="allowlist">Allowlist</option>
              <option value="rate_limit">Rate Limit</option>
              <option value="time_restriction">Time Restriction</option>
              <option value="resource_restriction">Resource Restriction</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Rules (JSON)
          </label>
          <textarea
            value={rulesJson}
            onChange={(e) => {
              setRulesJson(e.target.value);
              setJsonError(false);
            }}
            rows={4}
            className={`w-full rounded-lg border bg-[var(--secondary)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--primary)]/50 ${
              jsonError ? "border-red-500" : "border-[var(--border)]"
            }`}
          />
          {jsonError && (
            <p className="mt-1 text-[11px] text-red-400">Invalid JSON. Please check the format.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit}>Create Policy</Button>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
