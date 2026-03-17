/**
 * Connected accounts management page.
 *
 * Shows which third-party accounts (Google, GitHub, Slack) are connected,
 * their granted scopes, and provides controls to connect or revoke access.
 * Connections are established via Auth0 Connected Accounts flow.
 */

"use client";

import { useState, useEffect } from "react";
import { Cable, Plus, Trash2, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { scopeToLabel } from "@/lib/utils";
import type { ConnectedAccount } from "@/lib/types";

/** Available connection providers and their Auth0 connection names. */
const providers = [
  {
    name: "Google",
    connectionName: "google-oauth2",
    description: "Calendar, Gmail, Drive",
    color: "text-red-400",
  },
  {
    name: "GitHub",
    connectionName: "github",
    description: "Repos, Issues, Pull Requests",
    color: "text-purple-400",
  },
  {
    name: "Slack",
    connectionName: "slack",
    description: "Channels, Messages, Search",
    color: "text-green-400",
  },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectedAccount[]>([]);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch("/api/connections");
      if (response.ok) {
        const json = await response.json();
        setConnections(json.data || []);
      }
    } catch {
      // Handle silently.
    }
  };

  const connectAccount = (connectionName: string) => {
    // Redirect to Auth0 Connected Accounts flow.
    // In production, this would use the Auth0 SDK's authorize endpoint
    // with the connection parameter.
    window.location.href = `/api/auth/login?connection=${connectionName}&returnTo=/dashboard/connections`;
  };

  const revokeAccount = async (id: string) => {
    try {
      await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchConnections();
    } catch {
      // Handle silently.
    }
  };

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
          const connection = connections.find(
            (c) =>
              c.connectionName === provider.connectionName &&
              c.status === "active"
          );

          return (
            <Card key={provider.connectionName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-base ${provider.color}`}>
                    {provider.name}
                  </CardTitle>
                  {connection ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                </div>
                <CardDescription>{provider.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {connection ? (
                  <div className="space-y-3">
                    {/* Granted scopes */}
                    {connection.scopesGranted.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">
                          Granted Scopes
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {connection.scopesGranted.map((scope) => (
                            <Badge
                              key={scope}
                              variant="outline"
                              className="text-xs"
                            >
                              {scopeToLabel(scope)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Connected{" "}
                        {new Date(connection.connectedAt).toLocaleDateString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-red-400 hover:text-red-300"
                        onClick={() => revokeAccount(connection.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Revoke
                      </Button>
                    </div>
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

      {/* Info card */}
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
              Revoking a connection immediately stops all agents from accessing
              that service.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
