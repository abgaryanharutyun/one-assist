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

    // Append agentId as state param to OAuth URL so callback knows which agent
    const oauthUrlWithState = `${oauthUrl}&state=${agent.id}`;

    return NextResponse.json({
      agentId: agent.id,
      oauthUrl: oauthUrlWithState,
      appSettingsUrl: `https://api.slack.com/apps/${credentials.appId}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
