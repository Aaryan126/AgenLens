# AgenLens - Product Requirements Document

## Overview

AgenLens is a multi-agent orchestration platform with built-in observability and granular access control. It solves two unsolved problems in the AI agent ecosystem:

1. **Post-token-exchange blindness:** Once Auth0 Token Vault hands a third-party token to an agent, there is zero visibility into what the agent does with it. No one (not Auth0, not the user, not the developer) can see which API endpoints were called, what data was accessed, or what actions were taken.

2. **Flat permission model in multi-agent systems:** When a supervisor agent delegates to sub-agents, every sub-agent inherits the same broad token. There is no mechanism to scope down permissions per sub-agent or trace a delegation chain.

AgenLens fills both gaps with an API proxy layer, per-sub-agent token scoping via Auth0 Token Vault, and a real-time user-facing dashboard.

---

## Problem Statement

### The Current State

- A user authorizes an AI agent to access their Google account. The agent receives a token with `calendar`, `gmail`, and `drive` scopes.
- The agent spawns sub-agents for different tasks. Every sub-agent gets the same full-access token.
- The Calendar sub-agent could technically read your emails. The Email sub-agent could delete your Drive files.
- Nobody can see what actually happened. Auth0 logs the token exchange event, but nothing after that.
- 82% of companies report AI agents acting outside expected boundaries (Gravitee, 2025).
- 53% of MCP servers use insecure static credentials (Astrix Security, 2025).
- There is no user-facing portal in Auth0 for end users to see or manage agent permissions.

### What Auth0 Token Vault Already Handles (We Do NOT Rebuild These)

- OAuth flows with 30+ pre-integrated providers (Google, GitHub, Slack, etc.)
- Secure token storage and automatic refresh
- Token exchange via RFC 8693
- CIBA (Client-Initiated Backchannel Authentication) for async human-in-the-loop approval
- Auth event logging (`secte`/`fecte` event codes for token exchange)
- Fine-Grained Authorization (FGA) engine
- Rich Authorization Requests (RAR)
- Admin-side consent revocation

### What Auth0 Does NOT Provide (This Is What We Build)

- Visibility into what agents do with tokens after exchange
- Per-sub-agent token scoping in multi-agent systems
- User-facing dashboard for monitoring agent activity
- Runtime policy enforcement at the API call level
- Delegation chain tracing (User -> Supervisor -> Sub-Agent -> API)
- Agent-specific activity narratives ("Calendar Agent read your 2pm event")
- User-defined permission policies per sub-agent
- Live activity feed showing real-time agent actions

---

## Target Users

1. **End Users:** Professionals who use AI agents to manage their work across multiple platforms. They want to know what their agents are doing and maintain control.
2. **Developers:** Engineers building multi-agent systems who need a framework for scoped delegation and observability.
3. **Security-Conscious Organizations:** Teams that need audit trails and policy enforcement for agent actions.

---

## Core Architecture

```
User Request
    |
    v
+------------------+
|  Supervisor Agent |  (LangGraph orchestrator)
+------------------+
    |          |          |          |          |
    v          v          v          v          v
+--------+ +--------+ +--------+ +--------+ +--------+
|Calendar| | Email  | | GitHub | | Slack  | | Drive  |
| Agent  | | Agent  | | Agent  | | Agent  | | Agent  |
+--------+ +--------+ +--------+ +--------+ +--------+
    |          |          |          |          |
    | (scoped tokens from Token Vault per agent)
    |          |          |          |          |
    v          v          v          v          v
+------------------------------------------------------+
|              AgenLens API Proxy Layer                 |
|  - Logs every request (endpoint, method, payload)    |
|  - Enforces runtime policies                         |
|  - Triggers CIBA step-up when needed                 |
|  - Blocks unauthorized actions                       |
+------------------------------------------------------+
    |          |          |          |          |
    v          v          v          v          v
  Google     Google     GitHub    Slack     Google
 Calendar    Gmail       API       API      Drive
   API        API
```

```
+------------------------------------------------------+
|           AgenLens User Dashboard                    |
|                                                      |
|  +------------------+  +-------------------------+   |
|  | Live Activity    |  | Agent Permission Cards  |   |
|  | Feed             |  |                         |   |
|  | - Real-time logs |  | Calendar Agent: read    |   |
|  | - API calls      |  | Email Agent: read       |   |
|  | - Data accessed  |  | GitHub Agent: read/write|   |
|  +------------------+  +-------------------------+   |
|                                                      |
|  +------------------+  +-------------------------+   |
|  | Delegation Chain |  | Policy Rules Engine     |   |
|  | Visualization    |  |                         |   |
|  | - Tree view      |  | - Per-agent rules       |   |
|  | - Request trace  |  | - Action allowlists     |   |
|  +------------------+  +-------------------------+   |
|                                                      |
|  +--------------------------------------------------+|
|  | Step-Up Auth History                              ||
|  | - CIBA triggers, approvals, denials               ||
|  +--------------------------------------------------+|
+------------------------------------------------------+
```

---

## Features

### F1: Multi-Agent Orchestration with Per-Agent Token Scoping

**Description:** A supervisor agent receives user requests and delegates to specialized sub-agents. Each sub-agent gets its own scoped token from Auth0 Token Vault with only the permissions it needs.

**Sub-Agents:**

| Sub-Agent | Provider | Token Vault Connection | Scopes | Capabilities |
|---|---|---|---|---|
| Calendar Agent | Google | `google-oauth2` | `calendar.readonly`, `calendar.events` | Read events, check availability, create/modify events |
| Email Agent | Google | `google-oauth2` | `gmail.readonly`, `gmail.send`, `gmail.modify` | Search emails, read threads, draft/send emails, manage labels |
| GitHub Agent | GitHub | `github` | `repo`, `issues`, `pull_requests` | Read repos, list PRs/issues, create issues, review PRs, read code |
| Slack Agent | Slack | `slack` | `channels:read`, `chat:write`, `search:read`, `users:read` | Search messages, read channels, post messages, find users |
| Drive Agent | Google | `google-oauth2` | `drive.readonly`, `drive.file` | Search files, read documents, upload files, share files |

**Key Behavior:**
- Supervisor analyzes the request and determines which sub-agents are needed
- Each sub-agent is initialized with a Token Vault connection scoped to its minimum required permissions
- Sub-agents cannot access services or scopes outside their designation
- Supervisor aggregates results and synthesizes a response

**Example Flows:**

*"Prep me for my 2pm meeting with the design team"*
1. Calendar Agent reads the 2pm event (attendees, agenda, location)
2. Email Agent searches recent threads with attendees
3. GitHub Agent pulls PRs/issues from the linked project repo
4. Slack Agent searches relevant channel history for context
5. Drive Agent finds shared docs linked in the calendar event
6. Supervisor compiles a meeting brief with all context

*"Summarize what happened this week on Project Atlas"*
1. GitHub Agent lists merged PRs, open issues, recent commits
2. Slack Agent searches #project-atlas channel for discussions
3. Email Agent finds emails mentioning "Project Atlas"
4. Calendar Agent lists meetings related to the project
5. Supervisor synthesizes a weekly digest

*"Draft a response to Sarah's email about the API redesign and schedule a follow-up"*
1. Email Agent finds and reads Sarah's email
2. GitHub Agent pulls relevant PRs/issues about the API redesign
3. Email Agent drafts a response (triggers step-up auth for send)
4. Calendar Agent checks availability and proposes meeting times (triggers step-up for create)

### F2: API Proxy Layer

**Description:** All third-party API calls from sub-agents route through the AgenLens proxy. This is the core innovation that provides post-token-exchange visibility.

**What the Proxy Captures Per Request:**
- Timestamp
- Sub-agent identity (which agent made the call)
- Target API (Google Calendar, Gmail, GitHub, Slack, Google Drive)
- HTTP method and endpoint
- Request payload summary (sanitized, no sensitive content stored)
- Response status code
- Response payload summary
- Token scopes used
- Delegation chain (which user request triggered this)
- Latency

**Runtime Policy Enforcement:**
- The proxy checks every outgoing request against the sub-agent's policy rules before forwarding
- If a request violates policy, it is blocked and logged as a policy violation
- If a request requires elevated permissions, the proxy triggers CIBA step-up auth
- Blocked requests are visible in the dashboard with the reason

**Proxy Architecture:**
- Runs as a middleware layer within the Next.js API routes
- Each sub-agent is configured to use the proxy URL instead of direct API endpoints
- The proxy adds the appropriate auth headers from Token Vault before forwarding
- Zero-trust: the sub-agents themselves never hold raw tokens; the proxy injects them per-request

### F3: Real-Time User Dashboard

**Description:** A web dashboard where end users see everything their agents are doing, in real-time.

#### F3.1: Live Activity Feed
- WebSocket-driven real-time feed of all agent actions
- Each entry shows: timestamp, sub-agent name, action description in plain English, target service, status (success/blocked/pending approval)
- Human-readable descriptions, not raw API calls. "Calendar Agent read event 'Design Sync 2pm'" not "GET /calendar/v3/calendars/primary/events/abc123"
- Color-coded by sub-agent for quick scanning
- Filterable by sub-agent, service, action type, time range
- Searchable

#### F3.2: Agent Permission Cards
- One card per sub-agent showing:
  - Name and avatar/icon
  - Connected service(s)
  - Current scopes (human-readable)
  - Status (active/paused/revoked)
  - Toggle to pause or revoke the agent
  - Link to policy rules for this agent
  - Last active timestamp
  - Request count (total API calls made)

#### F3.3: Delegation Chain Visualization
- Interactive tree/graph view showing the full delegation chain
- Top level: User's original request
- Second level: Supervisor's task decomposition
- Third level: Sub-agent API calls
- Click any node to see full details
- Visual indicators for blocked actions and step-up auth events

#### F3.4: Policy Rules Engine
- User-facing UI to create and manage per-agent policies
- Policy types:
  - **Action allowlist:** "Calendar Agent can only read events, never create or delete"
  - **Action blocklist:** "Email Agent can never delete emails"
  - **Resource restrictions:** "GitHub Agent can only access repos in the 'myorg' organization"
  - **Rate limits:** "Slack Agent can post at most 10 messages per hour"
  - **Time restrictions:** "No agent actions outside business hours"
  - **Data sensitivity rules:** "Never access emails with subject containing 'confidential'"
- Policies are enforced by the proxy layer in real-time
- Policy violations are logged and visible in the activity feed

#### F3.5: Step-Up Auth Center
- History of all CIBA step-up authentication events
- Each entry shows: what the agent wanted to do, when it was requested, whether it was approved or denied, response time
- Pending approvals prominently displayed
- Quick-action buttons to approve/deny from the dashboard (in addition to push notifications)
- Analytics: approval rate, most common step-up triggers, average response time

#### F3.6: Analytics & Insights
- Agent usage over time (API calls per day/week)
- Most accessed services and endpoints
- Policy violation trends
- Step-up auth patterns
- Per-agent activity breakdown
- Token refresh frequency

### F4: Step-Up Authentication with CIBA

**Description:** When a sub-agent needs to perform a sensitive action that exceeds its current scope or violates policy, AgenLens triggers Auth0 CIBA to get explicit user approval.

**Step-Up Triggers:**
- Sub-agent requests an action outside its current scopes (e.g., Email Agent wants to send, but only has `gmail.readonly`)
- Action matches a policy rule requiring approval (e.g., "always ask before creating calendar events")
- Action involves data modification (create, update, delete) on any service
- Action involves sending communications (emails, Slack messages)
- Action involves financial or sensitive data access

**Flow:**
1. Sub-agent requests an action through the proxy
2. Proxy determines step-up is required (scope escalation or policy rule)
3. Proxy initiates CIBA request to Auth0 `/bc-authorize` with Rich Authorization Request describing the exact action
4. User receives push notification via Auth0 Guardian (or in-dashboard notification)
5. Notification contains human-readable description: "Email Agent wants to send an email to sarah@company.com. Subject: 'Re: API Redesign Discussion'. [Approve] [Deny]"
6. If approved: Token Vault issues a short-lived, narrowly-scoped token. The proxy forwards the request. Token expires after use.
7. If denied: Proxy blocks the request. Sub-agent receives a denial. Supervisor adjusts its plan.
8. Everything is logged in the Step-Up Auth Center.

### F5: Connected Accounts Management

**Description:** User-facing interface to manage which third-party accounts are connected and available to agents.

- Connect/disconnect Google, GitHub, Slack accounts via Auth0 Connected Accounts flow
- See which agents have access to which connections
- Per-connection scope visibility
- Revoke a connection (removes all agent access to that service)
- Re-authorize with different scopes

### F6: Agent Conversation Interface

**Description:** A chat interface where users interact with the supervisor agent.

- Natural language input
- Streaming responses as the supervisor works
- Inline status indicators showing which sub-agents are active
- Expandable detail cards showing what each sub-agent found
- Ability to interrupt or redirect mid-task
- Conversation history with full activity replay

---

## Technical Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | Dashboard, chat UI, auth flows |
| UI Components | Tailwind CSS + shadcn/ui | Consistent, polished design system |
| Real-time | WebSockets (Socket.io or Pusher) | Live activity feed, agent status |
| Agent Framework | LangGraph.js | Multi-agent orchestration with state management |
| Auth | Auth0 Next.js SDK (`@auth0/nextjs-auth0`) | User authentication |
| Token Vault | `@auth0/ai-langchain` | Per-agent scoped token exchange |
| Async Auth | Auth0 CIBA + Guardian | Step-up authentication |
| FGA | Auth0 FGA SDK | Fine-grained authorization policies |
| Database | PostgreSQL (via Prisma) | Activity logs, policies, user preferences |
| Caching | Redis | Session state, rate limiting, real-time pub/sub |
| API Proxy | Next.js API routes + custom middleware | Request interception, logging, policy enforcement |
| Visualization | D3.js or React Flow | Delegation chain graphs |
| Deployment | Vercel | Hosting, serverless functions |

---

## Auth0 Integration Points

### Token Vault Usage
- **Connected Accounts:** Google (Calendar, Gmail, Drive), GitHub, Slack
- **Token Exchange:** Each sub-agent exchanges Auth0 tokens for provider-specific tokens scoped to its needs
- **Automatic Refresh:** Token Vault handles refresh token rotation transparently
- **Per-Agent Scoping:** Different sub-agents request different scopes for the same connection

### CIBA Integration
- **Trigger Points:** Scope escalation, policy violations, sensitive actions
- **Rich Authorization Requests:** Structured payloads describing the exact action for user review
- **Guardian Push:** Mobile notifications for approval/denial
- **Dashboard Fallback:** In-app approval for users without Guardian

### FGA Integration
- **Agent-Resource Relationships:** Model which agents can access which resources
- **Policy Enforcement:** FGA checks before API calls are proxied
- **Dynamic Updates:** Users can modify permissions in real-time through the dashboard

---

## Data Models

### AgentActivity
```
id: uuid
user_id: string
session_id: string
request_id: string (groups all sub-agent actions for one user request)
agent_type: enum (supervisor, calendar, email, github, slack, drive)
action: string (human-readable description)
target_service: string
http_method: string
endpoint: string
request_summary: json (sanitized)
response_status: number
response_summary: json (sanitized)
scopes_used: string[]
policy_result: enum (allowed, blocked, step_up_required)
step_up_id: string? (CIBA auth_req_id if step-up was triggered)
step_up_result: enum? (approved, denied, pending, expired)
duration_ms: number
created_at: timestamp
```

### AgentPolicy
```
id: uuid
user_id: string
agent_type: enum
policy_type: enum (allowlist, blocklist, rate_limit, time_restriction, resource_restriction)
rules: json
enabled: boolean
created_at: timestamp
updated_at: timestamp
```

### ConnectedAccount
```
id: uuid
user_id: string
provider: string
connection_name: string
scopes_granted: string[]
connected_at: timestamp
last_used_at: timestamp
status: enum (active, revoked)
```

### StepUpEvent
```
id: uuid
user_id: string
activity_id: string (references AgentActivity)
agent_type: enum
action_description: string
ciba_auth_req_id: string
status: enum (pending, approved, denied, expired)
requested_at: timestamp
resolved_at: timestamp?
token_expires_at: timestamp?
```

---

## Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Project overview, login |
| `/dashboard` | Main Dashboard | Activity feed, agent cards, quick stats |
| `/dashboard/agents` | Agent Management | Detailed view of all sub-agents and their permissions |
| `/dashboard/agents/[type]` | Agent Detail | Single agent's activity, policies, connected accounts |
| `/dashboard/activity` | Activity Log | Full searchable, filterable activity history |
| `/dashboard/activity/[requestId]` | Request Detail | Delegation chain view for a single user request |
| `/dashboard/policies` | Policy Manager | Create, edit, toggle per-agent policies |
| `/dashboard/approvals` | Step-Up Center | Pending approvals, history, analytics |
| `/dashboard/connections` | Connected Accounts | Manage third-party connections |
| `/dashboard/analytics` | Analytics | Usage charts, trends, insights |
| `/chat` | Agent Chat | Conversational interface with the supervisor agent |
| `/api/proxy/[...path]` | API Proxy | Proxy endpoint for all sub-agent API calls |
| `/api/agents/[action]` | Agent API | Endpoints for agent orchestration |
| `/api/webhook/ciba` | CIBA Webhook | Receives CIBA callback from Auth0 |
| `/api/activity` | Activity API | CRUD for activity logs |
| `/api/policies` | Policy API | CRUD for agent policies |

---

## Non-Functional Requirements

- **Latency:** Proxy layer should add no more than 50ms overhead per API call
- **Real-time:** Activity feed updates within 500ms of an agent action
- **Security:** Raw third-party tokens never exposed to the frontend or stored in client-accessible storage
- **Privacy:** Request/response payloads are sanitized before storage (no email bodies, no file contents, only metadata)
- **Scalability:** Support concurrent sub-agent execution (5+ agents in parallel)
- **Reliability:** If the proxy is down, agent actions are blocked (fail-closed, not fail-open)

---

## Success Metrics (Hackathon Judging Alignment)

| Judging Criterion | How AgenLens Addresses It |
|---|---|
| **Security Model** | Per-agent least-privilege tokens, proxy-enforced policy boundaries, CIBA step-up for sensitive actions, fail-closed proxy, zero raw token exposure to sub-agents |
| **User Control** | User-facing dashboard with full visibility, per-agent pause/revoke, custom policy rules, connected account management, in-dashboard approval flow |
| **Technical Execution** | Deep Token Vault integration (multiple connections, per-agent scoping, token exchange), CIBA, FGA, LangGraph multi-agent orchestration, real-time WebSocket dashboard, API proxy with policy engine |
| **Design** | Polished Next.js dashboard with shadcn/ui, real-time activity feed, delegation chain visualization, responsive design, clear information hierarchy |
| **Potential Impact** | Solves two unsolved problems in the AI agent ecosystem (post-exchange visibility, sub-agent scoping). Applicable to any multi-agent system, not just this demo. |
| **Insight Value** | Demonstrates that Token Vault needs per-agent scoping primitives, that post-exchange observability is the biggest gap in agent auth, and that users need task-level (not app-level) consent management |
