# AgenLens - Environment Setup Guide

## Overview

This document covers how to set up all the environment variables and external services needed to run AgenLens locally.

---

## 1. Auth0 (Free Tier)

### Create Application
1. Sign up at [auth0.com](https://auth0.com)
2. Go to Applications > Create Application > "Regular Web Application"
3. In the Settings tab, grab:
   - **Client ID** > `AUTH0_CLIENT_ID`
   - **Client Secret** > `AUTH0_CLIENT_SECRET`
   - **Domain** > `AUTH0_ISSUER_BASE_URL` (prefix with `https://`, e.g. `https://dev-xxxxx.us.auth0.com`)
4. Generate a random secret for session encryption:
   ```bash
   openssl rand -hex 32
   ```
   Paste the output as `AUTH0_SECRET`
5. In the Settings tab, under "Application URIs":
   - **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
6. Save Changes

### Connect Google (covers Calendar, Gmail, Drive agents)
1. Go to [console.cloud.google.com](https://console.cloud.google.com) with a **secondary Google account** (recommended for safety since judges will test the app)
2. Create a new project named "AgenLens"
3. Enable these APIs (APIs & Services > Enable APIs):
   - Google Calendar API
   - Gmail API
   - Google Drive API
4. Set up OAuth Consent Screen:
   - User type: External
   - Add your secondary Google email as a test user (under Audience)
   - Add scopes (under Data Access):
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/drive.file`
5. Create OAuth Credentials:
   - Credentials > Create Credentials > OAuth client ID
   - Type: Web application
   - Authorized redirect URI: `https://YOUR_TENANT.auth0.com/login/callback`
   - Copy the Client ID and Client Secret
6. In Auth0 Dashboard > Authentication > Social > Google/Gmail:
   - Paste the Google Client ID and Client Secret
   - Enable the scopes listed above
   - Make sure the connection is enabled for your application

### Connect GitHub
1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. OAuth Apps > New OAuth App:
   - Application name: `AgenLens`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `https://YOUR_TENANT.auth0.com/login/callback`
3. Register, then generate a Client Secret
4. In Auth0 Dashboard > Authentication > Social > GitHub:
   - Paste Client ID and Client Secret
   - Default permissions (repo, user, read:org) are sufficient
   - Enable for your application

### Connect Slack (optional, can add later)
1. Create a Slack app at [api.slack.com](https://api.slack.com)
2. Add OAuth redirect URL: `https://YOUR_TENANT.auth0.com/login/callback`
3. Add scopes: `channels:read`, `chat:write`, `search:read`, `users:read`
4. In Auth0 Dashboard > Authentication > Social > Slack:
   - Paste Client ID and Client Secret
   - Enable for your application

### CIBA - Step-Up Auth (optional, add later)
- Requires Auth0 Guardian (push notifications) enabled
- `AUTH0_CIBA_CLIENT_ID` / `AUTH0_CIBA_CLIENT_SECRET` can be same app or a separate M2M app
- Skip initially; test without step-up auth first

### FGA - Fine-Grained Authorization (optional, add later)
- Available in Auth0 Dashboard under "Fine Grained Authorization"
- Free tier available
- Skip initially; policy engine works without it

---

## 2. Google AI / Gemini (LLM)

The supervisor agent uses Google Gemini (via LangChain) as the backing LLM.

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create an API key
3. Set `GOOGLE_API_KEY=your_key_here`

**Cost**: Gemini has a generous free tier. Flash models are free up to rate limits.

---

## 3. PostgreSQL (Free, Local)

```bash
# Install (macOS)
brew install postgresql@17
brew services start postgresql@17

# Create database
createdb agenlens

# Push schema
npx prisma db push
```

`DATABASE_URL` is pre-configured as `postgresql://aaryan@localhost:5432/agenlens`

---

## 4. Redis (Free, Local, Optional)

Only needed for future WebSocket pub/sub. Not critical for initial dev.

```bash
brew install redis
brew services start redis
```

`REDIS_URL` is pre-configured as `redis://localhost:6379`

---

## Final .env Template

```env
# Auth0
AUTH0_SECRET=<openssl rand -hex 32>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://YOUR_TENANT.us.auth0.com
AUTH0_CLIENT_ID=<from Auth0 app settings>
AUTH0_CLIENT_SECRET=<from Auth0 app settings>

# Auth0 Token Vault connections
AUTH0_GOOGLE_CONNECTION=google-oauth2
AUTH0_GITHUB_CONNECTION=github
AUTH0_SLACK_CONNECTION=slack

# Auth0 CIBA (optional)
AUTH0_CIBA_CLIENT_ID=
AUTH0_CIBA_CLIENT_SECRET=

# Auth0 FGA (optional)
FGA_STORE_ID=
FGA_MODEL_ID=
FGA_API_URL=

# Database
DATABASE_URL=postgresql://aaryan@localhost:5432/agenlens

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Google AI (LLM backing the agents)
GOOGLE_API_KEY=<from aistudio.google.com>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEBSOCKET_PORT=3001
```

---

## Startup Order

1. Fill in Auth0 vars (SECRET, ISSUER_BASE_URL, CLIENT_ID, CLIENT_SECRET)
2. Set up Google, GitHub social connections in Auth0
3. Get Gemini API key (GOOGLE_API_KEY)
4. Start PostgreSQL, create `agenlens` database, run `npx prisma db push`
5. `npm run dev`

---

## Cost Summary

| Service | Cost |
|---------|------|
| Auth0 | Free (free tier, 25k MAUs) |
| Google Cloud OAuth | Free (just credentials) |
| GitHub OAuth | Free |
| Slack OAuth | Free |
| PostgreSQL | Free (local) |
| Redis | Free (local) |
| Gemini API | Free tier available |

**Everything is free for development and demo purposes.**
