/**
 * Chat messages API route.
 *
 * Handles loading and saving chat messages for persistence across sessions.
 * Messages are stored per user and session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import { db } from "@/lib/db";

/**
 * GET /api/chat/messages
 *
 * Loads chat messages for a given session, or the most recent session
 * if no sessionId is provided.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (sessionId) {
      const messages = await db.chatMessage.findMany({
        where: { userId: session.user.sub, sessionId },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ data: messages });
    }

    // Return the most recent session's messages.
    const latest = await db.chatMessage.findFirst({
      where: { userId: session.user.sub },
      orderBy: { createdAt: "desc" },
      select: { sessionId: true },
    });

    if (!latest) {
      return NextResponse.json({ data: [] });
    }

    const messages = await db.chatMessage.findMany({
      where: { userId: session.user.sub, sessionId: latest.sessionId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: messages, sessionId: latest.sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/chat/messages
 *
 * Saves a chat message to the database.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, role, content, requestId } = body;

    if (!sessionId || !role || !content) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, role, content" },
        { status: 400 }
      );
    }

    const message = await db.chatMessage.create({
      data: {
        userId: session.user.sub,
        sessionId,
        role,
        content,
        requestId: requestId || null,
      },
    });

    return NextResponse.json({ data: message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
