/**
 * Dashboard sidebar navigation component.
 *
 * Provides navigation to all dashboard sections, shows the current
 * user's profile, and includes a logout button.
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

      {/* User info and logout */}
      <div className="border-t border-[var(--border)] p-4">
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--secondary)]">
                  <User className="h-4 w-4 text-[var(--muted-foreground)]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.name || "User"}
                </p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {user.email || ""}
                </p>
              </div>
            </div>
            <a href="/auth/logout" className="block">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-[var(--muted-foreground)]">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </a>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">
            Powered by Auth0 Token Vault
          </p>
        )}
      </div>
    </aside>
  );
}
