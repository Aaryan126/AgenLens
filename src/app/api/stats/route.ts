/**
 * Dashboard stats API route.
 *
 * Returns aggregated metrics for the authenticated user's agent activity.
 * Lightweight endpoint designed for polling: runs 4 simple count queries
 * and returns 4 numbers.
 */

import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import { db } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.sub;

    const [totalActions, blockedActions, stepUpAuths, activeAgents] =
      await Promise.all([
        db.agentActivity.count({ where: { userId } }),
        db.agentActivity.count({ where: { userId, policyResult: "blocked" } }),
        db.stepUpEvent.count({ where: { userId } }),
        db.agentActivity.groupBy({ by: ["agentType"], where: { userId } }),
      ]);

    return NextResponse.json({
      data: {
        totalActions,
        blockedActions,
        stepUpAuths,
        activeAgents: activeAgents.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
