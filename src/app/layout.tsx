/**
 * Root layout for AgenLens.
 * Applies global styles and wraps the app in the Auth0 provider.
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgenLens - Multi-Agent Observability & Control",
  description:
    "See, scope, and control what your AI agents do with your accounts. Powered by Auth0 Token Vault.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] antialiased">
        {children}
      </body>
    </html>
  );
}
