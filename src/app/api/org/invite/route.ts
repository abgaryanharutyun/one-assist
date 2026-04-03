import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getUserOrganization } from "@/lib/organizations";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);

  if (!org || !["owner", "admin"].includes(org.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getAdminClient();
    const { data: invite, error } = await admin
      .from("org_invites")
      .insert({
        organization_id: org.id,
        invited_by: org.userId,
        role: "member",
      })
      .select("id, token")
      .single();

    if (error) throw error;

    const baseUrl = new URL(request.url).origin;
    const inviteUrl = `${baseUrl}/invite/${invite.token}`;

    return NextResponse.json({ inviteUrl, token: invite.token });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
