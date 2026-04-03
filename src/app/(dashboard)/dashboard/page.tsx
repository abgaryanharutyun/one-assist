import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { redirect } from "next/navigation";
import { AgentCard, AddAgentCard } from "@/components/dashboard/agent-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);

  if (!org) {
    redirect("/onboarding");
  }

  const { data: agents } = await supabase
    .from("agents")
    .select("id, slack_app_name, slack_workspace_name, status, openclaw_url")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{org.name}</h2>
        <p className="text-muted-foreground">Manage your AI agents</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(agents || []).map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        <AddAgentCard />
      </div>
    </div>
  );
}
