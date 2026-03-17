/**
 * Policy engine for the AgenLens API proxy.
 *
 * Evaluates user-defined policies against each outgoing API request before
 * the proxy forwards it to the external service. This is the runtime enforcement
 * layer that constrains sub-agent behavior beyond OAuth scopes.
 *
 * Policy evaluation order:
 * 1. Check if the agent type is recognized
 * 2. Evaluate blocklist policies (any match = blocked)
 * 3. Evaluate allowlist policies (if any exist, request must match one)
 * 4. Evaluate rate limit policies
 * 5. Evaluate time restriction policies
 * 6. Evaluate resource restriction policies
 * 7. Check if the action requires step-up authentication
 */

import { db } from "@/lib/db";
import type { AgentType, PolicyResult, ProxyRequest } from "@/lib/types";
import { AGENT_SCOPE_CONFIG } from "@/lib/types";

/** Result of policy evaluation with the reason for the decision. */
export interface PolicyEvaluation {
  result: PolicyResult;
  reason: string;
  /** The policy ID that caused a block or step-up requirement. */
  triggeredPolicyId?: string;
}

/**
 * Evaluates all active policies for a user and agent type against a request.
 *
 * This is the main entry point called by the proxy before forwarding a request.
 * Returns allowed, blocked, or step_up_required with a human-readable reason.
 *
 * @param request - The proxy request to evaluate
 * @returns Policy evaluation result with reason
 */
export async function evaluatePolicy(
  request: ProxyRequest
): Promise<PolicyEvaluation> {
  const policies = await db.agentPolicy.findMany({
    where: {
      userId: request.userId,
      agentType: request.agentType,
      enabled: true,
    },
  });

  // Check blocklist policies first (any match = blocked).
  for (const policy of policies.filter((p) => p.policyType === "blocklist")) {
    const rules = policy.rules as { methods?: string[]; endpoints?: string[] };

    if (rules.methods?.includes(request.method.toUpperCase())) {
      return {
        result: "blocked",
        reason: `Policy blocks ${request.method} requests for ${request.agentType} agent`,
        triggeredPolicyId: policy.id,
      };
    }

    if (rules.endpoints?.some((ep: string) => request.url.includes(ep))) {
      return {
        result: "blocked",
        reason: `Policy blocks access to ${request.url} for ${request.agentType} agent`,
        triggeredPolicyId: policy.id,
      };
    }
  }

  // Check allowlist policies (if any exist, request must match at least one).
  const allowlists = policies.filter((p) => p.policyType === "allowlist");
  if (allowlists.length > 0) {
    const allowed = allowlists.some((policy) => {
      const rules = policy.rules as {
        methods?: string[];
        endpoints?: string[];
      };
      const methodAllowed =
        !rules.methods || rules.methods.includes(request.method.toUpperCase());
      const endpointAllowed =
        !rules.endpoints ||
        rules.endpoints.some((ep: string) => request.url.includes(ep));
      return methodAllowed && endpointAllowed;
    });

    if (!allowed) {
      return {
        result: "blocked",
        reason: `No allowlist policy permits ${request.method} ${request.url} for ${request.agentType} agent`,
      };
    }
  }

  // Check rate limit policies.
  for (const policy of policies.filter(
    (p) => p.policyType === "rate_limit"
  )) {
    const rules = policy.rules as {
      maxRequests: number;
      windowMinutes: number;
    };
    const windowStart = new Date(
      Date.now() - rules.windowMinutes * 60 * 1000
    );

    const recentCount = await db.agentActivity.count({
      where: {
        userId: request.userId,
        agentType: request.agentType,
        createdAt: { gte: windowStart },
        policyResult: "allowed",
      },
    });

    if (recentCount >= rules.maxRequests) {
      return {
        result: "blocked",
        reason: `Rate limit exceeded: ${recentCount}/${rules.maxRequests} requests in ${rules.windowMinutes} minutes for ${request.agentType} agent`,
        triggeredPolicyId: policy.id,
      };
    }
  }

  // Check time restriction policies.
  for (const policy of policies.filter(
    (p) => p.policyType === "time_restriction"
  )) {
    const rules = policy.rules as {
      allowedHoursStart: number;
      allowedHoursEnd: number;
      timezone?: string;
    };
    const now = new Date();
    const hour = now.getHours();

    if (hour < rules.allowedHoursStart || hour >= rules.allowedHoursEnd) {
      return {
        result: "blocked",
        reason: `Time restriction: ${request.agentType} agent can only operate between ${rules.allowedHoursStart}:00 and ${rules.allowedHoursEnd}:00`,
        triggeredPolicyId: policy.id,
      };
    }
  }

  // Check resource restriction policies.
  for (const policy of policies.filter(
    (p) => p.policyType === "resource_restriction"
  )) {
    const rules = policy.rules as {
      allowedResources?: string[];
      blockedResources?: string[];
    };

    if (
      rules.blockedResources?.some((res: string) =>
        request.url.includes(res)
      )
    ) {
      return {
        result: "blocked",
        reason: `Resource restriction: ${request.agentType} agent cannot access this resource`,
        triggeredPolicyId: policy.id,
      };
    }

    if (
      rules.allowedResources &&
      !rules.allowedResources.some((res: string) =>
        request.url.includes(res)
      )
    ) {
      return {
        result: "blocked",
        reason: `Resource restriction: ${request.agentType} agent can only access specified resources`,
        triggeredPolicyId: policy.id,
      };
    }
  }

  // Check if the request involves escalatable scopes (write operations)
  // that require step-up authentication.
  if (requiresStepUp(request)) {
    return {
      result: "step_up_required",
      reason: `Write operation by ${request.agentType} agent requires user approval`,
    };
  }

  return {
    result: "allowed",
    reason: "All policies passed",
  };
}

/**
 * Determines if a request requires step-up authentication.
 *
 * Write operations (POST, PUT, PATCH, DELETE) to external APIs generally
 * require explicit user approval via CIBA, unless the agent has been
 * granted escalatable scopes and the user has pre-approved the action type.
 *
 * @param request - The proxy request to evaluate
 * @returns True if the request needs CIBA step-up auth
 */
function requiresStepUp(request: ProxyRequest): boolean {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (!writeMethods.includes(request.method.toUpperCase())) {
    return false;
  }

  const agentType = request.agentType as Exclude<AgentType, "supervisor">;
  const config = AGENT_SCOPE_CONFIG[agentType];
  if (!config) {
    return true;
  }

  // If the agent type has escalatable scopes defined and the request is
  // a write operation, require step-up authentication.
  if (config.escalatableScopes.length > 0) {
    return true;
  }

  return false;
}
