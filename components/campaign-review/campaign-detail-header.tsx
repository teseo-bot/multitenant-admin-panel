import React from 'react';
import { useCampaignDetail } from '../../hooks/queries/use-campaign-detail';
import { CampaignStatusBadge } from './campaign-status-badge';
import { Button } from '../ui/button';

interface CampaignDetailHeaderProps {
  campaignId: string;
  onBack: () => void;
}

export function CampaignDetailHeader({ campaignId, onBack }: CampaignDetailHeaderProps) {
  const { data: campaign, isLoading } = useCampaignDetail(campaignId);

  if (isLoading || !campaign) {
    return <div className="animate-pulse h-20 bg-slate-100 rounded-md mb-6"></div>;
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b pb-6">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="sm" onClick={onBack} className="mt-1">
          &larr; Back
        </Button>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-slate-500">
            Created on {new Date(campaign.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline">Edit</Button>
        <Button>View Report</Button>
      </div>
    </div>
  );
}
