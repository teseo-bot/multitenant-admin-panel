import { enforceRoleAccess } from "@/utils/server/rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceRoleAccess(["owner", "admin"]);
  return <>{children}</>;
}
