import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GatewayLoader } from "@/components/dashboard/gateway-loader";
import { AgentSkills } from "@/components/dashboard/agent-skills";
import Link from "next/link";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const supabase = await createClient();
  const org = await getUserOrganization(supabase);

  if (!org) redirect("/onboarding");

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("organization_id", org.id)
    .single();

  if (!agent) notFound();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">&larr; Back</Button>
        </Link>
        <h2 className="text-2xl font-bold">{agent.slack_app_name}</h2>
        <Badge variant={agent.status === "active" ? "default" : agent.status === "error" ? "destructive" : "secondary"}>
          {agent.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agent.slack_workspace_name && (
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Workspace:</span>{" "}
              {agent.slack_workspace_name}
            </div>
          )}
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Provider:</span>{" "}
            {agent.ai_provider}
          </div>
        </CardContent>
      </Card>

      {(agent.status === "provisioning" || agent.status === "active") && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Access</CardTitle>
          </CardHeader>
          <CardContent>
            <GatewayLoader
              openclawUrl={agent.openclaw_url}
              gatewayToken={agent.gateway_token}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentSkills agentId={agent.id} />
        </CardContent>
      </Card>

      {agent.status === "error" && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{agent.error_message}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
