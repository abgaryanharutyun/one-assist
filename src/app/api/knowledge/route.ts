import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrganization } from "@/lib/organizations";
import { generateEmbedding } from "@/lib/embeddings";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("knowledge_items")
    .select("id, title, content, created_at, updated_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, content } = await request.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const embedding = await generateEmbedding(`${title}\n\n${content}`);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("knowledge_items")
    .insert({
      organization_id: org.id,
      title: title.trim(),
      content: content.trim(),
      embedding: JSON.stringify(embedding),
      created_by: org.userId,
    })
    .select("id, title, content, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
