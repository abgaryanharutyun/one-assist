# OpenClaw Platform

Multi-tenant SaaS platform for deploying personal OpenClaw AI assistants connected to Slack.

## Stack
- Next.js 14 (App Router)
- Supabase (Auth + Postgres)
- Terraform + GCP Compute Engine
- Slack API (programmatic app creation)

## Setup
1. Create Supabase project, add credentials to `.env.local`
2. Run `scripts/setup-gcp.sh` to provision GCP resources
3. Run SQL migration in Supabase dashboard
4. `pnpm dev`

## Design
See `docs/plans/2026-04-02-openclaw-platform-design.md` in the Hary-ai repo.
