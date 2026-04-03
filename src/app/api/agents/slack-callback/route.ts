import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { exchangeCodeForTokens } from "@/lib/slack";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const agentId = searchParams.get("state");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/agents/new?error=slack_auth_failed`);
  }

  const supabase = await createClient();
  const org = await getUserOrganization(supabase);

  if (!org) {
    return NextResponse.redirect(`${origin}/login`);
  }

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
