import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrganization } from "@/lib/organizations";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("agent_skills")
    .select("skill_id, skills(id, name, slug, description, script_language)")
    .eq("agent_id", agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const skills = data.map((row) => row.skills);
  return NextResponse.json({ skills });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { skillId } = await request.json();
  if (!skillId) return NextResponse.json({ error: "skillId is required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("agent_skills")
    .insert({ agent_id: agentId, skill_id: skillId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
