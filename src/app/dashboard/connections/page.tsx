/**
 * Connected accounts management page.
 *
 * Shows which third-party accounts (Google, GitHub, Slack) are connected.
 * Provides controls to connect new accounts or reconnect expired ones.
 */

"use client";

import { useState, useEffect } from "react";
import { Cable, Plus, RefreshCw, CheckCircle2, Loader2, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const providers = [
  {
    name: "Google",
    connectionName: "google-oauth2",
    description: "Calendar, Gmail, Drive",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    name: "GitHub",
    connectionName: "github",
    description: "Repos, Issues, Pull Requests",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    name: "Slack",
    connectionName: "slack",
    description: "Channels, Messages, Search",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
];

interface ConnectionStatus {
  provider: string;
  connection: string;
  isSocial: boolean;
  accessToken?: string;
}

export default function ConnectionsPage() {
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/connections/status");
      if (response.ok) {
        const json = await response.json();
        setStatuses(json.data || {});
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const connectAccount = (connectionName: string) => {
    window.location.href = `/api/connect?connection=${connectionName}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">Checking connections...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[var(--muted-foreground)]">
        <Cable className="mb-2 h-6 w-6 text-red-400" />
        <p className="text-xs">Failed to check connection status</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Connected Accounts</h1>
        <p className="text-xs text-[var(--muted-foreground)]">
          Manage which third-party accounts your agents can access via Auth0 Token Vault
        </p>
      </div>

      {/* Provider cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((provider) => {
          const status = statuses[provider.connectionName];
          const isConnected = !!status?.accessToken;

          return (
            <Card key={provider.connectionName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={provider.color}>
                    {provider.name}
                  </CardTitle>
                  {isConnected ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                </div>
                <CardDescription>{provider.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {isConnected ? (
                  <div className="space-y-3">
                    <div className={`rounded-lg ${provider.bg} p-3`}>
                      <p className="text-[11px] font-medium">
                        Token available for agents
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                        Sub-agents can access {provider.name} APIs through the proxy.
                        Tokens are refreshed automatically.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => connectAccount(provider.connectionName)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => connectAccount(provider.connectionName)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Connect {provider.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info card */}
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
        <div>
          <p className="text-xs font-medium">How Connections Work</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            When you connect an account, Auth0 securely stores your OAuth tokens in Token Vault.
            Each sub-agent exchanges its Auth0 token for a scoped provider token through the AgenLens proxy.
            The proxy injects the token, so agents never see your raw credentials.
            If a connection shows errors, click &quot;Reconnect&quot; to refresh the OAuth tokens.
          </p>
        </div>
      </div>
    </div>
  );
}
