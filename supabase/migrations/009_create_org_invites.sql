-- Organization invites
create table org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  invited_by uuid references auth.users(id) not null,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '7 days'
);

-- RLS
alter table org_invites enable row level security;

-- Anyone can read an invite by token (needed for accepting)
create policy "Anyone can view invites by token"
  on org_invites for select
  using (true);

-- Org members can create invites (checked at API level via admin client)
-- No insert policy needed since we use admin client
