/**
 * Activity logger for the AgenLens API proxy.
 *
 * Records every proxied API call to the database and emits real-time
 * events via WebSocket for the dashboard's live activity feed.
 * This is the core observability layer that provides post-token-exchange visibility.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { sanitizeForStorage } from "@/lib/utils";
import type {
  AgentType,
  PolicyResult,
  ProxyRequest,
  ProxyResponse,
  StepUpStatus,
} from "@/lib/types";
import { emitActivityEvent } from "@/lib/proxy/events";

/**
 * Logs a proxied API request to the database and emits a real-time event.
 *
 * Called by the proxy layer after every forwarded (or blocked) request.
 * Sanitizes request/response data before storage to prevent sensitive
 * content from being persisted.
 *
 * @param request - The proxied request details
 * @param response - The response from the external API (null if blocked)
 * @param action - Human-readable description of the action
 * @param policyResult - Whether the policy engine allowed, blocked, or required step-up
 * @param stepUpId - CIBA auth_req_id if step-up was triggered
 * @param stepUpResult - Current status of the step-up auth if applicable
 * @returns The created activity record
 */
export async function logActivity(params: {
  request: ProxyRequest;
  response: ProxyResponse | null;
  action: string;
  policyResult: PolicyResult;
  scopesUsed: string[];
  stepUpId?: string;
  stepUpResult?: StepUpStatus;
}): Promise<string> {
  const {
    request,
    response,
    action,
    policyResult,
    scopesUsed,
    stepUpId,
    stepUpResult,
  } = params;

  const activity = await db.agentActivity.create({
    data: {
      userId: request.userId,
      sessionId: request.sessionId,
      requestId: request.requestId,
      agentType: request.agentType,
      action,
      targetService: request.targetService,
      httpMethod: request.method,
      endpoint: request.url,
      requestSummary: (sanitizeForStorage(request.body, request.targetService) ?? undefined) as Prisma.InputJsonValue | undefined,
      responseStatus: response?.status ?? 0,
      responseSummary: (response
        ? sanitizeForStorage(response.body, request.targetService)
        : undefined) as Prisma.InputJsonValue | undefined,
      scopesUsed,
      policyResult,
      stepUpId: stepUpId ?? null,
      stepUpResult: stepUpResult ?? null,
      durationMs: response?.durationMs ?? 0,
    },
  });

  emitActivityEvent({
    type: policyResult === "blocked" ? "policy_violation" : "activity",
    data: {
      id: activity.id,
      userId: activity.userId,
      sessionId: activity.sessionId,
      requestId: activity.requestId,
      agentType: activity.agentType as AgentType,
      action: activity.action,
      targetService: activity.targetService,
      httpMethod: activity.httpMethod,
      endpoint: activity.endpoint,
      requestSummary: activity.requestSummary as Record<string, unknown> | null,
      responseStatus: activity.responseStatus,
      responseSummary: activity.responseSummary as Record<string, unknown> | null,
      scopesUsed: activity.scopesUsed,
      policyResult: activity.policyResult as PolicyResult,
      stepUpId: activity.stepUpId,
      stepUpResult: activity.stepUpResult as StepUpStatus | null,
      durationMs: activity.durationMs,
      createdAt: activity.createdAt,
    },
  });

  return activity.id;
}
