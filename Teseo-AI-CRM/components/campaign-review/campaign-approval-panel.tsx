import React from 'react';
import { useCampaignDetail } from '../../hooks/queries/use-campaign-detail';
import { useApproveCampaign } from '../../hooks/mutations/use-approve-campaign';
import { useUpdateCampaign } from '../../hooks/mutations/use-update-campaign';
import { Button } from '../ui/button';

interface CampaignApprovalPanelProps {
  campaignId: string;
}

export function CampaignApprovalPanel({ campaignId }: CampaignApprovalPanelProps) {
  const { data: campaign } = useCampaignDetail(campaignId);
  const { mutate: approve, isPending: isApproving } = useApproveCampaign();
  const { mutate: update, isPending: isUpdating } = useUpdateCampaign();

  if (!campaign || campaign.status !== 'pending_review') {
    return null; // Only show if pending review
  }

  const handleApprove = () => approve(campaignId);
  
  const handleReject = () => {
    update({ id: campaignId, data: { status: 'draft' } });
  };

  return (
    <div className="p-6 bg-blue-50 border border-blue-100 rounded-lg mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <div>
        <h3 className="text-lg font-medium text-blue-900 mb-1">Review Required</h3>
        <p className="text-sm text-blue-700">
          This campaign is pending approval. Please review the details and metrics before proceeding.
        </p>
      </div>
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={handleReject} 
          disabled={isApproving || isUpdating}
          className="bg-white"
        >
          {isUpdating ? 'Rejecting...' : 'Reject'}
        </Button>
        <Button 
          onClick={handleApprove} 
          disabled={isApproving || isUpdating}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isApproving ? 'Approving...' : 'Approve Campaign'}
        </Button>
      </div>
    </div>
  );
}
