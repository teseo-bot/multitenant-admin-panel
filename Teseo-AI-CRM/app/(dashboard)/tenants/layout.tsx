import { enforceRoleAccess } from "@/utils/server/rbac";

export default async function TenantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceRoleAccess(["owner", "admin"]);
  return <>{children}</>;
}
