import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }

  try {
    // Use admin client to bypass RLS — user is already authenticated above
    const admin = getAdminClient();

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: name.trim(), created_by: user.id })
      .select()
      .single();

    if (orgError) throw orgError;

    const { error: memberError } = await admin
      .from("org_members")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) throw memberError;

    return NextResponse.json({ organization: org });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
