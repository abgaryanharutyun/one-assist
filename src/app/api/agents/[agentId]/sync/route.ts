import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  // Auth via gateway token (called by agent VMs)
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Verify agent and gateway token
  const { data: agent } = await admin
    .from("agents")
    .select("id, organization_id, gateway_token")
    .eq("id", agentId)
    .single();

  if (!agent || agent.gateway_token !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get assigned skills with full content
  const { data: assignments } = await admin
    .from("agent_skills")
    .select("skills(id, name, slug, description, instructions, script, script_language)")
    .eq("agent_id", agentId);

  const skills = (assignments || []).map((row) => row.skills).filter(Boolean);

  // Build knowledge search URL for built-in skill
  const platformUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : "";
  const baseUrl = process.env.PLATFORM_URL || platformUrl;

  return NextResponse.json({
    skills,
    knowledgeSearchUrl: `${baseUrl}/api/knowledge/search?agent_id=${agentId}`,
  });
}
