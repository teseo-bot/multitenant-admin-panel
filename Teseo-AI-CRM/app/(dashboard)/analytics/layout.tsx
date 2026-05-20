import { enforceRoleAccess } from "@/utils/server/rbac";

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceRoleAccess(["owner", "admin"]);
  return <>{children}</>;
}
