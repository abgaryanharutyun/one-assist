import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">OpenClaw</h1>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-gray-600 hover:text-black">Sign out</button>
        </form>
      </header>
      <main className="max-w-2xl mx-auto py-12 px-4">{children}</main>
    </div>
  );
}
