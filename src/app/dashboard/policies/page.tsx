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
      // Handle fetch error silently, policies will show empty state.
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policy Rules</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Define per-agent rules enforced by the proxy before every API call
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="gap-2">
          <Plus className="h-4 w-4" />
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
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              No policies defined yet. Create one to constrain agent behavior.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => togglePolicy(policy.id, policy.enabled)}
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {policy.enabled ? (
                      <ToggleRight className="h-6 w-6 text-green-400" />
                    ) : (
                      <ToggleLeft className="h-6 w-6" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {policy.agentType.charAt(0).toUpperCase() +
                          policy.agentType.slice(1)}{" "}
                        Agent
                      </span>
                      <Badge variant="outline">
                        {policyTypeLabels[policy.policyType] ||
                          policy.policyType}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {JSON.stringify(policy.rules)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deletePolicy(policy.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Policy type reference */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Policy Types</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(policyTypeLabels).map(([type, label]) => (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{label}</CardTitle>
                <CardDescription>
                  {policyTypeDescriptions[type]}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Simple form for creating a new policy. */
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
  const [rulesJson, setRulesJson] = useState('{"methods": ["DELETE"]}');

  const handleSubmit = () => {
    try {
      const rules = JSON.parse(rulesJson);
      onSubmit({ agentType, policyType, rules });
    } catch {
      // Invalid JSON, do nothing.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create New Policy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
              Agent Type
            </label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm"
            >
              <option value="calendar">Calendar</option>
              <option value="email">Email</option>
              <option value="github">GitHub</option>
              <option value="slack">Slack</option>
              <option value="drive">Drive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
              Policy Type
            </label>
            <select
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm"
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
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
            Rules (JSON)
          </label>
          <textarea
            value={rulesJson}
            onChange={(e) => setRulesJson(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 font-mono text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit}>Create Policy</Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
