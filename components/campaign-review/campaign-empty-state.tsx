import React from 'react';
import { useCampaignReviewStore } from '../../stores/campaign-review-store';
import { Button } from '../ui/button';

export function CampaignEmptyState() {
  const { setCreateDialogOpen } = useCampaignReviewStore();

  return (
    <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-slate-50 text-center">
      <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-1">No campaigns found</h3>
      <p className="text-slate-500 mb-6 max-w-sm">
        You don&apos;t have any campaigns matching your current filters, or you haven&apos;t created any campaigns yet.
      </p>
      <Button onClick={() => setCreateDialogOpen(true)}>
        Create Campaign
      </Button>
    </div>
  );
}
