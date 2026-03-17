/**
 * Activity log API route handler.
 *
 * Provides CRUD operations for agent activity records.
 * Used by the dashboard to display activity history, filter by agent,
 * and show request detail pages.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import { db } from "@/lib/db";

/**
 * GET /api/activity
 *
 * Lists agent activities for the authenticated user.
 * Supports filtering by agent type, request ID, and pagination.
 *
 * Query params:
 * - agentType: Filter by sub-agent type
 * - requestId: Filter by request group ID
 * - limit: Number of results (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentType = searchParams.get("agentType");
    const requestId = searchParams.get("requestId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: Record<string, unknown> = {
      userId: session.user.sub,
    };

    if (agentType) {
      where.agentType = agentType;
    }

    if (requestId) {
      where.requestId = requestId;
    }

    const [activities, total] = await Promise.all([
      db.agentActivity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.agentActivity.count({ where }),
    ]);

    return NextResponse.json({
      data: activities,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch activities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
