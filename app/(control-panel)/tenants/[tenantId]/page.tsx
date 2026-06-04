import { enforceRoleAccess } from "@/utils/server/rbac";
import { TenantDetailsClient } from "./TenantDetailsClient";
import { getTenantOperationSettings, getTenantClientSettings } from "./_actions";
import { getBehaviorSettings } from "./_behaviorActions";
import { getTenantBranding } from "./_brandingActions";

export const dynamic = 'force-dynamic';

export default async function TenantDetailsPage({ params }: { params: { tenantId: string } }) {
  await enforceRoleAccess(["owner", "admin"]);
  
  const [opData, cliData, brandingData, behaviorData] = await Promise.all([
    getTenantOperationSettings(params.tenantId),
    getTenantClientSettings(params.tenantId),
    getTenantBranding(params.tenantId),
    getBehaviorSettings(params.tenantId),
  ]);

  return (
    <TenantDetailsClient 
      tenantId={params.tenantId} 
      initialOperationData={opData}
      initialClientData={cliData}
      initialBrandingData={brandingData}
      initialBehaviorData={behaviorData}
    />
  );
}
