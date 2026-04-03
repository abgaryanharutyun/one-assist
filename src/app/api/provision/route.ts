import { createClient } from "@supabase/supabase-js";
import { provisionVM } from "@/lib/terraform";
import { updateSlackAppWithEventsUrl } from "@/lib/slack";
import { NextResponse } from "next/server";

// Use service role key to bypass RLS — this route is called internally
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export async function POST(request: Request) {
  const { tenantId } = await request.json();

  const supabase = getAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  console.log("[provision] Starting provisioning for tenant:", tenant.id);

  try {
    const result = provisionVM({
      agentId: tenant.id,
      slackBotToken: tenant.slack_access_token,
      slackSigningSecret: tenant.slack_signing_secret,
      slackAuthedUserId: tenant.slack_authed_user_id || "",
      aiProvider: tenant.ai_provider || "anthropic",
      aiApiKey: tenant.ai_api_key,
    });

    // Update Slack app manifest with the events URL now that we have the VM URL
    const eventsUrl = `${result.openclawUrl}/slack/events`;
    const baseUrl = new URL(request.url).origin;
    const redirectUrl = `${baseUrl}/api/onboarding/slack-callback`;

    try {
      await updateSlackAppWithEventsUrl(
        tenant.slack_config_token,
        tenant.slack_app_id,
        tenant.slack_app_name,
        redirectUrl,
        eventsUrl,
      );
      console.log("[provision] Updated Slack manifest with events URL:", eventsUrl);
    } catch (err: any) {
      console.error("[provision] Failed to update Slack manifest:", err.message);
      // Non-fatal — the VM is still provisioned
    }

    await supabase
      .from("tenants")
      .update({
        vm_ip: result.vmIp,
        vm_name: result.vmName,
        openclaw_url: result.openclawUrl,
        gateway_token: result.gatewayToken,
        status: "active",
      })
      .eq("id", tenant.id);

    console.log("[provision] Success:", result);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[provision] Error:", err.message);
    await supabase
      .from("tenants")
      .update({ status: "error", error_message: err.message })
      .eq("id", tenant.id);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
