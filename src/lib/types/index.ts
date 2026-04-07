/**
 * Shared TypeScript types for AgenLens.
 *
 * Central type definitions used across the agent orchestration layer,
 * API proxy, dashboard, and database models.
 */

/** The specialized sub-agent types available in the system. */
export type AgentType =
  | "supervisor"
  | "calendar"
  | "email"
  | "github"
  | "drive";

/** Result of the proxy policy engine evaluating a request. */
export type PolicyResult = "allowed" | "blocked" | "step_up_required";

/** Current state of a CIBA step-up authentication request. */
export type StepUpStatus = "pending" | "approved" | "denied" | "expired";

/** Status of a connected third-party account. */
export type ConnectionStatus = "active" | "revoked";

/** Policy rule types that users can configure per agent. */
export type PolicyType =
  | "allowlist"
  | "blocklist"
  | "rate_limit"
  | "time_restriction"
  | "resource_restriction";

/**
 * A single activity log entry captured by the API proxy.
 * Represents one API call made by a sub-agent to an external service.
 */
export interface AgentActivity {
  id: string;
  userId: string;
  sessionId: string;
  /** Groups all sub-agent actions triggered by one user request. */
  requestId: string;
  agentType: AgentType;
  /** Human-readable description, e.g. "Read event 'Design Sync 2pm'" */
  action: string;
  targetService: string;
  httpMethod: string;
  endpoint: string;
  /** Sanitized request metadata (no sensitive content). */
  requestSummary: Record<string, unknown> | null;
  responseStatus: number;
  /** Sanitized response metadata. */
  responseSummary: Record<string, unknown> | null;
  scopesUsed: string[];
  policyResult: PolicyResult;
  /** CIBA auth_req_id if step-up was triggered. */
  stepUpId: string | null;
  stepUpResult: StepUpStatus | null;
  durationMs: number;
  createdAt: Date;
}

/**
 * A user-defined policy rule for a specific sub-agent.
 * Evaluated by the proxy before forwarding API requests.
 */
export interface AgentPolicy {
  id: string;
  userId: string;
  agentType: AgentType;
  policyType: PolicyType;
  /** Policy-specific rule configuration. Structure varies by policyType. */
  rules: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A user's connected third-party account managed via Auth0 Connected Accounts.
 */
export interface ConnectedAccount {
  id: string;
  userId: string;
  provider: string;
  connectionName: string;
  scopesGranted: string[];
  connectedAt: Date;
  lastUsedAt: Date;
  status: ConnectionStatus;
}

/**
 * A CIBA step-up authentication event.
 * Created when the proxy determines a sub-agent action needs explicit user approval.
 */
export interface StepUpEvent {
  id: string;
  userId: string;
  activityId: string;
  agentType: AgentType;
  actionDescription: string;
  cibaAuthReqId: string;
  status: StepUpStatus;
  requestedAt: Date;
  resolvedAt: Date | null;
  tokenExpiresAt: Date | null;
}

/**
 * Configuration for a sub-agent's Token Vault connection.
 * Defines which provider and scopes the sub-agent is authorized to use.
 */
export interface AgentTokenConfig {
  agentType: AgentType;
  connection: string;
  scopes: string[];
}

/**
 * A proxied API request before it is forwarded to the external service.
 * Used internally by the proxy layer for logging and policy evaluation.
 */
export interface ProxyRequest {
  agentType: AgentType;
  targetService: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  sessionId: string;
  requestId: string;
  userId: string;
}

/**
 * The response from the proxy after forwarding a request.
 */
export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
}

/**
 * Real-time event emitted via WebSocket to the dashboard.
 */
export interface ActivityEvent {
  type: "activity" | "step_up" | "policy_violation" | "agent_status";
  data: AgentActivity | StepUpEvent | { agentType: AgentType; status: string };
}

/**
 * Scope definitions for each sub-agent.
 * Maps agent types to their default and escalatable scopes per provider.
 */
export const AGENT_SCOPE_CONFIG: Record<
  Exclude<AgentType, "supervisor">,
  {
    connection: string;
    defaultScopes: string[];
    escalatableScopes: string[];
    displayName: string;
    description: string;
    icon: string;
  }
> = {
  calendar: {
    connection: "google-oauth2",
    defaultScopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    escalatableScopes: ["https://www.googleapis.com/auth/calendar.events"],
    displayName: "Calendar Agent",
    description: "Reads and manages Google Calendar events",
    icon: "calendar",
  },
  email: {
    connection: "google-oauth2",
    defaultScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    escalatableScopes: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
    displayName: "Email Agent",
    description: "Reads and manages Gmail messages",
    icon: "mail",
  },
  github: {
    connection: "github",
    defaultScopes: ["repo:status", "public_repo"],
    escalatableScopes: ["repo", "write:issues", "write:pull_requests"],
    displayName: "GitHub Agent",
    description: "Reads repos, issues, and pull requests",
    icon: "github",
  },
  drive: {
    connection: "google-oauth2",
    defaultScopes: ["https://www.googleapis.com/auth/drive.readonly"],
    escalatableScopes: ["https://www.googleapis.com/auth/drive.file"],
    displayName: "Drive Agent",
    description: "Reads and manages Google Drive files",
    icon: "hard-drive",
  },
};
