/**
 * Connected accounts management page.
 *
 * Shows which third-party accounts (Google, GitHub, Slack) are connected
 * by checking the actual Auth0 identity status. Provides controls to
 * connect new accounts or reconnect expired ones.
 */

"use client";

import { useState, useEffect } from "react";
import { Cable, Plus, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Available connection providers and their Auth0 connection names. */
const providers = [
  {
    name: "Google",
    connectionName: "google-oauth2",
    description: "Calendar, Gmail, Drive",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  {
    name: "GitHub",
    connectionName: "github",
    description: "Repos, Issues, Pull Requests",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    name: "Slack",
    connectionName: "slack",
    description: "Channels, Messages, Search",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
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

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/connections/status");
      if (response.ok) {
        const json = await response.json();
        setStatuses(json.data || {});
      }
    } catch {
      // Handle silently.
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
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking connections...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Connected Accounts</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Manage which third-party accounts your agents can access via Auth0
          Token Vault
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
                  <CardTitle className={`text-base ${provider.color}`}>
                    {provider.name}
                  </CardTitle>
                  {isConnected ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
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
                    <div className={`rounded-lg ${provider.bgColor} p-3`}>
                      <p className="text-xs font-medium text-[var(--foreground)]">
                        Token available for agents
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        Sub-agents can access {provider.name} APIs through the proxy.
                        Tokens are refreshed automatically.
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => connectAccount(provider.connectionName)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => connectAccount(provider.connectionName)}
                  >
                    <Plus className="h-4 w-4" />
                    Connect {provider.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Session info card */}
      <Card>
        <CardContent className="flex items-start gap-4 p-6">
          <Cable className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]" />
          <div>
            <p className="text-sm font-medium">How Connections Work</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              When you connect an account, Auth0 securely stores your OAuth
              tokens in Token Vault. Each sub-agent exchanges its Auth0 token
              for a scoped provider token through the AgenLens proxy. The proxy
              injects the token, so agents never see your raw credentials.
            </p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              If a connection shows errors or agents fail to access a service,
              click "Reconnect" to refresh the OAuth tokens.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
