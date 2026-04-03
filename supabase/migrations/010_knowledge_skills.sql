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
  slug text not null,
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

-- RLS for knowledge_items
alter table knowledge_items enable row level security;

create policy "Users can view their org knowledge"
  on knowledge_items for select
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can insert knowledge for their org"
  on knowledge_items for insert
  with check (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can delete their org knowledge"
  on knowledge_items for delete
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

-- RLS for skills
alter table skills enable row level security;

create policy "Users can view their org skills"
  on skills for select
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can insert skills for their org"
  on skills for insert
  with check (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can update their org skills"
  on skills for update
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can delete their org skills"
  on skills for delete
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

-- RLS for agent_skills
alter table agent_skills enable row level security;

create policy "Users can view their org agent skills"
  on agent_skills for select
  using (
    agent_id in (
      select id from agents where organization_id in (
        select organization_id from org_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can assign skills to their org agents"
  on agent_skills for insert
  with check (
    agent_id in (
      select id from agents where organization_id in (
        select organization_id from org_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can remove skills from their org agents"
  on agent_skills for delete
  using (
    agent_id in (
      select id from agents where organization_id in (
        select organization_id from org_members where user_id = auth.uid()
      )
    )
  );

-- Vector similarity search function
create or replace function match_knowledge(
  query_embedding vector(1536),
  match_org_id uuid,
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    knowledge_items.id,
    knowledge_items.title,
    knowledge_items.content,
    1 - (knowledge_items.embedding <=> query_embedding) as similarity
  from knowledge_items
  where knowledge_items.organization_id = match_org_id
    and 1 - (knowledge_items.embedding <=> query_embedding) > match_threshold
  order by knowledge_items.embedding <=> query_embedding
  limit match_count;
$$;

-- Index for vector similarity search
create index knowledge_items_embedding_idx on knowledge_items
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Index for org lookups
create index knowledge_items_org_idx on knowledge_items(organization_id);
create index skills_org_idx on skills(organization_id);
create index agent_skills_agent_idx on agent_skills(agent_id);
create index agent_skills_skill_idx on agent_skills(skill_id);
