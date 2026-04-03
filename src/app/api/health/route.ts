import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import https from "https";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ready: false, status: "unauthenticated" });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("status, openclaw_url, vm_ip")
    .eq("user_id", user.id)
    .single();

  if (!tenant) {
    return NextResponse.json({ ready: false, status: "no_tenant" });
  }

  if (tenant.status !== "active" || !tenant.openclaw_url) {
    return NextResponse.json({ ready: false, status: tenant.status });
  }

  // Check if gateway is actually responding via HTTPS (self-signed cert)
  try {
    const ready = await new Promise<boolean>((resolve) => {
      const req = https.get(
        tenant.openclaw_url,
        { rejectUnauthorized: false, timeout: 5000 },
        (res) => resolve(res.statusCode !== undefined && res.statusCode < 500),
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
    });
    return NextResponse.json({ ready, status: "active" });
  } catch {
    return NextResponse.json({ ready: false, status: "gateway_starting" });
  }
}
