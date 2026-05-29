import { create } from 'zustand';

interface AssetStudioState {
  activeTemplateId: string | null;
  activeVersionId: string | null;
  editorContent: string;
  isDirty: boolean;
  compareVersionIds: [string, string] | null;
  variablePanelOpen: boolean;

  // Extensions for Phase 3
  previewMode: boolean;
  experimentSetup: {
    step: number;
    selectedVersionIds: string[];
    trafficSplit: number[];
  } | null;

  setActiveTemplate: (id: string | null) => void;
  setActiveVersion: (id: string | null) => void;
  updateEditorContent: (content: string) => void;
  markClean: () => void;
  openCompare: (v1: string, v2: string) => void;
  closeCompare: () => void;
  toggleVariablePanel: () => void;
  
  // Phase 3 actions
  togglePreview: () => void;
  startExperimentSetup: () => void;
  updateExperimentSetup: (partial: Partial<{
    step: number;
    selectedVersionIds: string[];
    trafficSplit: number[];
  }>) => void;
  clearExperimentSetup: () => void;

  reset: () => void;
}

export const useAssetStudioStore = create<AssetStudioState>((set) => ({
  activeTemplateId: null,
  activeVersionId: null,
  editorContent: '',
  isDirty: false,
  compareVersionIds: null,
  variablePanelOpen: true,
  previewMode: false,
  experimentSetup: null,

  setActiveTemplate: (id) => set({ activeTemplateId: id }),
  setActiveVersion: (id) => set({ activeVersionId: id }),
  updateEditorContent: (content) => set({ editorContent: content, isDirty: true }),
  markClean: () => set({ isDirty: false }),
  openCompare: (v1, v2) => set({ compareVersionIds: [v1, v2] }),
  closeCompare: () => set({ compareVersionIds: null }),
  toggleVariablePanel: () => set((state) => ({ variablePanelOpen: !state.variablePanelOpen })),
  
  togglePreview: () => set((state) => ({ previewMode: !state.previewMode })),
  startExperimentSetup: () => set({ 
    experimentSetup: { step: 0, selectedVersionIds: [], trafficSplit: [] } 
  }),
  updateExperimentSetup: (partial) => set((state) => ({
    experimentSetup: state.experimentSetup ? { ...state.experimentSetup, ...partial } : null
  })),
  clearExperimentSetup: () => set({ experimentSetup: null }),

  reset: () => set({
    activeTemplateId: null,
    activeVersionId: null,
    editorContent: '',
    isDirty: false,
    compareVersionIds: null,
    variablePanelOpen: true,
    previewMode: false,
    experimentSetup: null,
  }),
}));
