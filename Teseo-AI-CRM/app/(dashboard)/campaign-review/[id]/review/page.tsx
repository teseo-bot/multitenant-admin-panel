"use client";

import { useRouter } from "next/navigation";
import { CampaignDetailHeader } from "@/components/campaign-review/campaign-detail-header";
import { CampaignApprovalPanel } from "@/components/campaign-review/campaign-approval-panel";
import { CampaignMetricsSummary } from "@/components/campaign-review/campaign-metrics-summary";

export default function CampaignReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full bg-white rounded-md shadow-sm p-6 space-y-6">
      <CampaignDetailHeader 
        campaignId={params.id} 
        onBack={() => router.push(`/campaign-review/${params.id}`)} 
      />
      
      <div className="mt-2">
        <CampaignApprovalPanel campaignId={params.id} />
      </div>

      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-4">Performance Preview</h3>
        <CampaignMetricsSummary campaignId={params.id} />
      </div>
    </div>
  );
}