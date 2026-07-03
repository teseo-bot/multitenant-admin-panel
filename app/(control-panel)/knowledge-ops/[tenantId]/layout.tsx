// app/(control-panel)/knowledge-ops/[tenantId]/layout.tsx
// UXUI §0: header compartido por todas las pantallas del tenant (P1 detalle, P2, P3, P4).
"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { KnowledgeOpsHeader } from "@/components/knowledge-ops/KnowledgeOpsHeader";
import { useKdbStatus, useErrorToast } from "@/lib/knowledge-ops/hooks";

interface TenantRow {
  id: string;
  name: string;
}

export default function KnowledgeOpsTenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const { data: status, isLoading, error, refetch } = useKdbStatus(tenantId);
  useErrorToast(error, refetch);

  const { data: tenants } = useQuery<TenantRow[]>({
    queryKey: ["tenants", "list-for-knowledge-ops"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const tenantName = tenants?.find((t) => t.id === tenantId)?.name ?? tenantId;

  return (
    <div className="flex flex-1 flex-col">
      <KnowledgeOpsHeader tenantName={tenantName} status={status} isLoading={isLoading} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
