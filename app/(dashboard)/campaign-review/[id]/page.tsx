"use client";

import { useRouter } from "next/navigation";
import { CampaignDetailHeader } from "@/components/campaign-review/campaign-detail-header";
import { CampaignMetricsSummary } from "@/components/campaign-review/campaign-metrics-summary";
import { CampaignTimeline } from "@/components/campaign-review/campaign-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full bg-white rounded-md shadow-sm p-6">
      <CampaignDetailHeader 
        campaignId={params.id} 
        onBack={() => router.push("/campaign-review")} 
      />
      
      <div className="flex justify-end mb-4">
        <Link href={`/campaign-review/${params.id}/review`}>
          <Button variant="default">Go to Approval Panel</Button>
        </Link>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics" className="space-y-6">
          <CampaignMetricsSummary campaignId={params.id} />
        </TabsContent>
        <TabsContent value="timeline">
          <CampaignTimeline campaignId={params.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}