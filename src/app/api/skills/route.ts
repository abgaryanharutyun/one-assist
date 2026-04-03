import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrganization } from "@/lib/organizations";
import { NextResponse } from "next/server";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ skills: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, instructions, script, script_language } = await request.json();

  if (!name?.trim() || !description?.trim() || !instructions?.trim()) {
    return NextResponse.json({ error: "Name, description, and instructions are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("skills")
    .insert({
      organization_id: org.id,
      name: name.trim(),
      slug: slugify(name.trim()),
      description: description.trim(),
      instructions: instructions.trim(),
      script: script?.trim() || null,
      script_language: script ? script_language : null,
      created_by: org.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ skill: data });
}
