# AgenLens - Claude Code Instructions

## Project Overview

AgenLens is a multi-agent orchestration platform with built-in observability and granular access control, built for the "Authorized to Act" hackathon by Auth0. It uses Auth0 Token Vault to give each sub-agent scoped tokens, routes all API calls through an observability proxy, and provides users a real-time dashboard to monitor and control agent behavior.

**Read these files for full context:**
- `PRD.md` - Complete product requirements, features, architecture, data models, routes
- `hackathon-context.md` - Judging criteria, Auth0 capabilities, what we build vs what Auth0 already does

## Critical Context

This project exists to fill gaps that Auth0 Token Vault does NOT cover:
1. **Post-token-exchange visibility** - Auth0 hands off a token and has zero visibility into what happens next. We proxy all API calls to capture this.
2. **Per-sub-agent token scoping** - Auth0 issues tokens per connection, not per agent. We scope tokens down per sub-agent.
3. **User-facing control panel** - Auth0 has no end-user portal. We build one.

**Do NOT rebuild things Auth0 already handles:** OAuth flows, token storage, token refresh, CIBA push notifications, FGA engine, auth event logging. Use Auth0's SDKs and APIs for these.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **UI:** Tailwind CSS + shadcn/ui
- **Agent Orchestration:** LangGraph.js
- **Auth:** `@auth0/nextjs-auth0`
- **Token Vault:** `@auth0/ai-langchain` (withTokenVault, withAsyncAuthorization)
- **Database:** PostgreSQL via Prisma ORM
- **Real-time:** WebSockets (Socket.io)
- **Visualization:** React Flow for delegation chains
- **Deployment:** Vercel

## Code Standards

### General
- TypeScript strict mode. No `any` types unless absolutely unavoidable (and add a comment explaining why).
- All files must have a module-level JSDoc comment explaining what the file does and how it fits into the architecture.
- All exported functions must have JSDoc comments with `@param` and `@returns` descriptions.
- Use descriptive variable names. `agentActivity` not `aa`. `policyRule` not `pr`.
- Early returns to reduce nesting. No deeply nested if/else chains.
- Handle errors at boundaries. API routes catch and return proper HTTP errors. Internal functions propagate errors up.
- No dead code, no commented-out blocks, no TODOs without a linked issue or clear description.

### File Organization
```
agenlens/
  src/
    app/                    # Next.js App Router pages and layouts
      (auth)/               # Auth-related pages (login, callback)
      dashboard/            # Dashboard pages
        agents/             # Agent management views
        activity/           # Activity log and detail views
        policies/           # Policy management
        approvals/          # Step-up auth center
        connections/        # Connected accounts management
        analytics/          # Usage analytics
      chat/                 # Chat interface
      api/                  # API routes
        proxy/              # API proxy layer
        agents/             # Agent orchestration endpoints
        webhook/            # CIBA webhook
        activity/           # Activity CRUD
        policies/           # Policy CRUD
    lib/                    # Shared utilities and configuration
      auth0/                # Auth0 client setup, token vault helpers
      agents/               # LangGraph agent definitions
        supervisor.ts       # Supervisor agent
        calendar.ts         # Calendar sub-agent
        email.ts            # Email sub-agent
        github.ts           # GitHub sub-agent
        slack.ts            # Slack sub-agent
        drive.ts            # Drive sub-agent
      proxy/                # Proxy layer logic
        middleware.ts        # Request interception and policy checking
        logger.ts           # Activity logging
        policy-engine.ts    # Policy evaluation
      db/                   # Prisma client and helpers
      types/                # Shared TypeScript types
      utils/                # General utilities
    components/             # React components
      ui/                   # shadcn/ui base components
      dashboard/            # Dashboard-specific components
      chat/                 # Chat interface components
      agents/               # Agent-related components
      activity/             # Activity feed components
      policies/             # Policy management components
    hooks/                  # Custom React hooks
  prisma/
    schema.prisma           # Database schema
    migrations/             # Prisma migrations
  public/                   # Static assets
```

### API Routes
- All API routes go in `src/app/api/`.
- Use Next.js Route Handlers (not Pages API routes).
- Every route must validate auth (check session) before processing.
- Return consistent JSON shape: `{ data: T }` for success, `{ error: string, details?: any }` for errors.
- Use proper HTTP status codes.

### Agent Code
- Each sub-agent is a separate file in `src/lib/agents/`.
- Sub-agents must NEVER directly call third-party APIs. All calls go through the proxy.
- Sub-agents receive their scoped token config, not raw tokens.
- Agent tool definitions should clearly document what scopes they require.
- Use LangGraph's interrupt feature for CIBA step-up flows.

### Proxy Layer
- The proxy is the single point of contact between sub-agents and external APIs.
- Every request through the proxy must be logged to the database.
- Policy evaluation happens before the request is forwarded.
- Token injection happens in the proxy, not in the sub-agent.
- If the proxy cannot reach the database or policy engine, it MUST fail closed (block the request).

### Database
- Use Prisma for all database access.
- Migrations must be committed.
- Sanitize sensitive data before storage. Never store email bodies, file contents, or message text. Store metadata only (subjects, filenames, channel names, event titles).

### Frontend
- Use shadcn/ui components as the base. Do not build custom components when a shadcn equivalent exists.
- All dashboard pages should be responsive.
- Use React Server Components where possible. Client Components only when interactivity is needed.
- Real-time updates via WebSocket. The activity feed should update without page refresh.
- Human-readable descriptions everywhere. "Calendar Agent read event 'Design Sync'" not "GET /calendar/v3/calendars/primary/events/abc123".

### Security
- Never expose raw third-party tokens to the frontend.
- Never log full request/response bodies. Sanitize to metadata.
- Auth0 session must be validated on every API route and WebSocket connection.
- CIBA webhook endpoint must validate the Auth0 signature.
- Environment variables for all secrets. Never hardcode credentials.
- CSP headers on all pages.

### Documentation
- Every file must have a top-level comment explaining its purpose.
- Every exported function must have JSDoc.
- Complex logic blocks should have inline comments explaining the "why", not the "what".
- The README.md should contain setup instructions, architecture overview, and environment variable list.

### Testing
- Write tests for the proxy policy engine (this is the most critical path).
- Write tests for agent tool definitions (ensure correct scopes are declared).
- Integration tests for token exchange flows using Auth0 test tenant.
- Use Vitest as the test runner.

## Environment Variables

```
# Auth0
AUTH0_SECRET=
AUTH0_BASE_URL=
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# Auth0 Token Vault connections
AUTH0_GOOGLE_CONNECTION=google-oauth2
AUTH0_GITHUB_CONNECTION=github
AUTH0_SLACK_CONNECTION=slack

# Auth0 CIBA
AUTH0_CIBA_CLIENT_ID=
AUTH0_CIBA_CLIENT_SECRET=

# Auth0 FGA
FGA_STORE_ID=
FGA_MODEL_ID=
FGA_API_URL=

# Database
DATABASE_URL=

# Redis
REDIS_URL=

# OpenAI (for LLM backing the agents)
OPENAI_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
WEBSOCKET_URL=
```

## Git Practices

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- One logical change per commit.
- Branch naming: `feat/feature-name`, `fix/bug-name`
