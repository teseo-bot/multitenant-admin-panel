"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCampaignReviewStore } from "@/stores/campaign-review-store";
import { CampaignListTable } from "@/components/campaign-review/campaign-list-table";
import { CampaignFilters } from "@/components/campaign-review/campaign-filters";
import { CampaignCreateDialog } from "@/components/campaign-review/campaign-create-dialog";
import { Button } from "@/components/ui/button";

export default function CampaignListPage() {
  const router = useRouter();
  const { selectedCampaignId, setSelectedCampaignId, setCreateDialogOpen } = useCampaignReviewStore();

  useEffect(() => {
    if (selectedCampaignId) {
      router.push(`/campaign-review/${selectedCampaignId}`);
      // Only reset it if we actually want to clear it, but maybe other components rely on it?
      // For a detailed page, typically we just navigate and let the detail page load data from URL.
      // We will reset it after a tiny delay so the transition can happen smoothly.
      const timer = setTimeout(() => {
        setSelectedCampaignId(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedCampaignId, router, setSelectedCampaignId]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          New Campaign
        </Button>
      </div>
      
      <CampaignFilters />
      
      <div className="flex-1 overflow-auto bg-white rounded-md shadow-sm">
        <CampaignListTable />
      </div>

      <CampaignCreateDialog />
    </div>
  );
}