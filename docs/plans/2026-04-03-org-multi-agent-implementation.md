# Organization + Multi-Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure One-Assist from single-tenant to org-based multi-agent architecture where one org manages multiple AI agents (Slack bots) in the same workspace.

**Architecture:** Add organizations and org_members tables, rename tenants to agents with organization_id FK. Onboarding becomes org creation (name only), then "Add Agent" wizard. Dashboard shows agent card grid using shadcn/ui components styled after the reference admin template.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres + Auth + RLS), Terraform, shadcn/ui, Tailwind CSS 4

---

## Task 1: Install shadcn/ui

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/` (auto-generated)

**Step 1: Initialize shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```

Select: New York style, Zinc color, CSS variables: yes.

**Step 2: Add required components**

```bash
pnpm dlx shadcn@latest add card button input label badge separator avatar dropdown-menu
```

**Step 3: Verify build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add -A
git -c commit.gpgSign=false commit -m "chore: initialize shadcn/ui with core components"
```

---

## Task 2: Database Migration — Create organizations tables

**Files:**
- Create: `supabase/migrations/006_create_organizations.sql`

**Step 1: Write migration**

```sql
-- supabase/migrations/006_create_organizations.sql

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
    -- Allow first member (the creator) to add themselves
    not exists (select 1 from org_members where organization_id = org_members.organization_id)
  );
```

**Step 2: Run migration in Supabase SQL editor**

Copy the SQL and run it in the Supabase dashboard SQL editor.

**Step 3: Commit**

```bash
git add supabase/migrations/006_create_organizations.sql
git -c commit.gpgSign=false commit -m "feat: add organizations and org_members tables with RLS"
```

---

## Task 3: Database Migration — Rename tenants to agents

**Files:**
- Create: `supabase/migrations/007_rename_tenants_to_agents.sql`

**Step 1: Write migration**

```sql
-- supabase/migrations/007_rename_tenants_to_agents.sql

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
```

**Step 2: Run migration in Supabase SQL editor**

**Step 3: Commit**

```bash
git add supabase/migrations/007_rename_tenants_to_agents.sql
git -c commit.gpgSign=false commit -m "feat: rename tenants to agents, add organization_id, update RLS"
```

---

## Task 4: Create organizations lib

**Files:**
- Create: `src/lib/organizations.ts`

**Step 1: Write the org helper functions**

```typescript
// src/lib/organizations.ts
import { SupabaseClient } from "@supabase/supabase-js";

export async function getUserOrganization(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("user_id", user.id)
    .single();

  if (!membership) return null;

  const org = membership.organizations as unknown as { id: string; name: string };
  return {
    id: org.id,
    name: org.name,
    role: membership.role as string,
    userId: user.id,
  };
}

export async function createOrganization(supabase: SupabaseClient, name: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, created_by: user.id })
    .select()
    .single();

  if (orgError) throw orgError;

  const { error: memberError } = await supabase
    .from("org_members")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) throw memberError;

  return org;
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/lib/organizations.ts
git -c commit.gpgSign=false commit -m "feat: add organization helper functions"
```

---

## Task 5: Update terraform.ts — rename tenant to agent

**Files:**
- Modify: `src/lib/terraform.ts`

**Step 1: Update interface and function names**

Change `ProvisionInput.tenantId` → `agentId`, workspace naming from `tenant-{id}` to `agent-{id}`, and update `destroyVM` parameter.

```typescript
// src/lib/terraform.ts — full replacement

import { execSync } from "child_process";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import path from "path";

const TF_DIR = path.resolve(process.cwd(), "terraform");

function loadTerraformEnv(): Record<string, string> {
  const envPath = path.join(TF_DIR, ".env");
  const content = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
  }
  return env;
}

interface ProvisionInput {
  agentId: string;
  slackBotToken: string;
  slackSigningSecret: string;
  slackAuthedUserId: string;
  aiProvider: string;
  aiApiKey: string;
}

interface ProvisionOutput {
  vmIp: string;
  vmName: string;
  openclawUrl: string;
  gatewayToken: string;
}

export function provisionVM(input: ProvisionInput): ProvisionOutput {
  const tfEnv = loadTerraformEnv();
  const gatewayToken = randomBytes(32).toString("hex");
  const workspace = `agent-${input.agentId}`;

  const execOpts = {
    cwd: TF_DIR,
    stdio: "pipe" as const,
    timeout: 300000,
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: tfEnv.GCP_CREDENTIALS_PATH,
    },
  };

  try {
    execSync(`terraform workspace select ${workspace}`, execOpts);
  } catch {
    execSync(`terraform workspace new ${workspace}`, execOpts);
  }

  const tfVars = [
    `-var="project_id=${tfEnv.GCP_PROJECT_ID}"`,
    `-var="tenant_id=${input.agentId}"`,
    `-var="slack_bot_token=${input.slackBotToken}"`,
    `-var="slack_signing_secret=${input.slackSigningSecret}"`,
    `-var="slack_authed_user_id=${input.slackAuthedUserId}"`,
    `-var="ai_provider=${input.aiProvider}"`,
    `-var="ai_api_key=${input.aiApiKey}"`,
    `-var="gateway_token=${gatewayToken}"`,
    `-var="domain=${tfEnv.PLATFORM_DOMAIN}"`,
    `-var="dns_zone_name=${tfEnv.GCP_DNS_ZONE_NAME}"`,
    `-var="letsencrypt_email=${tfEnv.LETSENCRYPT_EMAIL}"`,
  ].join(" ");

  execSync(`terraform apply -auto-approve ${tfVars}`, execOpts);

  const output = execSync("terraform output -json", { ...execOpts, encoding: "utf-8" });
  const parsed = JSON.parse(output);

  return {
    vmIp: parsed.vm_ip.value,
    vmName: parsed.vm_name.value,
    openclawUrl: parsed.openclaw_url.value,
    gatewayToken,
  };
}

export function destroyVM(agentId: string): void {
  const tfEnv = loadTerraformEnv();
  const workspace = `agent-${agentId}`;

  const execOpts = {
    cwd: TF_DIR,
    stdio: "pipe" as const,
    timeout: 300000,
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: tfEnv.GCP_CREDENTIALS_PATH,
    },
  };

  execSync(`terraform workspace select ${workspace}`, execOpts);
  execSync(`terraform destroy -auto-approve`, execOpts);
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/lib/terraform.ts
git -c commit.gpgSign=false commit -m "refactor: rename tenant to agent in terraform provisioning"
```

---

## Task 6: Create org onboarding API route

**Files:**
- Create: `src/app/api/onboarding/create-org/route.ts`

**Step 1: Write the route**

```typescript
// src/app/api/onboarding/create-org/route.ts
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "@/lib/organizations";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }

  try {
    const org = await createOrganization(supabase, name.trim());
    return NextResponse.json({ organization: org });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/app/api/onboarding/create-org/route.ts
git -c commit.gpgSign=false commit -m "feat: add create-org API route"
```

---

## Task 7: Update create-slack-app route — agent-based

**Files:**
- Move: `src/app/api/onboarding/create-slack-app/route.ts` → `src/app/api/agents/create-slack-app/route.ts`

**Step 1: Create new route at agents path**

```typescript
// src/app/api/agents/create-slack-app/route.ts
import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { createSlackApp } from "@/lib/slack";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);

  if (!org) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const configToken = formData.get("configToken") as string;
  const configRefreshToken = formData.get("configRefreshToken") as string;
  const appName = formData.get("appName") as string;
  const provider = formData.get("provider") as string;
  const apiKey = formData.get("apiKey") as string;

  if (!configToken || !configRefreshToken || !appName || !apiKey) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const baseUrl = new URL(request.url).origin;
  const redirectUrl = `${baseUrl}/api/agents/slack-callback`;

  try {
    const { credentials, oauthUrl } = await createSlackApp(configToken, appName, redirectUrl);

    // Insert new agent record
    const { data: agent, error } = await supabase.from("agents").insert({
      organization_id: org.id,
      slack_config_token: configToken,
      slack_config_refresh_token: configRefreshToken,
      ai_provider: provider || "anthropic",
      ai_api_key: apiKey,
      slack_app_id: credentials.appId,
      slack_app_name: appName,
      slack_client_id: credentials.clientId,
      slack_client_secret: credentials.clientSecret,
      slack_signing_secret: credentials.signingSecret,
      status: "onboarding",
    }).select("id").single();

    if (error) throw error;

    return NextResponse.json({
      agentId: agent.id,
      oauthUrl,
      appSettingsUrl: `https://api.slack.com/apps/${credentials.appId}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**Step 2: Delete old route**

```bash
rm src/app/api/onboarding/create-slack-app/route.ts
```

**Step 3: Verify build**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/app/api/agents/create-slack-app/route.ts
git add -u  # stages the deletion
git -c commit.gpgSign=false commit -m "feat: move create-slack-app to agents API, use org-based auth"
```

---

## Task 8: Update slack-callback route — agent-based

**Files:**
- Move: `src/app/api/onboarding/slack-callback/route.ts` → `src/app/api/agents/slack-callback/route.ts`

**Step 1: Create new route**

```typescript
// src/app/api/agents/slack-callback/route.ts
import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { exchangeCodeForTokens } from "@/lib/slack";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const agentId = searchParams.get("state"); // pass agentId as OAuth state param

  if (error || !code) {
    return NextResponse.redirect(`${origin}/agents/new?error=slack_auth_failed`);
  }

  const supabase = await createClient();
  const org = await getUserOrganization(supabase);

  if (!org) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Get agent to retrieve client credentials
  const { data: agent } = await supabase
    .from("agents")
    .select("id, slack_client_id, slack_client_secret")
    .eq("id", agentId)
    .eq("organization_id", org.id)
    .single();

  if (!agent) {
    return NextResponse.redirect(`${origin}/dashboard?error=agent_not_found`);
  }

  const redirectUri = `${origin}/api/agents/slack-callback`;

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      agent.slack_client_id,
      agent.slack_client_secret,
      redirectUri
    );

    await supabase
      .from("agents")
      .update({
        slack_access_token: tokens.accessToken,
        slack_refresh_token: tokens.refreshToken,
        slack_workspace_name: tokens.teamName,
        slack_authed_user_id: tokens.authedUserId,
        status: "provisioning",
      })
      .eq("id", agent.id);

    // Fire-and-forget provisioning
    fetch(`${origin}/api/agents/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: agent.id }),
    }).catch((err) => console.error("[slack-callback] Provision trigger failed:", err));

    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (err) {
    console.error("[slack-callback] Error:", err);
    return NextResponse.redirect(`${origin}/agents/new?error=token_exchange_failed`);
  }
}
```

**Step 2: Delete old route**

```bash
rm src/app/api/onboarding/slack-callback/route.ts
```

**Step 3: Commit**

```bash
git add src/app/api/agents/slack-callback/route.ts
git add -u
git -c commit.gpgSign=false commit -m "feat: move slack-callback to agents API, use agentId from state param"
```

---

## Task 9: Update provision route — agent-based

**Files:**
- Move: `src/app/api/provision/route.ts` → `src/app/api/agents/provision/route.ts`

**Step 1: Create new route**

```typescript
// src/app/api/agents/provision/route.ts
import { createClient } from "@supabase/supabase-js";
import { provisionVM } from "@/lib/terraform";
import { updateSlackAppWithEventsUrl } from "@/lib/slack";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export async function POST(request: Request) {
  const { agentId } = await request.json();

  const supabase = getAdminClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  console.log("[provision] Starting provisioning for agent:", agent.id);

  try {
    const result = provisionVM({
      agentId: agent.id,
      slackBotToken: agent.slack_access_token,
      slackSigningSecret: agent.slack_signing_secret,
      slackAuthedUserId: agent.slack_authed_user_id || "",
      aiProvider: agent.ai_provider || "anthropic",
      aiApiKey: agent.ai_api_key,
    });

    const eventsUrl = `${result.openclawUrl}/slack/events`;
    const baseUrl = new URL(request.url).origin;
    const redirectUrl = `${baseUrl}/api/agents/slack-callback`;

    try {
      await updateSlackAppWithEventsUrl(
        agent.slack_config_token,
        agent.slack_app_id,
        agent.slack_app_name,
        redirectUrl,
        eventsUrl,
      );
      console.log("[provision] Updated Slack manifest with events URL:", eventsUrl);
    } catch (err: any) {
      console.error("[provision] Failed to update Slack manifest:", err.message);
    }

    await supabase
      .from("agents")
      .update({
        vm_ip: result.vmIp,
        vm_name: result.vmName,
        openclaw_url: result.openclawUrl,
        gateway_token: result.gatewayToken,
        status: "active",
      })
      .eq("id", agent.id);

    console.log("[provision] Success:", result);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[provision] Error:", err.message);
    await supabase
      .from("agents")
      .update({ status: "error", error_message: err.message })
      .eq("id", agent.id);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**Step 2: Delete old route**

```bash
rm src/app/api/provision/route.ts
```

**Step 3: Update middleware to exempt new provision path**

In `src/lib/supabase/middleware.ts`, change the provision path exemption from `/api/provision` to `/api/agents/provision`.

**Step 4: Commit**

```bash
git add src/app/api/agents/provision/route.ts
git add -u
git -c commit.gpgSign=false commit -m "feat: move provision to agents API, use agentId"
```

---

## Task 10: Rewrite onboarding page — org name only

**Files:**
- Modify: `src/app/(dashboard)/onboarding/page.tsx`

**Step 1: Rewrite as org creation page**

```tsx
// src/app/(dashboard)/onboarding/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding/create-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create organization");
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>
            Give your organization a name to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc."
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/onboarding/page.tsx
git -c commit.gpgSign=false commit -m "feat: simplify onboarding to org name creation"
```

---

## Task 11: Create Add Agent wizard page

**Files:**
- Create: `src/app/(dashboard)/agents/new/page.tsx`

**Step 1: Write the agent creation wizard**

This reuses the existing step components (SlackTokenStep, AppDetailsStep, ApiKeyStep, AuthorizeStep) but points them at the new `/api/agents/` routes and passes `agentId` through OAuth state.

```tsx
// src/app/(dashboard)/agents/new/page.tsx
"use client";

import { useState } from "react";
import { SlackTokenStep } from "@/components/onboarding/slack-token-step";
import { AppDetailsStep } from "@/components/onboarding/app-details-step";
import { ApiKeyStep } from "@/components/onboarding/api-key-step";
import { AuthorizeStep } from "@/components/onboarding/authorize-step";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewAgentPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    configToken: "",
    configRefreshToken: "",
    appName: "",
    provider: "anthropic",
    apiKey: "",
  });

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add New Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <SlackTokenStep
              configToken={data.configToken}
              configRefreshToken={data.configRefreshToken}
              onChange={(fields) => setData({ ...data, ...fields })}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <AppDetailsStep
              appName={data.appName}
              onChange={(fields) => setData({ ...data, ...fields })}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <ApiKeyStep
              provider={data.provider}
              apiKey={data.apiKey}
              onChange={(fields) => setData({ ...data, ...fields })}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <AuthorizeStep data={data} onBack={() => setStep(3)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Update AuthorizeStep component**

Modify `src/components/onboarding/authorize-step.tsx` to:
- POST to `/api/agents/create-slack-app` instead of `/api/onboarding/create-slack-app`
- Append `&state={agentId}` to the OAuth URL so the callback knows which agent

**Step 3: Verify build**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/agents/new/page.tsx
git add src/components/onboarding/authorize-step.tsx
git -c commit.gpgSign=false commit -m "feat: add agent creation wizard page"
```

---

## Task 12: Create AgentCard component

**Files:**
- Create: `src/components/dashboard/agent-card.tsx`

**Step 1: Write the component**

```tsx
// src/components/dashboard/agent-card.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Agent {
  id: string;
  slack_app_name: string;
  slack_workspace_name: string | null;
  status: string;
  openclaw_url: string | null;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  provisioning: "secondary",
  active: "default",
  error: "destructive",
  stopped: "outline",
  onboarding: "outline",
};

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-t from-primary/5 to-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {agent.slack_app_name}
          </CardTitle>
          <Badge variant={statusVariant[agent.status] || "outline"}>
            {agent.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {agent.slack_workspace_name || "Setting up..."}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function AddAgentCard() {
  return (
    <Link href="/agents/new">
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed flex items-center justify-center min-h-[120px]">
        <CardContent className="flex flex-col items-center gap-2 pt-6">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xl">
            +
          </div>
          <p className="text-sm text-muted-foreground">Add Agent</p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/agent-card.tsx
git -c commit.gpgSign=false commit -m "feat: add AgentCard and AddAgentCard components"
```

---

## Task 13: Rewrite dashboard page — agent grid

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Rewrite dashboard**

```tsx
// src/app/(dashboard)/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { redirect } from "next/navigation";
import { AgentCard, AddAgentCard } from "@/components/dashboard/agent-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);

  if (!org) {
    redirect("/onboarding");
  }

  const { data: agents } = await supabase
    .from("agents")
    .select("id, slack_app_name, slack_workspace_name, status, openclaw_url")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{org.name}</h2>
        <p className="text-muted-foreground">Manage your AI agents</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(agents || []).map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        <AddAgentCard />
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx
git -c commit.gpgSign=false commit -m "feat: rewrite dashboard as agent card grid"
```

---

## Task 14: Create agent detail page

**Files:**
- Create: `src/app/(dashboard)/agents/[agentId]/page.tsx`

**Step 1: Write the agent detail page**

```tsx
// src/app/(dashboard)/agents/[agentId]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GatewayLoader } from "@/components/dashboard/gateway-loader";
import Link from "next/link";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);

  if (!org) redirect("/onboarding");

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("organization_id", org.id)
    .single();

  if (!agent) notFound();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">&larr; Back</Button>
        </Link>
        <h2 className="text-2xl font-bold">{agent.slack_app_name}</h2>
        <Badge variant={agent.status === "active" ? "default" : agent.status === "error" ? "destructive" : "secondary"}>
          {agent.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agent.slack_workspace_name && (
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Workspace:</span>{" "}
              {agent.slack_workspace_name}
            </div>
          )}
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Provider:</span>{" "}
            {agent.ai_provider}
          </div>
        </CardContent>
      </Card>

      {(agent.status === "provisioning" || agent.status === "active") && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Access</CardTitle>
          </CardHeader>
          <CardContent>
            <GatewayLoader
              openclawUrl={agent.openclaw_url}
              gatewayToken={agent.gateway_token}
            />
          </CardContent>
        </Card>
      )}

      {agent.status === "error" && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{agent.error_message}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/agents/\[agentId\]/page.tsx
git -c commit.gpgSign=false commit -m "feat: add agent detail page"
```

---

## Task 15: Update dashboard layout — org-aware header

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Update layout with org name in header**

```tsx
// src/app/(dashboard)/layout.tsx
import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const org = await getUserOrganization(supabase);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">One Assist</h1>
          {org && (
            <span className="text-sm text-muted-foreground">/ {org.name}</span>
          )}
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>
      <main className="max-w-5xl mx-auto py-8 px-4">{children}</main>
    </div>
  );
}
```

Note: `max-w-2xl` → `max-w-5xl` to accommodate the card grid.

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx
git -c commit.gpgSign=false commit -m "feat: update dashboard layout with org name and wider content"
```

---

## Task 16: Update middleware — exempt new agent provision path

**Files:**
- Modify: `src/lib/supabase/middleware.ts:37`

**Step 1: Update path exemption**

Change `/api/provision` to `/api/agents/provision` in the middleware path check.

In `src/lib/supabase/middleware.ts`, replace:
```typescript
!request.nextUrl.pathname.startsWith("/api/provision") &&
```
with:
```typescript
!request.nextUrl.pathname.startsWith("/api/agents/provision") &&
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git -c commit.gpgSign=false commit -m "fix: update middleware to exempt new agents/provision path"
```

---

## Task 17: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update documentation**

Update CLAUDE.md to reflect the new architecture:
- Organizations + org_members tables
- Agents table (renamed from tenants)
- New API route paths (`/api/agents/*`, `/api/onboarding/create-org`)
- Updated flow description (signup → create org → add agents)
- Updated migration list (add 006, 007)
- Remove references to "tenant" terminology

**Step 2: Commit**

```bash
git add CLAUDE.md
git -c commit.gpgSign=false commit -m "docs: update CLAUDE.md for org + multi-agent architecture"
```

---

## Task 18: Clean up old files

**Files:**
- Delete: `src/app/api/onboarding/create-slack-app/route.ts` (if not already deleted in Task 7)
- Delete: `src/app/api/onboarding/slack-callback/route.ts` (if not already deleted in Task 8)
- Delete: `src/app/api/provision/route.ts` (if not already deleted in Task 9)

**Step 1: Verify all old routes are removed**

```bash
ls src/app/api/onboarding/
# Should only contain create-org/
ls src/app/api/provision/ 2>/dev/null
# Should not exist
```

**Step 2: Final build check**

```bash
pnpm build
```

Expected: Clean build with no errors.

**Step 3: Commit any remaining cleanup**

```bash
git add -u
git -c commit.gpgSign=false commit -m "chore: remove old tenant-based route files"
```

---

## Summary

| Task | Description | Key Change |
|------|-------------|------------|
| 1 | Install shadcn/ui | UI foundation |
| 2 | Create organizations tables | New DB schema |
| 3 | Rename tenants → agents | DB migration |
| 4 | Organizations lib | Helper functions |
| 5 | Update terraform.ts | tenant → agent naming |
| 6 | Create org API route | POST /api/onboarding/create-org |
| 7 | Agent create-slack-app | Moved to /api/agents/ |
| 8 | Agent slack-callback | Moved to /api/agents/ |
| 9 | Agent provision | Moved to /api/agents/ |
| 10 | Org onboarding page | Name-only form |
| 11 | Agent creation wizard | /agents/new with 4 steps |
| 12 | AgentCard component | Card grid UI |
| 13 | Dashboard rewrite | Agent grid layout |
| 14 | Agent detail page | /agents/[agentId] |
| 15 | Dashboard layout | Org-aware header, wider |
| 16 | Middleware update | New provision path |
| 17 | CLAUDE.md update | Documentation |
| 18 | Clean up old files | Remove dead code |
