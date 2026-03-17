/**
 * Policy management API route handler.
 *
 * Provides CRUD operations for user-defined agent policies.
 * Users create policies via the dashboard to constrain sub-agent behavior.
 * The proxy evaluates these policies before forwarding each request.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import { db } from "@/lib/db";

/**
 * GET /api/policies
 *
 * Lists all policies for the authenticated user.
 * Optionally filter by agent type.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentType = searchParams.get("agentType");

    const where: Record<string, unknown> = {
      userId: session.user.sub,
    };

    if (agentType) {
      where.agentType = agentType;
    }

    const policies = await db.agentPolicy.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: policies });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch policies";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/policies
 *
 * Creates a new policy rule for a specific agent type.
 *
 * Body:
 * - agentType: The sub-agent this policy applies to
 * - policyType: allowlist | blocklist | rate_limit | time_restriction | resource_restriction
 * - rules: Policy-specific configuration object
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { agentType, policyType, rules } = body;

    if (!agentType || !policyType || !rules) {
      return NextResponse.json(
        { error: "Missing required fields: agentType, policyType, rules" },
        { status: 400 }
      );
    }

    const validPolicyTypes = [
      "allowlist",
      "blocklist",
      "rate_limit",
      "time_restriction",
      "resource_restriction",
    ];

    if (!validPolicyTypes.includes(policyType)) {
      return NextResponse.json(
        { error: `Invalid policyType. Must be one of: ${validPolicyTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const policy = await db.agentPolicy.create({
      data: {
        userId: session.user.sub,
        agentType,
        policyType,
        rules,
      },
    });

    return NextResponse.json({ data: policy }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/policies
 *
 * Updates an existing policy. Supports toggling enabled/disabled
 * and updating rules.
 *
 * Body:
 * - id: The policy ID to update
 * - enabled: (optional) Toggle policy on/off
 * - rules: (optional) Updated rules configuration
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, enabled, rules } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    // Verify the policy belongs to this user.
    const existing = await db.agentPolicy.findFirst({
      where: { id, userId: session.user.sub },
    });

    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof enabled === "boolean") updateData.enabled = enabled;
    if (rules) updateData.rules = rules;

    const policy = await db.agentPolicy.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: policy });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/policies
 *
 * Deletes a policy by ID.
 *
 * Body:
 * - id: The policy ID to delete
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const existing = await db.agentPolicy.findFirst({
      where: { id, userId: session.user.sub },
    });

    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    await db.agentPolicy.delete({ where: { id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
