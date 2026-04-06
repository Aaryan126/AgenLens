/**
 * Dashboard layout with sidebar navigation and auth protection.
 * All dashboard pages share this layout. Redirects to login if
 * the user is not authenticated.
 */

import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ApprovalToast } from "@/components/approval-toast";
import { auth0 } from "@/lib/auth0/client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <ApprovalToast />
      <main className="page-gradient ml-60 min-h-screen px-8 py-6">{children}</main>
    </div>
  );
}
