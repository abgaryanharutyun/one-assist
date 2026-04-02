create type tenant_status as enum (
  'onboarding',
  'provisioning',
  'active',
  'error',
  'stopped'
);

create table tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  slack_config_token text,
  slack_app_id text,
  slack_app_name text,
  slack_app_image_url text,
  slack_client_id text,
  slack_client_secret text,
  slack_signing_secret text,
  slack_access_token text,
  slack_refresh_token text,
  slack_workspace_name text,
  vm_ip text,
  vm_name text,
  openclaw_url text,
  status tenant_status default 'onboarding' not null,
  error_message text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id)
);

-- RLS policies
alter table tenants enable row level security;

create policy "Users can read own tenant"
  on tenants for select
  using (auth.uid() = user_id);

create policy "Users can insert own tenant"
  on tenants for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tenant"
  on tenants for update
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tenants_updated_at
  before update on tenants
  for each row
  execute function update_updated_at();
