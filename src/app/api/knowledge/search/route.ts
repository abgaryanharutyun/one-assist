import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Auth via gateway token (called by agent VMs)
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q");
  const agentId = request.nextUrl.searchParams.get("agent_id");
  if (!q || !agentId) {
    return NextResponse.json({ error: "q and agent_id are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify gateway token belongs to this agent
  const { data: agent } = await admin
    .from("agents")
    .select("id, organization_id, gateway_token")
    .eq("id", agentId)
    .single();

  if (!agent || agent.gateway_token !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const embedding = await generateEmbedding(q);

  // Use pgvector similarity search via RPC
  const { data, error } = await admin.rpc("match_knowledge", {
    query_embedding: JSON.stringify(embedding),
    match_org_id: agent.organization_id,
    match_threshold: 0.5,
    match_count: 5,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data });
}
