"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Agent {
  id: string;
  slack_app_name: string;
  slack_workspace_name: string | null;
  status: string;
  openclaw_url: string | null;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  provisioning: "secondary",
  active: "default",
  error: "destructive",
  stopped: "outline",
  onboarding: "outline",
};

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-t from-primary/5 to-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {agent.slack_app_name}
          </CardTitle>
          <Badge variant={statusVariant[agent.status] || "outline"}>
            {agent.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {agent.slack_workspace_name || "Setting up..."}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function AddAgentCard() {
  return (
    <Link href="/agents/new">
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed flex items-center justify-center min-h-[120px]">
        <CardContent className="flex flex-col items-center gap-2 pt-6">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xl">
            +
          </div>
          <p className="text-sm text-muted-foreground">Add Agent</p>
        </CardContent>
      </Card>
    </Link>
  );
}
