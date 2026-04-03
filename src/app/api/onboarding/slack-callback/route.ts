import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/slack";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/onboarding?error=slack_auth_failed`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Get tenant to retrieve client credentials
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slack_client_id, slack_client_secret")
    .eq("user_id", user.id)
    .single();

  if (!tenant) {
    return NextResponse.redirect(`${origin}/onboarding?error=tenant_not_found`);
  }

  const redirectUri = `${origin}/api/onboarding/slack-callback`;

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      tenant.slack_client_id,
      tenant.slack_client_secret,
      redirectUri
    );

    // Update tenant with tokens, set status to provisioning
    await supabase
      .from("tenants")
      .update({
        slack_access_token: tokens.accessToken,
        slack_refresh_token: tokens.refreshToken,
        slack_workspace_name: tokens.teamName,
        slack_authed_user_id: tokens.authedUserId,
        status: "provisioning",
      })
      .eq("user_id", user.id);

    // Get tenant ID for provisioning
    const { data: fullTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("user_id", user.id)
      .single();

    // Fire-and-forget provisioning — don't await
    fetch(`${origin}/api/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: fullTenant!.id }),
    }).catch((err) => console.error("[slack-callback] Provision trigger failed:", err));

    // Redirect immediately — dashboard will poll for status
    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (err) {
    console.error("[slack-callback] Error:", err);
    return NextResponse.redirect(`${origin}/onboarding?error=token_exchange_failed`);
  }
}
