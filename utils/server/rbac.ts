import { UserRole } from "@/types/rbac";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

export async function getTenantRole(userId: string): Promise<UserRole | null> {
  const res = await pool.query(
    "SELECT role FROM tenant_users WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  if (!res.rows[0]) {
    return null;
  }
  return res.rows[0].role as UserRole;
}

export async function enforceRoleAccess(allowedRoles: UserRole[]): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Bypass para Platform Admin (custom claim explícito, no email).
  if (user.platformAdmin) {
    return;
  }

  const role = await getTenantRole(user.id);

  if (!role || !allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }
}
