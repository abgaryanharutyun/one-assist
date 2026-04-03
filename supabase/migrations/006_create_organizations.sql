-- Organizations table
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Organization members
create table org_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- RLS for organizations
alter table organizations enable row level security;

create policy "Users can view their orgs"
  on organizations for select
  using (
    id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can update their orgs"
  on organizations for update
  using (
    id in (
      select organization_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Authenticated users can create orgs"
  on organizations for insert
  with check (auth.uid() = created_by);

-- RLS for org_members
alter table org_members enable row level security;

create policy "Users can view members of their orgs"
  on org_members for select
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Owners/admins can add members"
  on org_members for insert
  with check (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
    or
    not exists (select 1 from org_members where organization_id = org_members.organization_id)
  );
