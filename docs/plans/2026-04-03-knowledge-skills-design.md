# Knowledge Base + Skills Library Design

**Date:** 2026-04-03
**Status:** Approved

## Summary

Add org-level knowledge base (text with vector search) and skills library (markdown instructions + optional scripts) that agents can use. Knowledge is queried at runtime via API. Skills are synced to agent VMs periodically.

## Database Schema

```sql
-- Enable pgvector
create extension if not exists vector;

-- Knowledge items (org-level, with embeddings)
create table knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  title text not null,
  content text not null,
  embedding vector(1536),
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Skills library (org-level)
create table skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  description text not null,
  instructions text not null,
  script text,
  script_language text check (script_language in ('python', 'bash')),
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Agent-skill assignments
create table agent_skills (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade not null,
  skill_id uuid references skills(id) on delete cascade not null,
  unique(agent_id, skill_id)
);
```

RLS: all three tables scoped to org membership (same pattern as agents table).

## API Endpoints

| Route | Method | Does |
|-------|--------|------|
| `/api/knowledge` | GET | List org's knowledge items |
| `/api/knowledge` | POST | Create knowledge item (text → embed → store) |
| `/api/knowledge/[id]` | DELETE | Delete knowledge item |
| `/api/knowledge/search` | GET | Vector search (auth via gateway token) |
| `/api/skills` | GET | List org's skills |
| `/api/skills` | POST | Create skill |
| `/api/skills/[id]` | PUT | Update skill |
| `/api/skills/[id]` | DELETE | Delete skill |
| `/api/agents/[agentId]/skills` | GET | List agent's assigned skills |
| `/api/agents/[agentId]/skills` | POST | Assign skill to agent |
| `/api/agents/[agentId]/skills/[skillId]` | DELETE | Remove skill from agent |
| `/api/agents/[agentId]/sync` | GET | Returns agent's skills + knowledge search config (called by VM) |

## Data Flow

### Knowledge
- Org admin pastes text content in dashboard
- Server embeds via OpenAI text-embedding-3-small (1536 dims)
- Stored in Supabase with pgvector
- Agent VMs query `/api/knowledge/search?q=...` at runtime via a built-in skill
- Knowledge stays in Supabase, never copied to VM

### Skills
- Org admin creates skills (name, description, instructions markdown, optional script)
- Skills stored in Supabase
- When creating an agent, user selects which skills to assign (agent_skills junction)
- Agent VMs pull assigned skills via `/api/agents/{agentId}/sync` every 5 minutes
- Sync writes skills to OpenClaw's directory structure:
  ```
  /home/openclaw/.openclaw/agents/main/skills/
    ├── skill-slug/
    │     ├── SKILL.md
    │     └── skill.py (or skill.sh, if script exists)
  ```
- A built-in "knowledge-search" skill is also synced, calling the platform search API

## VM Sync Mechanism

### New systemd units on agent VM

- `openclaw-sync.service` — runs `/opt/openclaw-bin/sync.sh`
- `openclaw-sync.timer` — triggers every 5 minutes + on boot

### sync.sh
1. Calls `{platform_url}/api/agents/{agent_id}/sync` with gateway token
2. Parses JSON response: `{ skills: [...], knowledgeSearchUrl: "..." }`
3. Writes each skill to OpenClaw skills directory
4. Writes built-in knowledge-search skill
5. Removes old skill directories no longer assigned

### New Terraform variables
- `platform_url` — base URL of One Assist platform
- `agent_id` — agent UUID (for sync endpoint)

## UI Pages

### Knowledge (`/knowledge`)
- List of knowledge items (title, preview, date)
- "Add Knowledge" button → form with title + content textarea
- Delete per item

### Skills (`/skills`)
- Card grid (name, description, language badge)
- "Create Skill" → form: name, description, instructions (markdown), optional script + language
- Edit/delete per skill

### Agent creation wizard (update)
- Add skill selection step between bot name and API key
- Checkboxes of org's skill library

### Agent detail page (update)
- "Skills" section with add/remove

### Dashboard header
- Add "Knowledge" and "Skills" nav links

## Embedding

- Model: OpenAI `text-embedding-3-small` (1536 dimensions)
- Called server-side on knowledge creation
- Requires `OPENAI_API_KEY` in `.env.local`

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector storage | Supabase pgvector | No extra infra, sufficient scale |
| Knowledge delivery | Runtime API search | Always up-to-date, no VM sync needed |
| Skills delivery | Periodic sync to VM | Skills run locally, low latency |
| Sync frequency | 5 minutes | Good balance of freshness vs API load |
| Embedding model | text-embedding-3-small | Cheap, fast, good quality |
| Skill format | Markdown + optional script | Matches OpenClaw's native skill format |
| Knowledge scope | Org-wide (all agents) | Simplest, per-agent filtering later |
| Skill scope | Per-agent (via agent_skills) | Different agents need different capabilities |
