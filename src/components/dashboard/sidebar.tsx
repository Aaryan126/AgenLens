/**
 * Dashboard sidebar navigation component.
 *
 * Provides navigation to all dashboard sections, shows the current
 * user's profile, and includes a logout button. Nav items are grouped
 * into logical sections with the Chat action visually separated.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Activity,
  Bot,
  Cable,
  ChartBar,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const dashboardItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/activity", label: "Activity Log", icon: Activity },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/policies", label: "Policies", icon: Shield },
  { href: "/dashboard/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/dashboard/connections", label: "Connections", icon: Cable },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartBar },
];

interface UserInfo {
  name?: string;
  email?: string;
  picture?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/auth/profile");
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch {
        // Not logged in or session expired.
      }
    }
    fetchUser();
  }, []);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)]">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight">AgenLens</span>
      </div>

      {/* Dashboard navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pt-2">
        <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Dashboard
        </p>
        <div className="space-y-0.5">
          {dashboardItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
                isActive(item.href)
                  ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        {/* Chat link, visually separated */}
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Agent
          </p>
          <Link
            href="/chat"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
              pathname === "/chat"
                ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </Link>
        </div>
      </nav>

      {/* User info and logout */}
      <div className="border-t border-[var(--border)] p-3">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt="Profile"
                  className="h-7 w-7 rounded-full"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--secondary)]">
                  <User className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-tight">
                  {user.name || "User"}
                </p>
                <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                  {user.email || ""}
                </p>
              </div>
            </div>
            <a href="/auth/logout" className="block">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-[var(--muted-foreground)] text-xs">
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </a>
          </div>
        ) : (
          <p className="px-2 text-[11px] text-[var(--muted-foreground)]">
            Powered by Auth0 Token Vault
          </p>
        )}
      </div>
    </aside>
  );
}
