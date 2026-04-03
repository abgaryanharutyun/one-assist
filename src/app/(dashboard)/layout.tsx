import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const org = await getUserOrganization(supabase);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">One Assist</h1>
          {org && (
            <span className="text-sm text-muted-foreground">/ {org.name}</span>
          )}
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>
      <main className="max-w-5xl mx-auto py-8 px-4">{children}</main>
    </div>
  );
}
