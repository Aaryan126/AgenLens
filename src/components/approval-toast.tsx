/**
 * Approval toast wrapper for non-chat pages.
 *
 * Renders the ApprovalPrompt in toast mode. Used in the dashboard
 * layout so approval notifications appear on any dashboard page.
 */

"use client";

import { ApprovalPrompt } from "@/components/approval-prompt";

export function ApprovalToast() {
  return <ApprovalPrompt mode="toast" />;
}
