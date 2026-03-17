/**
 * Activity log page.
 * Shows the full searchable, filterable history of all agent actions.
 */

"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import type { AgentType } from "@/lib/types";

const agentFilters: Array<{ label: string; value: AgentType | undefined }> = [
  { label: "All Agents", value: undefined },
  { label: "Calendar", value: "calendar" },
  { label: "Email", value: "email" },
  { label: "GitHub", value: "github" },
  { label: "Slack", value: "slack" },
  { label: "Drive", value: "drive" },
];

export default function ActivityLogPage() {
  const [activeFilter, setActiveFilter] = useState<AgentType | undefined>(
    undefined
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Full history of all agent actions, filterable by agent type
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {agentFilters.map((filter) => (
          <Button
            key={filter.label}
            variant={activeFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Activity list */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeFilter
              ? `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Agent Activity`
              : "All Agent Activity"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed maxItems={100} agentFilter={activeFilter} />
        </CardContent>
      </Card>
    </div>
  );
}
