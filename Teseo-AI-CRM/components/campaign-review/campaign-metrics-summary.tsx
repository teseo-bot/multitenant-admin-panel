import React from 'react';
import { useCampaignMetrics } from '../../hooks/queries/use-campaign-metrics';

interface CampaignMetricsSummaryProps {
  campaignId: string;
}

export function CampaignMetricsSummary({ campaignId }: CampaignMetricsSummaryProps) {
  const { data: metrics, isLoading, error } = useCampaignMetrics(campaignId);

  if (isLoading) {
    return <div className="animate-pulse h-24 bg-slate-100 rounded-md"></div>;
  }

  if (error || !metrics) {
    return <div className="p-4 text-red-500 text-sm border rounded-md">Failed to load metrics.</div>;
  }

  const formatNumber = (val: number) => val.toLocaleString();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="p-4 bg-white border rounded-lg shadow-sm">
        <p className="text-sm text-slate-500 mb-1">Messages Sent</p>
        <p className="text-2xl font-semibold text-slate-900">{formatNumber(metrics.messagesSent)}</p>
      </div>
      <div className="p-4 bg-white border rounded-lg shadow-sm">
        <p className="text-sm text-slate-500 mb-1">Unique Leads</p>
        <p className="text-2xl font-semibold text-slate-900">{formatNumber(metrics.uniqueLeads)}</p>
      </div>
      <div className="p-4 bg-white border rounded-lg shadow-sm">
        <p className="text-sm text-slate-500 mb-1">Leads Qualified</p>
        <p className="text-2xl font-semibold text-slate-900">{formatNumber(metrics.leadsQualified)}</p>
      </div>
      <div className="p-4 bg-white border rounded-lg shadow-sm">
        <p className="text-sm text-slate-500 mb-1">Handoffs Requested</p>
        <p className="text-2xl font-semibold text-slate-900">{formatNumber(metrics.handoffsRequested)}</p>
      </div>
    </div>
  );
}
