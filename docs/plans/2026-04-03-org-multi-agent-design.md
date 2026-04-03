# Organization + Multi-Agent Architecture Design

**Date:** 2026-04-03
**Status:** Approved

## Summary

Restructure One-Assist from a single-tenant model (1 user = 1 bot = 1 VM) to an organization-based multi-agent model where one org can have multiple AI agents, each as a separate Slack app in the same workspace with its own dedicated VM.

## Data Model

### New Tables

```sql
-- organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- org_members
create table org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);
```

### Rename tenants -> agents

```sql
alter table tenants rename to agents;
alter table agents add column organization_id uuid references organizations(id) on delete cascade;
alter table agents drop column user_id;
```

### RLS Policies

- `organizations`: users can read/update orgs they belong to (via org_members)
- `org_members`: users can see members of their orgs
- `agents`: users can CRUD agents belonging to their org (checked via org_members join)

### Status Enum

Unchanged: `onboarding -> provisioning -> active -> error -> stopped`

## User Flows

### Signup + Org Creation

1. User signs up (Supabase Auth, unchanged)
2. Redirected to `/onboarding` - single step: enter org name
3. Creates org + adds user as `owner` in `org_members`
4. Redirected to `/dashboard` - empty agent grid with "Add Agent" button

### Add Agent

1. Click "Add Agent" on dashboard -> `/agents/new`
2. Step 1: Paste Slack config token + refresh token
3. Step 2: Bot name/image
4. Step 3: Choose AI provider + API key (per-agent)
5. Step 4: Create Slack app + OAuth authorize
6. OAuth callback triggers provisioning -> redirect to dashboard
7. Agent card appears with "provisioning" status, transitions to "active"

### Returning Users

- Has org -> `/dashboard` (agent grid)
- No org -> `/onboarding` (org name step)

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/onboarding/create-org` | POST | New: creates org + org_member(owner) |
| `/api/agents/create-slack-app` | POST | Renamed: takes agentId, creates Slack app |
| `/api/agents/slack-callback` | GET | Renamed: exchanges OAuth, triggers provision |
| `/api/agents/provision` | POST | Renamed: terraform apply for agent |
| `/api/auth/signout` | POST | Unchanged |
| `/api/health` | GET | Unchanged |

All agent routes validate authenticated user belongs to the agent's org.

## Infrastructure

- Terraform workspace naming: `agent-{agentId}` (was `tenant-{tenantId}`)
- Each agent still gets its own VM, static IP, DNS record, SSL cert
- Startup script unchanged (per-agent OpenClaw instance)
- Slack config token entered fresh per agent (tokens expire in 12h)
- API keys are per-agent (no org-level sharing)

## UI Design

Reference: https://next-shadcn-admin-dashboard.vercel.app/dashboard/default

### Dashboard Layout

- Sidebar navigation with org name, collapsible
- Header with search, user avatar/dropdown, theme toggle
- Main content area with responsive grid

### Agent Cards

- Card grid layout (responsive: 1 col mobile, 2 col tablet, 3-4 col desktop)
- Each card shows: bot name, status badge (provisioning/active/error), Slack workspace name
- Gradient background (`bg-linear-to-t from-primary/5 to-card`)
- Rounded corners (`rounded-xl`), subtle shadow
- Click to open agent detail page
- "Add Agent" card with + icon as last item in grid

### Agent Detail Page (`/agents/[agentId]`)

- Status, Slack workspace, bot name
- Link to OpenClaw web UI (when active)
- Configuration details
- Delete agent action

### Onboarding (Org Setup)

- Clean centered layout (reuse existing auth layout)
- Single input: org name
- "Create Organization" button -> redirect to dashboard

## File Structure

```
src/app/
  (auth)/login, signup              -- unchanged
  (dashboard)/
    onboarding/page.tsx             -- simplified: org name only
    dashboard/page.tsx              -- agent card grid
    agents/
      new/page.tsx                  -- 4-step agent creation wizard
      [agentId]/page.tsx            -- agent detail page
  api/
    onboarding/create-org/route.ts  -- new
    agents/
      create-slack-app/route.ts     -- moved
      slack-callback/route.ts       -- moved
      provision/route.ts            -- moved
    auth/signout/route.ts           -- unchanged
    health/route.ts                 -- unchanged

src/lib/
  organizations.ts                  -- new: getUserOrg, checkMembership
  terraform.ts                      -- rename tenant -> agent refs
  slack.ts                          -- unchanged

supabase/migrations/
  006_create_organizations.sql
  007_rename_tenants_to_agents.sql
```

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Org creation | Auto on first signup, single "org name" step | Simplest MVP, add invites later |
| API keys | Per-agent, no org-level sharing | Clear cost tracking per agent |
| Slack config token | Entered fresh per agent creation | Tokens expire in 12h, can't reliably reuse |
| Table rename | tenants -> agents | Match domain model, avoid confusion |
| Dashboard style | Card grid (shadcn) | Visual, scales 1-10 agents, matches reference template |
