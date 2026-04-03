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

  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Invite token required" }, { status: 400 });
  }

  const admin = getAdminClient();

  try {
    // Find the invite
    const { data: invite, error: findError } = await admin
      .from("org_invites")
      .select("id, organization_id, role, status, expires_at")
      .eq("token", token)
      .single();

    if (findError || !invite) {
      return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invite already used" }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await admin.from("org_invites").update({ status: "expired" }).eq("id", invite.id);
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }

    // Check if user is already a member
    const { data: existing } = await admin
      .from("org_members")
      .select("id")
      .eq("organization_id", invite.organization_id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already a member of this organization" }, { status: 400 });
    }

    // Add user to org
    const { error: memberError } = await admin
      .from("org_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.role,
      });

    if (memberError) throw memberError;

    // Mark invite as accepted
    await admin.from("org_invites").update({ status: "accepted" }).eq("id", invite.id);

    return NextResponse.json({ success: true, organizationId: invite.organization_id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
