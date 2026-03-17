/**
 * CIBA webhook route handler.
 *
 * Receives callbacks from Auth0 when a CIBA step-up authentication
 * request is resolved (approved, denied, or expired). Updates the
 * corresponding step-up event in the database and emits a real-time
 * event to the dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitActivityEvent } from "@/lib/proxy/events";

/**
 * POST /api/webhook/ciba
 *
 * Called by Auth0 when a CIBA request is resolved.
 * Updates the step-up event status and notifies the dashboard.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { auth_req_id, status } = body;

    if (!auth_req_id || !status) {
      return NextResponse.json(
        { error: "Missing required fields: auth_req_id, status" },
        { status: 400 }
      );
    }

    const stepUpEvent = await db.stepUpEvent.findFirst({
      where: { cibaAuthReqId: auth_req_id },
    });

    if (!stepUpEvent) {
      return NextResponse.json(
        { error: "Step-up event not found" },
        { status: 404 }
      );
    }

    const updatedEvent = await db.stepUpEvent.update({
      where: { id: stepUpEvent.id },
      data: {
        status,
        resolvedAt: new Date(),
      },
    });

    emitActivityEvent({
      type: "step_up",
      data: {
        id: updatedEvent.id,
        userId: updatedEvent.userId,
        activityId: updatedEvent.activityId,
        agentType: updatedEvent.agentType as import("@/lib/types").AgentType,
        actionDescription: updatedEvent.actionDescription,
        cibaAuthReqId: updatedEvent.cibaAuthReqId,
        status: updatedEvent.status as import("@/lib/types").StepUpStatus,
        requestedAt: updatedEvent.requestedAt,
        resolvedAt: updatedEvent.resolvedAt,
        tokenExpiresAt: updatedEvent.tokenExpiresAt,
      },
    });

    return NextResponse.json({ data: { updated: true } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
