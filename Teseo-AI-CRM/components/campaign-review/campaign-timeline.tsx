import React from 'react';
import { useCampaignEvents } from '../../hooks/queries/use-campaign-events';
import { CampaignEventCard } from './campaign-event-card';

interface CampaignTimelineProps {
  campaignId: string;
}

export function CampaignTimeline({ campaignId }: CampaignTimelineProps) {
  const { data: events, isLoading, error } = useCampaignEvents(campaignId);

  if (isLoading) {
    return <div className="p-4 text-slate-500 text-sm">Loading timeline...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 text-sm">Failed to load timeline.</div>;
  }

  if (!events || events.length === 0) {
    return <div className="p-4 text-slate-500 text-sm italic">No events recorded for this campaign.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-slate-900 mb-4">Activity Timeline</h3>
      <div className="relative border-l-2 border-slate-200 ml-3 pl-6 pb-2">
        {events.map((event) => (
          <div key={event.id} className="relative mb-6">
            <div className="absolute -left-[35px] top-4 w-4 h-4 rounded-full bg-slate-200 border-2 border-white"></div>
            <CampaignEventCard event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}
