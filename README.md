# AgenLens

Multi-agent orchestration platform with built-in observability and granular access control, powered by Auth0 Token Vault.

AgenLens solves two unsolved problems in the AI agent ecosystem:

1. **Post-token-exchange blindness** - Once Auth0 Token Vault hands a token to an agent, there is zero visibility into what happens next. AgenLens proxies every API call to capture exactly what agents do.
2. **Flat permission model in multi-agent systems** - When a supervisor delegates to sub-agents, every sub-agent inherits the same broad token. AgenLens scopes tokens per sub-agent so the Calendar Agent cannot read your email.

Built for the [Authorized to Act](https://authorizedtoact.devpost.com) hackathon by Auth0.

## Architecture

```
User Chat --> Supervisor Agent (LangGraph + Gemini 2.5 Pro)
                    |
    +---------------+---------------+---------------+
    |               |               |               |
Calendar Agent  Email Agent   GitHub Agent    Drive Agent
    |               |               |               |
    +---------------+---------------+---------------+
                    |
           AgenLens API Proxy
    (policy check -> step-up approval -> token inject -> forward -> log)
                    |
    +---------------+---------------+---------------+
    |               |               |               |
Google Calendar   Gmail        GitHub API     Google Drive
                    |
           Real-time Dashboard
    (activity feed, delegation chain, approvals, analytics)
```

## Features

- **5 specialized sub-agents** (Calendar, Email, GitHub, Slack, Drive) with 18 tools
- **API proxy layer** that intercepts every agent API call for logging and policy enforcement
- **Policy engine** with 5 rule types: allowlist, blocklist, rate limit, time restriction, resource restriction
- **In-app step-up approval** for sensitive actions (send email, create issue, post message)
- **Real-time dashboard** with live activity feed, delegation chain visualization, and analytics
- **Conversation memory** via LangGraph PostgresSaver checkpointer
- **Account linking** to connect multiple providers (Google + GitHub) to one user
- **Auto-refreshing tokens** using Google OAuth refresh tokens

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI | Tailwind CSS + shadcn/ui |
| Agent orchestration | LangGraph.js |
| LLM | Google Gemini 2.5 Pro (Vertex AI) |
| Auth | Auth0 (`@auth0/nextjs-auth0` v4) |
| Token management | Auth0 Token Vault + direct OAuth refresh |
| Database | PostgreSQL via Prisma ORM |
| Conversation memory | LangGraph PostgresSaver |

## Prerequisites

- Node.js 18+
- PostgreSQL
- Google Cloud account (for Vertex AI)
- Auth0 account (free tier)
- Google Cloud OAuth credentials
- GitHub OAuth app

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Aaryan126/AgenLens.git
cd AgenLens
npm install
```

### 2. Environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env
```

```env
# Auth0
AUTH0_SECRET=              # openssl rand -hex 32
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=     # https://YOUR_TENANT.us.auth0.com
AUTH0_DOMAIN=              # YOUR_TENANT.us.auth0.com
AUTH0_CLIENT_ID=           # From Auth0 app settings
AUTH0_CLIENT_SECRET=       # From Auth0 app settings

# Auth0 connections
AUTH0_GOOGLE_CONNECTION=google-oauth2
AUTH0_GITHUB_CONNECTION=github
AUTH0_SLACK_CONNECTION=slack

# Database
DATABASE_URL=postgresql://user@localhost:5432/agenlens

# Google OAuth (for direct token refresh)
GOOGLE_OAUTH_CLIENT_ID=    # From Google Cloud Console
GOOGLE_OAUTH_CLIENT_SECRET=# From Google Cloud Console

# Google Cloud Vertex AI
GOOGLE_CLOUD_PROJECT=      # Your GCP project ID
GOOGLE_CLOUD_LOCATION=us-central1

# App
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Auth0 setup

1. Create a Regular Web Application in Auth0
2. Set Allowed Callback URLs: `http://localhost:3000/auth/callback, http://localhost:3000/api/connect/callback`
3. Set Allowed Logout URLs: `http://localhost:3000`
4. Enable grant types: Authorization Code, Refresh Token, Token Vault
5. Set up Google social connection with Token Vault enabled ("Authentication and Connected Accounts for Token Vault")
6. Set up GitHub social connection with Token Vault enabled
7. Authorize the Management API for your app with `read:users` and `update:users` scopes

### 4. Google Cloud setup

1. Create a project in Google Cloud Console
2. Enable Google Calendar API, Gmail API, Google Drive API
3. Create OAuth credentials (Web application) with redirect URI: `https://YOUR_TENANT.auth0.com/login/callback`
4. Enable Vertex AI API
5. Authenticate locally: `gcloud auth application-default login`

### 5. Database

```bash
createdb agenlens
npx prisma db push
```

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

### Agent orchestration
A supervisor agent (powered by Gemini 2.5 Pro via LangGraph) receives user requests through a chat interface, decomposes them into sub-tasks, and delegates to specialized sub-agents. Each sub-agent has scoped tools that route through the proxy.

### Proxy layer
Every API call from a sub-agent passes through the proxy. The proxy evaluates policies, handles step-up approvals for sensitive actions, injects fresh OAuth tokens, forwards the request, and logs the full activity.

### Step-up approval
Write operations (send email, create issue, post message) trigger an in-app approval flow. The proxy pauses the request, creates a pending approval in the database, and the user sees an inline approval card in the chat or a toast notification on other pages.

### Dashboard
The real-time dashboard shows live activity, delegation chains, approval history, policy management, connected accounts, and analytics. Stats auto-refresh and the activity feed polls every 3 seconds.

## Project Structure

```
src/
  app/
    api/
      proxy/          # API proxy layer
      agents/chat/    # Chat endpoint (supervisor invocation)
      approvals/      # Step-up approval API
      activity/       # Activity log API
      policies/       # Policy CRUD API
      connections/    # Connection status API
      connect/        # Account linking flow
      stats/          # Dashboard stats API
      chat/messages/  # Chat persistence API
    dashboard/        # Dashboard pages
    chat/             # Chat interface
  lib/
    agents/           # LangGraph supervisor + tool definitions
    proxy/            # Proxy middleware, policy engine, logger
    auth0/            # Auth0 client configuration
    db/               # Prisma client
    types/            # TypeScript types
  components/
    dashboard/        # Dashboard components
    chat/             # Chat interface
    ui/               # shadcn/ui base components
```

## License

MIT
