/**
 * Agent permission cards component.
 *
 * Displays a card for each sub-agent showing its name, connected service,
 * current scopes, status, and controls to pause/revoke access.
 */

"use client";

import { useState } from "react";
import { Pause, Play, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AGENT_SCOPE_CONFIG } from "@/lib/types";
import { scopeToLabel } from "@/lib/utils";
import { agentIcons, agentGradients } from "@/lib/agent-ui";
import type { AgentType } from "@/lib/types";

interface AgentCardProps {
  agentType: Exclude<AgentType, "supervisor">;
  isConnected: boolean;
  activityCount?: number;
  lastActive?: Date;
  onToggle?: (agentType: string, enabled: boolean) => void;
}

export function AgentCard({
  agentType,
  isConnected,
  activityCount = 0,
  lastActive,
  onToggle,
}: AgentCardProps) {
  const [enabled, setEnabled] = useState(true);
  const config = AGENT_SCOPE_CONFIG[agentType];
  const Icon = agentIcons[agentType];

  const handleToggle = () => {
    const newState = !enabled;
    setEnabled(newState);
    onToggle?.(agentType, newState);
  };

  return (
    <Card className={`bg-gradient-to-br ${agentGradients[agentType]} relative overflow-hidden`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--secondary)]">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-[13px]">{config.displayName}</CardTitle>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {config.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleToggle}
            title={enabled ? "Pause agent" : "Resume agent"}
          >
            {enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Agent settings">
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Connection status */}
        <div className="mb-3 flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {isConnected ? "Connected" : "Not connected"} via {config.connection}
          </span>
        </div>

        {/* Default scopes */}
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-medium text-[var(--muted-foreground)]">
            Default Permissions
          </p>
          <div className="flex flex-wrap gap-1">
            {config.defaultScopes.map((scope) => (
              <Badge key={scope} variant="secondary">
                {scopeToLabel(scope)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Escalatable scopes */}
        {config.escalatableScopes.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-medium text-[var(--muted-foreground)]">
              Requires Approval
            </p>
            <div className="flex flex-wrap gap-1">
              {config.escalatableScopes.map((scope) => (
                <Badge key={scope} variant="warning">
                  {scopeToLabel(scope)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {activityCount} actions
          </span>
          {lastActive && (
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Last active:{" "}
              {new Date(lastActive).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <Badge variant={enabled ? "success" : "secondary"}>
            {enabled ? "Active" : "Paused"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

/** Renders all agent cards in a grid. */
export function AgentCardsGrid() {
  const agentTypes = Object.keys(AGENT_SCOPE_CONFIG) as Array<Exclude<AgentType, "supervisor">>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {agentTypes.map((type) => (
        <AgentCard key={type} agentType={type} isConnected={true} />
      ))}
    </div>
  );
}
