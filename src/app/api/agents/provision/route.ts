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

  // Fetch assigned skills to bake into the VM
  const { data: assignments } = await supabase
    .from("agent_skills")
    .select("skills(id, name, slug, description, instructions, script, script_language)")
    .eq("agent_id", agentId);

  const skills = (assignments || []).map((row: any) => row.skills).filter(Boolean);
  console.log("[provision] Baking", skills.length, "skills into VM");

  try {
    const result = provisionVM({
      agentId: agent.id,
      organizationId: agent.organization_id,
      slackBotToken: agent.slack_access_token,
      slackSigningSecret: agent.slack_signing_secret,
      slackAuthedUserId: agent.slack_authed_user_id || "",
      aiProvider: agent.ai_provider || "anthropic",
      aiApiKey: agent.ai_api_key,
      initialSkills: skills,
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
