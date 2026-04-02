import { createClient } from "@/lib/supabase/server";
import { provisionVM } from "@/lib/terraform";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { userId } = await request.json();

  // Get tenant data
  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  try {
    const result = provisionVM({
      tenantId: tenant.id,
      slackBotToken: tenant.slack_access_token,
      slackAppToken: tenant.slack_access_token,
    });

    // Update tenant with VM info
    await supabase
      .from("tenants")
      .update({
        vm_ip: result.vmIp,
        vm_name: result.vmName,
        openclaw_url: result.openclawUrl,
        status: "active",
      })
      .eq("id", tenant.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    await supabase
      .from("tenants")
      .update({ status: "error", error_message: err.message })
      .eq("id", tenant.id);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
