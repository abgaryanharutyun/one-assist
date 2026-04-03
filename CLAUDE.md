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

Multi-tenant SaaS platform where each user gets a dedicated GCP VM running OpenClaw (AI assistant) connected to their Slack workspace.

### Flow

1. **Signup** → Supabase Auth (email/password)
2. **Onboarding wizard** (4 steps): paste Slack config token → set bot name/image → enter Anthropic API key → create app & OAuth authorize
3. **Provisioning** → API route runs `terraform apply` to spawn a GCP Compute Engine VM per tenant
4. **Post-provisioning** → Slack app manifest updated with webhook URL pointing to tenant VM
5. **Dashboard** → shows connection status + link to OpenClaw web UI (with gateway token auth)

### Key Integration Chain

```
Slack Config Token → apps.manifest.create → OAuth redirect → token exchange
  → tenant record updated → terraform apply (workspace per tenant)
  → GCP VM with OpenClaw + Nginx + Let's Encrypt SSL
  → Slack manifest updated with Events API webhook URL
  → tenant.openclaw_url set → dashboard shows "active"
```

### Route Groups

- `(auth)/` — login, signup (public, centered layout)
- `(dashboard)/` — onboarding, dashboard (requires auth, header layout with signout)

### API Routes

| Route | Method | Does |
|-------|--------|------|
| `/api/onboarding/create-slack-app` | POST | Creates Slack app from manifest, stores credentials, returns OAuth URL |
| `/api/onboarding/slack-callback` | GET | Exchanges OAuth code for tokens, triggers provisioning |
| `/api/provision` | POST | Runs `terraform apply` for tenant, updates DB with VM details, updates Slack manifest with webhook URL |
| `/api/auth/signout` | POST | Signs out, redirects to `/login` |
| `/api/health` | GET | Health check endpoint |

### Supabase SSR Auth Pattern

- `@/lib/supabase/client.ts` — browser client (`createBrowserClient`)
- `@/lib/supabase/server.ts` — server client (`createServerClient` with cookies)
- `@/lib/supabase/middleware.ts` — refreshes session, redirects unauth users to `/login` (exempts `/`, `/login`, `/signup`, `/auth/*`)

### Terraform Multi-Tenancy

- One Terraform workspace per tenant: `tenant-{tenantId}`
- Each workspace creates: static IP, compute instance (e2-small, SPOT, Debian 12), firewall rule, Cloud DNS A record
- State stored in GCS bucket `one-assist-tf-state`
- `startup.sh` is a Terraform `templatefile()` — variables substituted at apply time, not shell runtime
- VM runs OpenClaw as systemd service on `localhost:18789`, proxied via Nginx with Let's Encrypt SSL
- Tenant subdomain: `{short-id}.{PLATFORM_DOMAIN}` (e.g. `abc123.local.oneassist.app`)

### OpenClaw VM Configuration

- Slack integration uses **HTTP Events API mode** (not Socket Mode)
- DM access controlled via `dmPolicy: "allowlist"` with `allowFrom` containing the authed Slack user ID
- Gateway bind mode: `loopback` (nginx proxies external traffic)
- `trustedProxies: ["127.0.0.1"]` configured for nginx proxy headers
- Slack dependencies (`@slack/bolt`, `@slack/web-api`, `@slack/socket-mode`) must be explicitly installed — OpenClaw dynamically requires them but doesn't declare them as dependencies

### Database

Single `tenants` table with RLS (users can only access their own row). Status enum: `onboarding` → `provisioning` → `active` (or `error`/`stopped`). One tenant per user (unique constraint on `user_id`).

Migrations in `supabase/migrations/`:
- `001_create_tenants.sql` — base table
- `002_add_config_refresh_token.sql` — Slack config refresh token
- `003_add_api_key.sql` — Anthropic API key storage
- `004_add_gateway_token.sql` — OpenClaw gateway auth token
- `005_add_slack_authed_user_id.sql` — Slack authed user ID for access control

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
- To destroy a tenant VM: `terraform workspace select tenant-{id}` then `terraform destroy` with dummy vars for required variables
