import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import https from "https";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ready: false, status: "unauthenticated" });
  }

  // Get user's organization
  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ ready: false, status: "no_org" });
  }

  // Get agents for the org
  const { data: agents } = await supabase
    .from("agents")
    .select("id, status, openclaw_url, vm_ip")
    .eq("organization_id", membership.organization_id);

  if (!agents || agents.length === 0) {
    return NextResponse.json({ ready: false, status: "no_agents" });
  }

  // Check the first active agent (or the most recent one)
  const activeAgent = agents.find((a) => a.status === "active") ?? agents[0];

  if (activeAgent.status !== "active" || !activeAgent.openclaw_url) {
    return NextResponse.json({ ready: false, status: activeAgent.status });
  }

  // Check if gateway is actually responding via HTTPS
  try {
    const ready = await new Promise<boolean>((resolve) => {
      const req = https.get(
        activeAgent.openclaw_url,
        { rejectUnauthorized: false, timeout: 5000 },
        (res) => resolve(res.statusCode !== undefined && res.statusCode < 500),
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
    });
    return NextResponse.json({ ready, status: "active", agentId: activeAgent.id });
  } catch {
    return NextResponse.json({ ready: false, status: "gateway_starting" });
  }
}
