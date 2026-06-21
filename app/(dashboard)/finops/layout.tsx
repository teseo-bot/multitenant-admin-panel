import { enforceRoleAccess } from "@/utils/server/rbac";

export default async function FinOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceRoleAccess(["OWNER", "ADMIN"]);
  return <>{children}</>;
}
