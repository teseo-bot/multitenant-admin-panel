import React from 'react';
import { useCampaignReviewStore } from '../../stores/campaign-review-store';
import { CampaignStatus } from '../../types/campaign';

export function CampaignFilters() {
  const { filters, setFilters } = useCampaignReviewStore();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: e.target.value });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ status: e.target.value as CampaignStatus | 'all' });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1">
        <input
          type="text"
          placeholder="Search campaigns..."
          value={filters.search}
          onChange={handleSearchChange}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      <div className="w-full sm:w-48">
        <select
          value={filters.status}
          onChange={handleStatusChange}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
    </div>
  );
}
