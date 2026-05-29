import { createClient } from "@/utils/supabase/server";
import { UserRole } from "@/types/rbac";
import { redirect } from "next/navigation";

export async function getTenantRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role as UserRole;
}

export async function enforceRoleAccess(allowedRoles: UserRole[]): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  // Bypass for global admins
  const isGlobalAdmin = user.email === process.env.PLATFORM_ADMIN_EMAIL || user.email === 'admin@teseo.lat';
  if (isGlobalAdmin) {
    return;
  }

  const role = await getTenantRole(user.id);

  if (!role || !allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }
}
