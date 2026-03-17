/**
 * Agent permission cards component.
 *
 * Displays a card for each sub-agent showing its name, connected service,
 * current scopes, status, and controls to pause/revoke access.
 * This is the user-facing permission visibility layer that Auth0 doesn't provide.
 */

"use client";

import { useState } from "react";
import {
  Calendar,
  Mail,
  Github,
  MessageSquare,
  HardDrive,
  Pause,
  Play,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AGENT_SCOPE_CONFIG } from "@/lib/types";
import { scopeToLabel } from "@/lib/utils";
import type { AgentType } from "@/lib/types";

/** Maps agent types to their icon components. */
const agentIcons: Record<string, React.ElementType> = {
  calendar: Calendar,
  email: Mail,
  github: Github,
  slack: MessageSquare,
  drive: HardDrive,
};

/** Maps agent types to their gradient background classes. */
const agentGradients: Record<string, string> = {
  calendar: "from-amber-500/20 to-amber-600/5",
  email: "from-red-500/20 to-red-600/5",
  github: "from-purple-500/20 to-purple-600/5",
  slack: "from-green-500/20 to-green-600/5",
  drive: "from-blue-500/20 to-blue-600/5",
};

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
    <Card
      className={`bg-gradient-to-br ${agentGradients[agentType]} relative overflow-hidden`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{config.displayName}</CardTitle>
            <p className="text-xs text-[var(--muted-foreground)]">
              {config.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            title={enabled ? "Pause agent" : "Resume agent"}
          >
            {enabled ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" title="Agent settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Connection status */}
        <div className="mb-3 flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
          />
          <span className="text-xs text-[var(--muted-foreground)]">
            {isConnected ? "Connected" : "Not connected"} via{" "}
            {config.connection}
          </span>
        </div>

        {/* Default scopes */}
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">
            Default Permissions
          </p>
          <div className="flex flex-wrap gap-1">
            {config.defaultScopes.map((scope) => (
              <Badge key={scope} variant="secondary" className="text-xs">
                {scopeToLabel(scope)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Escalatable scopes */}
        {config.escalatableScopes.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">
              Requires Approval
            </p>
            <div className="flex flex-wrap gap-1">
              {config.escalatableScopes.map((scope) => (
                <Badge key={scope} variant="warning" className="text-xs">
                  {scopeToLabel(scope)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-xs text-[var(--muted-foreground)]">
            {activityCount} actions
          </span>
          {lastActive && (
            <span className="text-xs text-[var(--muted-foreground)]">
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
  const agentTypes = Object.keys(AGENT_SCOPE_CONFIG) as Array<
    Exclude<AgentType, "supervisor">
  >;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {agentTypes.map((type) => (
        <AgentCard key={type} agentType={type} isConnected={true} />
      ))}
    </div>
  );
}
