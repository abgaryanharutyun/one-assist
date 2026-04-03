-- Fix infinite recursion in org_members RLS policies
-- The old policies queried org_members from within org_members policies

drop policy if exists "Users can view members of their orgs" on org_members;
drop policy if exists "Owners/admins can add members" on org_members;

create policy "Users can view members of their orgs"
  on org_members for select
  using (user_id = auth.uid());

create policy "Owners can add members"
  on org_members for insert
  with check (
    organization_id in (
      select id from organizations where created_by = auth.uid()
    )
  );
