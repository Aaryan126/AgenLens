/**
 * Connected accounts API route handler.
 *
 * Manages the user's connected third-party accounts (Google, GitHub, Slack).
 * These connections are established via Auth0 Connected Accounts flow
 * and tracked in our database for dashboard visibility.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import { db } from "@/lib/db";

/**
 * GET /api/connections
 *
 * Lists all connected accounts for the authenticated user.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connections = await db.connectedAccount.findMany({
      where: { userId: session.user.sub },
      orderBy: { connectedAt: "desc" },
    });

    return NextResponse.json({ data: connections });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch connections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/connections
 *
 * Records a new connected account after the Auth0 Connected Accounts flow.
 *
 * Body:
 * - provider: The service name (e.g., "Google", "GitHub", "Slack")
 * - connectionName: The Auth0 connection name (e.g., "google-oauth2")
 * - scopesGranted: Array of granted OAuth scopes
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, connectionName, scopesGranted } = body;

    if (!provider || !connectionName) {
      return NextResponse.json(
        { error: "Missing required fields: provider, connectionName" },
        { status: 400 }
      );
    }

    const connection = await db.connectedAccount.upsert({
      where: {
        userId_connectionName: {
          userId: session.user.sub,
          connectionName,
        },
      },
      update: {
        scopesGranted: scopesGranted || [],
        status: "active",
        lastUsedAt: new Date(),
      },
      create: {
        userId: session.user.sub,
        provider,
        connectionName,
        scopesGranted: scopesGranted || [],
      },
    });

    return NextResponse.json({ data: connection }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/connections
 *
 * Revokes a connected account, preventing all agents from using it.
 *
 * Body:
 * - id: The connection ID to revoke
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

    const existing = await db.connectedAccount.findFirst({
      where: { id, userId: session.user.sub },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    await db.connectedAccount.update({
      where: { id },
      data: { status: "revoked" },
    });

    return NextResponse.json({ data: { revoked: true } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revoke connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
