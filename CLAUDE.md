# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm dev        # Start dev server (http://localhost:3000)
pnpm build      # Production build
pnpm start      # Run production server
pnpm lint       # ESLint
```

## Architecture

Multi-tenant SaaS platform where each organization can have multiple AI agents, each with a dedicated GCP VM running OpenClaw (AI assistant) connected to Slack.

### Flow

1. **Signup** → Supabase Auth (email/password)
2. **Onboarding** → create organization (name only)
3. **Add Agent wizard** (5 steps): paste Slack config token → set bot name → select skills → enter Anthropic API key → create app & OAuth authorize
4. **Provisioning** → API route runs `terraform apply` to spawn a GCP Compute Engine VM per agent
5. **Post-provisioning** → Slack app manifest updated with webhook URL pointing to agent VM
6. **Dashboard** → shows agent card grid with status + links to OpenClaw web UI (with gateway token auth)

### Key Integration Chain

```
Slack Config Token → apps.manifest.create → OAuth redirect → token exchange
  → agent record updated (with organization_id) → terraform apply (workspace per agent)
  → GCP VM with OpenClaw + Nginx + Let's Encrypt SSL
  → Slack manifest updated with Events API webhook URL
  → agent.openclaw_url set → dashboard shows "active"
```

### Route Groups

- `(auth)/` — login, signup (public, centered layout)
- `(dashboard)/` — onboarding, dashboard (requires auth, header layout with signout)
- `(dashboard)/agents/` — `new/` (add agent wizard), `[agentId]/` (agent detail/settings)
- `(dashboard)/knowledge/` — knowledge base management
- `(dashboard)/skills/` — skills library management

### API Routes

| Route | Method | Does |
|-------|--------|------|
| `/api/onboarding/create-org` | POST | Creates organization for the user |
| `/api/agents/create-slack-app` | POST | Creates Slack app from manifest for an agent, stores credentials, returns OAuth URL |
| `/api/agents/slack-callback` | GET | Exchanges OAuth code for tokens, triggers agent provisioning |
| `/api/agents/provision` | POST | Runs `terraform apply` for agent, updates DB with VM details, updates Slack manifest with webhook URL |
| `/api/knowledge` | GET | List org's knowledge items |
| `/api/knowledge` | POST | Create knowledge item (text → embed → store) |
| `/api/knowledge/[id]` | DELETE | Delete knowledge item |
| `/api/knowledge/search` | GET | Vector search (auth via gateway token, called by agent VMs) |
| `/api/skills` | GET | List org's skills |
| `/api/skills` | POST | Create skill |
| `/api/skills/[id]` | PUT | Update skill |
| `/api/skills/[id]` | DELETE | Delete skill |
| `/api/agents/[agentId]/skills` | GET | List agent's assigned skills |
| `/api/agents/[agentId]/skills` | POST | Assign skill to agent |
| `/api/agents/[agentId]/skills/[skillId]` | DELETE | Remove skill from agent |
| `/api/agents/[agentId]/sync` | GET | Returns agent's skills + knowledge search config (called by VM) |
| `/api/auth/signout` | POST | Signs out, redirects to `/login` |
| `/api/health` | GET | Health check endpoint |

### Supabase SSR Auth Pattern

- `@/lib/supabase/client.ts` — browser client (`createBrowserClient`)
- `@/lib/supabase/server.ts` — server client (`createServerClient` with cookies)
- `@/lib/supabase/middleware.ts` — refreshes session, redirects unauth users to `/login` (exempts `/`, `/login`, `/signup`, `/auth/*`)

### Terraform Multi-Tenancy

- One Terraform workspace per agent: `agent-{agentId}`
- Each workspace creates: static IP, compute instance (e2-small, SPOT, Debian 12), firewall rule, Cloud DNS A record
- State stored in GCS bucket `one-assist-tf-state`
- `startup.sh` is a Terraform `templatefile()` — variables substituted at apply time, not shell runtime
- VM runs OpenClaw as systemd service on `localhost:18789`, proxied via Nginx with Let's Encrypt SSL
- Agent subdomain: `{short-id}.{PLATFORM_DOMAIN}` (e.g. `abc123.local.oneassist.app`)
- `openclaw-sync.timer` runs every 5 minutes to pull skills from platform via `/api/agents/{agentId}/sync`
- Skills written to `/home/openclaw/.openclaw/workspace/skills/{slug}/SKILL.md`
- Built-in `knowledge-search` skill auto-injected with platform search API URL

### OpenClaw VM Configuration

- Slack integration uses **HTTP Events API mode** (not Socket Mode)
- DM access controlled via `dmPolicy: "allowlist"` with `allowFrom` containing the authed Slack user ID
- Gateway bind mode: `loopback` (nginx proxies external traffic)
- `trustedProxies: ["127.0.0.1"]` configured for nginx proxy headers
- Slack dependencies (`@slack/bolt`, `@slack/web-api`, `@slack/socket-mode`) must be explicitly installed — OpenClaw dynamically requires them but doesn't declare them as dependencies

### Database

Six main tables with RLS:
- `organizations` — org name, created_by user
- `org_members` — links users to organizations (role-based membership)
- `agents` — each agent belongs to an organization (`organization_id`). Status enum: `onboarding` → `provisioning` → `active` (or `error`/`stopped`). Multiple agents per org.
- `knowledge_items` — org-level knowledge with pgvector embeddings (1536 dims, text-embedding-3-small)
- `skills` — org-level skill library (name, slug, instructions markdown, optional script)
- `agent_skills` — junction table for agent-skill assignments

Migrations in `supabase/migrations/`:
- `001_create_tenants.sql` — base tenants table (legacy)
- `002_add_config_refresh_token.sql` — Slack config refresh token
- `003_add_api_key.sql` — Anthropic API key storage
- `004_add_gateway_token.sql` — OpenClaw gateway auth token
- `005_add_slack_authed_user_id.sql` — Slack authed user ID for access control
- `006_create_organizations.sql` — organizations and org_members tables
- `007_create_agents.sql` — agents table (replaces tenants for new architecture)
- `009_create_org_invites.sql` — organization invites with token-based acceptance
- `010_knowledge_skills.sql` — knowledge_items, skills, agent_skills tables + pgvector + match_knowledge RPC

## Environment Variables (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
GCP_PROJECT_ID=one-assist
GCP_CREDENTIALS_PATH=/path/to/terraform-sa-key.json
ANTHROPIC_API_KEY=
PLATFORM_DOMAIN=local.oneassist.app
GCP_DNS_ZONE_NAME=local-oneassist-zone
LETSENCRYPT_EMAIL=your@email.com
OPENAI_API_KEY=              # For knowledge embedding (text-embedding-3-small)
PLATFORM_URL=                # Public URL of the platform (for agent VM sync)
```

## Setup

1. Create Supabase project → fill `.env.local`
2. Run `scripts/setup-gcp.sh` once (creates GCP project, APIs, SA, TF state bucket)
3. Create Cloud DNS managed zone for your `PLATFORM_DOMAIN`
4. Run all migrations from `supabase/migrations/` in Supabase SQL editor
5. `pnpm dev`

## Gotchas

- Slack config tokens (`xoxe-`) expire in 12 hours — users must paste a fresh one
- Provisioning is synchronous (~1-2 min blocking) — called from OAuth callback
- `terraform-sa-key.json` is gitignored — never commit it
- `terraform/.terraform/` is gitignored — provider binaries and local state
- App images uploaded to Supabase Storage bucket `app-images` (must be created in Supabase dashboard)
- Commits must use `git -c commit.gpgSign=false commit` (no GPG signing)
- OpenClaw Slack peer deps are not auto-installed — startup script must explicitly `npm install @slack/bolt @slack/web-api @slack/socket-mode`
- To destroy an agent VM: `terraform workspace select agent-{id}` then `terraform destroy` with dummy vars for required variables
