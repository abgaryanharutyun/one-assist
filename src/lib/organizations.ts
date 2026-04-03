import { SupabaseClient } from "@supabase/supabase-js";

export async function getUserOrganization(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("user_id", user.id)
    .single();

  if (!membership) return null;

  const org = membership.organizations as unknown as { id: string; name: string };
  return {
    id: org.id,
    name: org.name,
    role: membership.role as string,
    userId: user.id,
  };
}

export async function createOrganization(supabase: SupabaseClient, name: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, created_by: user.id })
    .select()
    .single();

  if (orgError) throw orgError;

  const { error: memberError } = await supabase
    .from("org_members")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) throw memberError;

  return org;
}
