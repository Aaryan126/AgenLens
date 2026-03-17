/**
 * Landing page for AgenLens.
 * Shows project overview and login button for unauthenticated users.
 * Redirects to dashboard for authenticated users.
 */

import Link from "next/link";
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
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--border)] px-8 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold">AgenLens</span>
        </div>
        <Link href="/api/auth/login">
          <Button>Sign In</Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-4 py-1.5 text-sm">
          <Lock className="h-3.5 w-3.5 text-[var(--primary)]" />
          Powered by Auth0 Token Vault
        </div>

        <h1 className="mb-4 max-w-3xl text-center text-5xl font-bold leading-tight">
          See, scope, and control what your AI agents do
        </h1>

        <p className="mb-8 max-w-2xl text-center text-lg text-[var(--muted-foreground)]">
          AgenLens gives every sub-agent its own scoped token, routes all API
          calls through an observability proxy, and puts you in control with a
          real-time dashboard.
        </p>

        <div className="flex gap-4">
          <Link href="/api/auth/login">
            <Button size="lg" className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">
              View Dashboard
            </Button>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
                <Layers className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-2 font-semibold">Per-Agent Token Scoping</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Each sub-agent gets its own scoped token from Auth0 Token Vault.
                The Calendar Agent cannot read your email. The Email Agent
                cannot touch your repos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
                <Eye className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="mb-2 font-semibold">
                Post-Exchange Observability
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                All API calls route through our proxy. See every endpoint hit,
                every action taken, in real-time. The visibility gap after token
                exchange is closed.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/20">
                <Shield className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="mb-2 font-semibold">Runtime Policy Control</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Define per-agent policies. Block actions, enforce rate limits,
                restrict resources. CIBA step-up auth for anything sensitive.
                You stay in control.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Architecture preview */}
        <div className="mt-16 w-full max-w-4xl">
          <Card className="overflow-hidden">
            <CardContent className="p-8">
              <h3 className="mb-6 text-center text-lg font-semibold">
                How It Works
              </h3>
              <div className="flex items-center justify-between gap-4 text-center text-sm">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--secondary)]">
                    <Bot className="h-6 w-6 text-indigo-400" />
                  </div>
                  <span className="font-medium">Supervisor</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Decomposes your request
                  </span>
                </div>

                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />

                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--secondary)]">
                    <Layers className="h-6 w-6 text-purple-400" />
                  </div>
                  <span className="font-medium">Sub-Agents</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Scoped tokens per agent
                  </span>
                </div>

                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />

                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--secondary)]">
                    <Shield className="h-6 w-6 text-green-400" />
                  </div>
                  <span className="font-medium">Proxy</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Policy check + logging
                  </span>
                </div>

                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />

                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--secondary)]">
                    <Activity className="h-6 w-6 text-blue-400" />
                  </div>
                  <span className="font-medium">Dashboard</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Real-time visibility
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-8 py-6 text-center text-sm text-[var(--muted-foreground)]">
        Built for the Authorized to Act Hackathon. Powered by Auth0 for AI
        Agents.
      </footer>
    </div>
  );
}
