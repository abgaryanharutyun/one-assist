import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrganization } from "@/lib/organizations";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, instructions, script, script_language } = await request.json();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("skills")
    .update({
      ...(name && { name: name.trim() }),
      ...(description && { description: description.trim() }),
      ...(instructions && { instructions: instructions.trim() }),
      script: script?.trim() || null,
      script_language: script ? script_language : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", org.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ skill: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("skills")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
