/**
 * Approvals API route handler.
 *
 * GET: Returns step-up events for the authenticated user.
 *      Query params: status (pending/approved/denied/expired), limit, offset
 *
 * POST: Resolves a pending approval (approve or deny).
 *       Body: { id, action: "approve" | "deny" }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import { db } from "@/lib/db";

/**
 * GET /api/approvals
 *
 * Lists step-up events, optionally filtered by status.
 * Designed for lightweight polling when status=pending.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = req.nextUrl.searchParams.get("status");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { userId: session.user.sub };
    if (status) {
      where.status = status;
    }

    const [events, total] = await Promise.all([
      db.stepUpEvent.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.stepUpEvent.count({ where }),
    ]);

    return NextResponse.json({ data: events, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch approvals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/approvals
 *
 * Resolves a pending step-up approval.
 * Body: { id: string, action: "approve" | "deny" }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body;

    if (!id || !action || !["approve", "deny"].includes(action)) {
      return NextResponse.json(
        { error: "Missing required fields: id, action (approve|deny)" },
        { status: 400 }
      );
    }

    // Verify the approval belongs to this user and is still pending.
    const existing = await db.stepUpEvent.findFirst({
      where: { id, userId: session.user.sub, status: "pending" },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Approval not found or already resolved" },
        { status: 404 }
      );
    }

    const newStatus = action === "approve" ? "approved" : "denied";

    const updated = await db.stepUpEvent.update({
      where: { id },
      data: {
        status: newStatus,
        resolvedAt: new Date(),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve approval";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
