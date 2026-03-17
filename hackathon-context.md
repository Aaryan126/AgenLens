# Hackathon Context - Authorized to Act

This document provides context for the "Authorized to Act" hackathon so that anyone working on this project understands the competition requirements, judging criteria, and the technical landscape we are building within.

---

## Hackathon Overview

- **Name:** Authorized to Act Hackathon
- **Platform:** Devpost (authorizedtoact.devpost.com)
- **Requirement:** All submissions MUST use the Token Vault feature of Auth0 for AI Agents
- **Prize Pool:** $10,000 in cash + additional prizes
- **Bonus:** Blog post submission (250+ words about Token Vault achievement) for additional prizes

---

## Judging Criteria (Weighted Equally)

### 1. Security Model
- Does the agent operate within explicit permission boundaries?
- Are credentials protected and access properly scoped?
- Are high-stakes actions identified and protected?
- Is step-up authentication used where it matters?

**How AgenLens addresses this:**
- Per-sub-agent token scoping via Token Vault (least privilege)
- API proxy layer ensures sub-agents never hold raw tokens
- CIBA step-up auth for any sensitive/escalated action
- Runtime policy enforcement blocks out-of-scope requests
- Fail-closed proxy design

### 2. User Control
- Can users understand what permissions the agent has?
- How was consent granted?
- Are scopes and access boundaries clearly defined?

**How AgenLens addresses this:**
- User-facing dashboard showing every agent's permissions in plain English
- Live activity feed showing exactly what agents are doing in real-time
- Per-agent policy rules users can create and modify
- Delegation chain visualization tracing any action back to the user's original request
- Connected account management with scope visibility

### 3. Technical Execution
- Quality implementation of Token Vault and related patterns
- Is it production-aware?

**How AgenLens addresses this:**
- Deep Token Vault usage: multiple provider connections, per-agent scoped exchange, automatic refresh
- CIBA integration with Rich Authorization Requests
- FGA for fine-grained policy enforcement
- LangGraph for production-grade multi-agent orchestration
- PostgreSQL for persistent activity logging
- WebSocket real-time updates
- Proper error handling, fail-closed design, sanitized data storage

### 4. Design
- Is the UX well thought out?
- Balanced blend of frontend and backend?

**How AgenLens addresses this:**
- Polished dashboard with shadcn/ui component library
- Real-time activity feed with human-readable action descriptions
- Interactive delegation chain visualization (D3/React Flow)
- Chat interface for natural agent interaction
- Responsive design, clear information hierarchy
- Substantial backend (proxy layer, policy engine, multi-agent orchestration)

### 5. Potential Impact
- Impact on AI Developer community
- Impact beyond target community

**How AgenLens addresses this:**
- Solves two problems that affect every developer building multi-agent systems
- The proxy + observability pattern is reusable and framework-agnostic
- Per-agent scoping pattern demonstrates what Token Vault should natively support
- Applicable to enterprise security, compliance, and governance use cases

### 6. Insight Value
- Useful patterns, pain points, or gaps surfaced
- Informs how agent authorization should evolve

**How AgenLens addresses this:**
- Demonstrates the post-token-exchange visibility gap
- Shows that Token Vault needs per-agent scoping primitives (not just per-connection)
- Proves that users need task-level consent, not app-level consent
- Surfaces the pattern that API proxy layers are necessary for agent observability
- Highlights that delegation chains need to be first-class in auth systems

---

## Auth0 for AI Agents - Technical Capabilities

### Token Vault
- Secure credential storage built on OAuth 2.0 Token Exchange (RFC 8693)
- Stores access and refresh tokens for external providers after user consent
- Exchanges Auth0 tokens for fresh external provider access tokens on demand
- Automatically refreshes expired tokens
- 30+ pre-integrated providers: Google, GitHub, Slack, Microsoft, Spotify, Dropbox, Salesforce, Figma, Discord, etc.
- Supports any custom OAuth 2.0 / OIDC provider

**Token Exchange API:**
```
POST https://{domain}/oauth/token
{
  "client_id": "<CLIENT_ID>",
  "client_secret": "<CLIENT_SECRET>",
  "subject_token": "<AUTH0_ACCESS_TOKEN>",
  "grant_type": "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
  "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "requested_token_type": "http://auth0.com/oauth/token-type/federated-connection-access-token",
  "connection": "google-oauth2"
}
```

### CIBA (Client-Initiated Backchannel Authentication)
- Async authorization: agent sends request, user gets push notification, approves/denies
- Rich Authorization Requests (RAR) for structured permission descriptions
- Auth0 Guardian for push notifications
- Polling-based flow: agent backend polls `/token` for user decision
- Supports pre-authorized trust envelopes

### FGA (Fine-Grained Authorization)
- ReBAC engine based on Google Zanzibar
- Model agent-resource relationships
- Document-level access control for RAG
- Dynamic relationship management

### SDKs
- **JavaScript:** `@auth0/ai`, `@auth0/ai-langchain`, `@auth0/ai-vercel`, `@auth0/ai-llamaindex`
- **Python:** `auth0-ai-langchain`, `auth0-ai-vercel`
- **React:** `@auth0/ai-components` for auth flow UI components
- **Storage:** `@auth0/ai-redis` for credential/auth request storage

### Connected Accounts Flow
1. User authenticates via Auth0
2. App triggers Connected Accounts flow redirecting to external provider
3. User authorizes specific scopes
4. Auth0 receives and stores tokens in Token Vault
5. Agent exchanges Auth0 token for provider token via Token Exchange API
6. Agent uses provider token to call third-party APIs

### What Auth0 Logs (We Do NOT Duplicate)
- `secte`: Successful custom token exchange
- `fecte`: Failed custom token exchange
- Standard auth events (login, logout, MFA, etc.)

### What Auth0 Does NOT Provide (This Is What We Build)
- No visibility into what agents do with tokens after exchange
- No per-sub-agent token scoping in multi-agent systems
- No user-facing dashboard for agent activity monitoring
- No runtime policy enforcement at the API call level
- No delegation chain tracing
- No agent-specific activity narratives
- No user-defined permission policies per sub-agent
- No live activity feed

---

## Submission Requirements Checklist

- [ ] Text description explaining features and functionality
- [ ] Demo video (~3 minutes, publicly hosted on YouTube/Vimeo)
- [ ] Public code repository with source code, assets, and setup instructions
- [ ] Published link to project/application
- [ ] Bonus: Blog post (250+ words) about Token Vault achievement

---

## Previous Winners (Auth0 AI Agents Challenge on DEV)

For reference, past winners and what they built:

1. **ESG Copilot:** Token Vault for API keys (Climatiq, SendGrid, Pinecone), OpenFGA for fine-grained auth
2. **@async_dime:** Enterprise AI assistant managing Gmail, Google Calendar, web search, documents via Auth0
3. **Assistant0:** CIBA for high-risk operations (purchases, email sending), requiring explicit user approval

AgenLens differentiates by solving the post-exchange visibility gap and per-agent scoping, which none of these addressed.
