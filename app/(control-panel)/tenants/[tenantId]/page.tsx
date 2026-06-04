import { enforceRoleAccess } from "@/utils/server/rbac";
import { TenantDetailsClient } from "./TenantDetailsClient";

export const dynamic = 'force-dynamic';

export default async function TenantDetailsPage({ params }: { params: { tenantId: string } }) {
  await enforceRoleAccess(["owner", "admin"]);
  return <TenantDetailsClient tenantId={params.tenantId} />;
}
