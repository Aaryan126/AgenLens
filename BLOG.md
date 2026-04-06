# Building AgenLens: What Happens After the Token Exchange?

Auth0 Token Vault is great at one thing: securely getting your agents the tokens they need. OAuth flows, token storage, automatic refresh, 30+ pre-integrated providers. It handles all of that.

But what happens after the token is handed off?

That question is what led me to build AgenLens.

## The gap nobody talks about

When I started building multi-agent systems, I hit a problem that no existing tool solved. My supervisor agent would delegate tasks to sub-agents. A calendar agent, an email agent, a GitHub agent. Each one got the same Google token with broad scopes. The calendar agent could technically read my emails. The email agent could access my Drive files. And I had no idea what any of them were actually doing.

Auth0 logs the token exchange event itself. But after that? Silence. The token leaves the vault and enters a black box.

82% of companies report AI agents acting outside expected boundaries. That statistic stopped being abstract once I watched my own agents make API calls I never intended.

## What I built

AgenLens sits between your agents and the APIs they call. Every request goes through a proxy layer that does three things:

1. **Checks policies** before the request is forwarded. Is this agent allowed to call this endpoint? Has it exceeded its rate limit? Is it within business hours?

2. **Requires approval** for sensitive actions. Want to send an email? Create a GitHub issue? The agent pauses and asks you first, right in the chat interface.

3. **Logs everything** in human-readable form. Not "GET /calendar/v3/calendars/primary/events" but "Calendar Agent read your upcoming events." Every action is visible in a real-time dashboard.

The agents themselves never touch raw tokens. The proxy injects them per-request. If a sub-agent's code gets compromised, it has no credentials to leak.

## What I learned about Token Vault

Building with Token Vault surfaced patterns I think are worth sharing with the Auth0 team:

**Token Vault needs per-agent scoping primitives.** Right now, tokens are issued per connection. If you have five agents all accessing Google, they all get the same token. AgenLens works around this by scoping at the proxy layer, but it would be cleaner if Token Vault could issue differently-scoped tokens for the same connection.

**Post-exchange observability should be a first-class feature.** The gap between "token was exchanged" and "here's what the agent did with it" is the biggest blind spot in agent auth today. Token Vault handles the first part well. The second part is where AgenLens lives.

**Users need task-level consent, not app-level consent.** When I authorize an app to access my Google account, I'm giving blanket permission. But when an AI agent acts on my behalf, I want to approve specific actions: "yes, send that email" or "no, don't create that calendar event." AgenLens implements this with an in-app step-up approval flow that pauses the agent and waits for my decision.

## The technical stack

I used LangGraph.js for agent orchestration, with a supervisor that decomposes requests and delegates to specialized sub-agents. Each sub-agent has scoped tools that route through the proxy. Conversation memory persists via LangGraph's PostgresSaver checkpointer.

The proxy is the heart of the system. It evaluates policies, initiates step-up approvals, fetches fresh tokens (using Google's refresh token flow for automatic renewal), forwards requests, and logs activity. All in one pipeline.

The dashboard is built with Next.js and shadcn/ui, showing live activity feeds, delegation chains, approval history, and analytics. Everything updates in real-time.

## What's next

The pattern AgenLens demonstrates, proxy-based observability for agent API calls, is framework-agnostic. It works with LangGraph today, but the same proxy could sit in front of agents built with CrewAI, AutoGen, or any other framework. The visibility gap exists everywhere multi-agent systems access external APIs.

I think the future of agent authorization is not just "can this agent access this service" but "can this agent perform this specific action on this specific resource at this specific time, and does the user approve?" AgenLens is a step toward that future.

You can find the code on [GitHub](https://github.com/Aaryan126/AgenLens).
