import { create } from 'zustand';
import { CampaignStatus } from '../types/campaign';

interface CampaignFilters {
  search: string;
  status: CampaignStatus | 'all';
  dateRange: {
    start?: string;
    end?: string;
  };
}

interface CampaignReviewState {
  selectedCampaignId: string | null;
  filters: CampaignFilters;
  isCreateDialogOpen: boolean;
  
  setSelectedCampaignId: (id: string | null) => void;
  setFilters: (filters: Partial<CampaignFilters>) => void;
  setCreateDialogOpen: (isOpen: boolean) => void;
  resetFilters: () => void;
}

const defaultFilters: CampaignFilters = {
  search: '',
  status: 'all',
  dateRange: {},
};

export const useCampaignReviewStore = create<CampaignReviewState>((set) => ({
  selectedCampaignId: null,
  filters: defaultFilters,
  isCreateDialogOpen: false,
  
  setSelectedCampaignId: (id) => set({ selectedCampaignId: id }),
  setFilters: (newFilters) => set((state) => ({ 
    filters: { ...state.filters, ...newFilters } 
  })),
  setCreateDialogOpen: (isOpen) => set({ isCreateDialogOpen: isOpen }),
  resetFilters: () => set({ filters: defaultFilters }),
}));
