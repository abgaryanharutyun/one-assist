import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GatewayLoader } from "@/components/dashboard/gateway-loader";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*, gateway_token")
    .eq("user_id", user.id)
    .single();

  // No tenant yet — redirect to onboarding
  if (!tenant || tenant.status === "onboarding") {
    redirect("/onboarding");
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Slack Connection</h3>
          <StatusBadge status={tenant.status} />
        </div>

        {tenant.slack_workspace_name && (
          <div className="text-sm text-gray-600">
            <p><span className="font-medium">Workspace:</span> {tenant.slack_workspace_name}</p>
            <p><span className="font-medium">App:</span> {tenant.slack_app_name}</p>
          </div>
        )}

        {(tenant.status === "provisioning" || tenant.status === "active") && !tenant.openclaw_url && (
          <GatewayLoader />
        )}

        {tenant.status === "active" && tenant.openclaw_url && (
          <GatewayLoader openclawUrl={tenant.openclaw_url} gatewayToken={tenant.gateway_token} />
        )}

        {tenant.status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            Something went wrong: {tenant.error_message}
          </div>
        )}

      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    provisioning: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    stopped: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.stopped}`}>
      {status}
    </span>
  );
}
