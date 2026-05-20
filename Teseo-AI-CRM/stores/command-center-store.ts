import { create } from 'zustand';

interface CommandCenterState {
  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;
  activeTab: 'kanban' | 'inbox';
  setActiveTab: (tab: 'kanban' | 'inbox') => void;
  isInboxCollapsed: boolean;
  setIsInboxCollapsed: (v: boolean) => void;
  isLeadSheetOpen: boolean;
  setIsLeadSheetOpen: (v: boolean) => void;
}

export const useCommandCenterStore = create<CommandCenterState>((set) => ({
  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),
  activeTab: 'kanban',
  setActiveTab: (tab) => set({ activeTab: tab }),
  isInboxCollapsed: false,
  setIsInboxCollapsed: (v) => set({ isInboxCollapsed: v }),
  isLeadSheetOpen: false,
  setIsLeadSheetOpen: (v) => set({ isLeadSheetOpen: v }),
}));
