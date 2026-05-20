import React from 'react';
import { Badge } from '../ui/badge';
import { CampaignStatus } from '../../types/campaign';

interface CampaignStatusBadgeProps {
  status: CampaignStatus;
}

export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  const variantMap: Record<CampaignStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    pending_review: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    active: 'default',
    paused: 'secondary',
    completed: 'outline',
  };

  const labelMap: Record<CampaignStatus, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
  };

  return (
    <Badge variant={variantMap[status]}>
      {labelMap[status]}
    </Badge>
  );
}
