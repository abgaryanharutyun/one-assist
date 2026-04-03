-- Rename table
alter table tenants rename to agents;

-- Add organization_id column
alter table agents add column organization_id uuid references organizations(id) on delete cascade;

-- Drop old user_id unique constraint and column
alter table agents drop constraint if exists tenants_user_id_key;
alter table agents drop column user_id;

-- Drop old RLS policies (they reference user_id)
drop policy if exists "Users can view own tenant" on agents;
drop policy if exists "Users can insert own tenant" on agents;
drop policy if exists "Users can update own tenant" on agents;

-- New RLS policies based on org membership
create policy "Users can view agents in their org"
  on agents for select
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can insert agents in their org"
  on agents for insert
  with check (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can update agents in their org"
  on agents for update
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid()
    )
  );

create policy "Users can delete agents in their org"
  on agents for delete
  using (
    organization_id in (
      select organization_id from org_members where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
