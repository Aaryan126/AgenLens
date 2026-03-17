/**
 * Dashboard sidebar navigation component.
 *
 * Provides navigation to all dashboard sections: activity feed,
 * agent management, policies, approvals, connections, and analytics.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Cable,
  ChartBar,
  LayoutDashboard,
  MessageSquare,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/activity", label: "Activity Log", icon: Activity },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/policies", label: "Policies", icon: Shield },
  { href: "/dashboard/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/dashboard/connections", label: "Connections", icon: Cable },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartBar },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold">AgenLens</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] p-4">
        <p className="text-xs text-[var(--muted-foreground)]">
          Powered by Auth0 Token Vault
        </p>
      </div>
    </aside>
  );
}
