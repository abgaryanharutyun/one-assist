import { createClient } from "@/lib/supabase/server";
import { getUserOrganization } from "@/lib/organizations";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const org = await getUserOrganization(supabase);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">One Assist</h1>
            {org && (
              <span className="text-sm text-muted-foreground">/ {org.name}</span>
            )}
          </div>
          {org && (
            <nav className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                Agents
              </Link>
              <Link href="/knowledge" className="text-sm text-muted-foreground hover:text-foreground">
                Knowledge
              </Link>
              <Link href="/skills" className="text-sm text-muted-foreground hover:text-foreground">
                Skills
              </Link>
            </nav>
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
