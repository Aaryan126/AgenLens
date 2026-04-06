/**
 * Shared agent UI configuration.
 *
 * Centralizes agent type to icon, color, and gradient mappings
 * used across dashboard components, activity feeds, and detail pages.
 * Import from here instead of defining these maps in each component.
 */

import {
  Calendar,
  Mail,
  Github,
  MessageSquare,
  HardDrive,
  Bot,
} from "lucide-react";
import type { AgentType } from "@/lib/types";

/** Maps agent types to their Lucide icon components. */
export const agentIcons: Record<AgentType, React.ElementType> = {
  supervisor: Bot,
  calendar: Calendar,
  email: Mail,
  github: Github,
  slack: MessageSquare,
  drive: HardDrive,
};

/** Maps agent types to their Tailwind text color classes. */
export const agentColors: Record<AgentType, string> = {
  supervisor: "text-indigo-400",
  calendar: "text-amber-400",
  email: "text-red-400",
  github: "text-purple-400",
  slack: "text-green-400",
  drive: "text-blue-400",
};

/** Maps agent types to their Tailwind background gradient classes (for cards). */
export const agentGradients: Record<Exclude<AgentType, "supervisor">, string> = {
  calendar: "from-amber-500/10 to-amber-600/5",
  email: "from-red-500/10 to-red-600/5",
  github: "from-purple-500/10 to-purple-600/5",
  slack: "from-green-500/10 to-green-600/5",
  drive: "from-blue-500/10 to-blue-600/5",
};

/** Capitalizes an agent type for display. */
export function agentLabel(agentType: string): string {
  return agentType.charAt(0).toUpperCase() + agentType.slice(1);
}
