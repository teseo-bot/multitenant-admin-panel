import React from 'react';
import { CampaignEvent } from '../../types/campaign';

interface CampaignEventCardProps {
  event: CampaignEvent;
}

export function CampaignEventCard({ event }: CampaignEventCardProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'message_sent': return '📤';
      case 'message_received': return '📥';
      case 'tool_call': return '⚙️';
      case 'handoff_request': return '🙋';
      case 'handoff_completed': return '✅';
      case 'lead_qualified': return '🔥';
      case 'lead_lost': return '❄️';
      case 'state_change': return '🔄';
      case 'error': return '⚠️';
      case 'manual_override': return '👮';
      default: return '📝';
    }
  };

  return (
    <div className="flex gap-4 p-4 border rounded-lg bg-white shadow-sm mb-3">
      <div className="text-2xl mt-1">{getEventIcon(event.eventType)}</div>
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-medium text-slate-900 capitalize">
            {event.eventType.replace('_', ' ')}
          </h4>
          <span className="text-xs text-slate-500">
            {new Date(event.occurredAt).toLocaleString()}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Agent: {event.agentRole || 'N/A'} {event.leadId ? `| Lead: ${event.leadId}` : ''}
        </p>
        
        {event.payload && Object.keys(event.payload).length > 0 && (
          <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-500 font-mono overflow-x-auto">
            {JSON.stringify(event.payload, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
}
