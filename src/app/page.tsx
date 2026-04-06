/**
 * Landing page for AgenLens.
 * Shows project overview and login button for unauthenticated users.
 * Redirects to dashboard for authenticated users.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot,
  Shield,
  Activity,
  Eye,
  ArrowRight,
  Lock,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0/client";

export default async function LandingPage() {
  const session = await auth0.getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight">AgenLens</span>
        </div>
        <Link href="/auth/login">
          <Button variant="outline" size="sm">
            Sign In
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center px-8 pt-24 pb-16">
        {/* Glow effect */}
        <div className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[var(--primary)]/[0.04] blur-[100px]" />

        <div className="relative mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-3.5 py-1.5 text-xs text-[var(--muted-foreground)]">
          <Lock className="h-3 w-3 text-[var(--primary)]" />
          Powered by Auth0 Token Vault
        </div>

        <h1 className="mb-5 max-w-2xl text-center text-4xl font-bold leading-[1.15] tracking-tight">
          See, scope, and control what your AI agents do
        </h1>

        <p className="mb-10 max-w-lg text-center text-[15px] leading-relaxed text-[var(--muted-foreground)]">
          AgenLens gives every sub-agent its own scoped token, routes all API
          calls through an observability proxy, and puts you in control with a
          real-time dashboard.
        </p>

        <Link href="/auth/login">
          <Button size="lg" className="gap-2">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>

        {/* Feature cards */}
        <div className="mt-20 grid max-w-4xl gap-5 md:grid-cols-3">
          {[
            {
              icon: Layers,
              color: "text-purple-400",
              bg: "bg-purple-500/10",
              title: "Per-Agent Token Scoping",
              desc: "Each sub-agent gets its own scoped token from Auth0 Token Vault. The Calendar Agent cannot read your email.",
            },
            {
              icon: Eye,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
              title: "Post-Exchange Observability",
              desc: "All API calls route through our proxy. See every endpoint hit, every action taken, in real-time.",
            },
            {
              icon: Shield,
              color: "text-green-400",
              bg: "bg-green-500/10",
              title: "Runtime Policy Control",
              desc: "Define per-agent policies. Block actions, enforce rate limits, restrict resources. Step-up auth for anything sensitive.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--border)]/80 hover:bg-[var(--accent)]"
            >
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${feature.bg}`}>
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
              </div>
              <h3 className="mb-2 text-sm font-semibold">{feature.title}</h3>
              <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Architecture flow */}
        <div className="mt-20 w-full max-w-3xl">
          <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
            How It Works
          </p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
            <div className="flex items-center justify-between gap-3 text-center">
              {[
                { icon: Bot, color: "text-indigo-400", label: "Supervisor", desc: "Decomposes request" },
                { icon: Layers, color: "text-purple-400", label: "Sub-Agents", desc: "Scoped tokens" },
                { icon: Shield, color: "text-green-400", label: "Proxy", desc: "Policy + logging" },
                { icon: Activity, color: "text-blue-400", label: "Dashboard", desc: "Real-time visibility" },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--secondary)]">
                      <step.icon className={`h-5 w-5 ${step.color}`} />
                    </div>
                    <span className="text-xs font-medium">{step.label}</span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {step.desc}
                    </span>
                  </div>
                  {i < 3 && (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--border)]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 text-center text-xs text-[var(--muted-foreground)]">
        Built for the Authorized to Act Hackathon &middot; Powered by Auth0 for AI Agents
      </footer>
    </div>
  );
}
