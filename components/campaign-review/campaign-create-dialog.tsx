import React, { useState } from 'react';
import { useCampaignReviewStore } from '../../stores/campaign-review-store';
import { useCreateCampaign } from '../../hooks/mutations/use-create-campaign';
import { Button } from '../ui/button';

export function CampaignCreateDialog() {
  const { isCreateDialogOpen, setCreateDialogOpen } = useCampaignReviewStore();
  const { mutate: createCampaign, isPending } = useCreateCampaign();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isCreateDialogOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createCampaign(
      { 
        name, 
        description,
        agentRoles: ['sdr'],
        channel: 'whatsapp'
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setName('');
          setDescription('');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-slate-900">Create New Campaign</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Summer Sale 2026"
              required
              disabled={isPending}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
              placeholder="Brief description of the campaign goals..."
              disabled={isPending}
            />
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setCreateDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
