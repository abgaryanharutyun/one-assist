import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrganization } from "@/lib/organizations";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string; skillId: string }> },
) {
  const { agentId, skillId } = await params;
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("agent_skills")
    .delete()
    .eq("agent_id", agentId)
    .eq("skill_id", skillId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
