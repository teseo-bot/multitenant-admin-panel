import React from 'react';
import { useCampaigns } from '../../hooks/queries/use-campaigns';
import { useCampaignReviewStore } from '../../stores/campaign-review-store';
import { CampaignStatusBadge } from './campaign-status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Campaign } from '../../types/campaign';
import { CampaignEmptyState } from './campaign-empty-state';

export function CampaignListTable() {
  const { data: campaigns, isLoading, error } = useCampaigns();
  const { setSelectedCampaignId } = useCampaignReviewStore();

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading campaigns...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error loading campaigns</div>;
  }

  if (!campaigns || campaigns.length === 0) {
    return <CampaignEmptyState />;
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign: Campaign) => (
            <TableRow 
              key={campaign.id} 
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => setSelectedCampaignId(campaign.id)}
            >
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>
                <CampaignStatusBadge status={campaign.status} />
              </TableCell>
              <TableCell className="capitalize">{campaign.channel}</TableCell>
              <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
