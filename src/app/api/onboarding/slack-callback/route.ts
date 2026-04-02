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

    // Update tenant with tokens and trigger provisioning
    await supabase
      .from("tenants")
      .update({
        slack_access_token: tokens.accessToken,
        slack_refresh_token: tokens.refreshToken,
        slack_workspace_name: tokens.teamName,
        status: "provisioning",
      })
      .eq("user_id", user.id);

    // Trigger VM provisioning
    await fetch(`${origin}/api/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });

    return NextResponse.redirect(`${origin}/dashboard`);
  } catch {
    return NextResponse.redirect(`${origin}/onboarding?error=token_exchange_failed`);
  }
}
