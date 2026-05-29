import { create } from 'zustand';

export interface NodeAttributes {
  cssClasses: string[];
  inlineStyles: Record<string, string>;
  animationProps: {
    dataStart: number;
    dataDuration: number;
    dataTrackIndex: number;
    ease: string;
    fromProps: Record<string, string | number>;
  };
  transform: {
    translateX: number;
    translateY: number;
    scaleX: number;
    scaleY: number;
    rotate: number;
  };
  content: string | null;
  visible: boolean;
  locked: boolean;
}

export interface Snapshot {
  draftAttributes: Record<string, NodeAttributes>;
  draftNodeOrder: string[] | null;
}

export interface CanvasEditorState {
  // --- History State ---
  past: Snapshot[];
  future: Snapshot[];
  
  // --- Player State ---
  currentTime: number;
  isPlaying: boolean;
  
  // --- Editor State ---
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  
  // --- Layer Panel State ---
  draftNodeOrder: string[] | null; // null = use DB order
  
  // --- Zoom State ---
  zoomLevel: number;

  // --- Advanced Player State ---
  isLooping: boolean;
  playbackSpeed: number;
  totalDuration: number;

  // --- Transient Drafts (Mutaciones pre-guardado) ---
  draftAttributes: Record<string, NodeAttributes>;

  // --- Actions ---
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  selectNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  
  reorderNodes: (fromIndex: number, toIndex: number) => void;
  setDraftNodeOrder: (order: string[]) => void;
  
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;

  // --- Advanced Player Actions ---
  stop: () => void;
  toggleLoop: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setTotalDuration: (duration: number) => void;

  updateDraftAttributes: (nodeId: string, attributes: Partial<NodeAttributes>) => void;
  
  // --- History Actions ---
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
  
  clearDrafts: () => void;
  deleteNode: (nodeId: string) => void;
  
  // Backwards compatibility for existing code
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (currentTime: number) => void;
  setSelectedNode: (selectedNodeId: string | null) => void;
}

export const useCanvasStore = create<CanvasEditorState>((set, get) => ({
  past: [],
  future: [],
  currentTime: 0,
  isPlaying: false,
  selectedNodeId: null,
  hoveredNodeId: null,
  draftNodeOrder: null,
  zoomLevel: 1.0,
  isLooping: false,
  playbackSpeed: 1.0,
  totalDuration: 10.0,
  draftAttributes: {},

  saveHistory: () => set((state) => {
    const currentSnapshot: Snapshot = {
      draftAttributes: JSON.parse(JSON.stringify(state.draftAttributes)),
      draftNodeOrder: state.draftNodeOrder ? [...state.draftNodeOrder] : null
    };
    const newPast = [...state.past, currentSnapshot];
    // Keep max 50 entries
    if (newPast.length > 50) newPast.shift();
    return { past: newPast, future: [] };
  }),

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    const currentSnapshot: Snapshot = {
      draftAttributes: JSON.parse(JSON.stringify(state.draftAttributes)),
      draftNodeOrder: state.draftNodeOrder ? [...state.draftNodeOrder] : null
    };
    return {
      draftAttributes: previous.draftAttributes,
      draftNodeOrder: previous.draftNodeOrder,
      past: newPast,
      future: [currentSnapshot, ...state.future]
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    const currentSnapshot: Snapshot = {
      draftAttributes: JSON.parse(JSON.stringify(state.draftAttributes)),
      draftNodeOrder: state.draftNodeOrder ? [...state.draftNodeOrder] : null
    };
    return {
      draftAttributes: next.draftAttributes,
      draftNodeOrder: next.draftNodeOrder,
      past: [...state.past, currentSnapshot],
      future: newFuture
    };
  }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  seek: (time) => set({ currentTime: time }),
  stop: () => set({ isPlaying: false, currentTime: 0 }),
  toggleLoop: () => set((state) => ({ isLooping: !state.isLooping })),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setTotalDuration: (duration) => set({ totalDuration: duration }),
  
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
  
  reorderNodes: (fromIndex, toIndex) => {
    const state = get();
    if (!state.draftNodeOrder) return;
    state.saveHistory();
    set((state) => {
      if (!state.draftNodeOrder) return state;
      const newOrder = [...state.draftNodeOrder];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);
      return { draftNodeOrder: newOrder };
    });
  },
  setDraftNodeOrder: (order) => {
    get().saveHistory();
    set({ draftNodeOrder: order });
  },
  
  setZoomLevel: (level) => set({ zoomLevel: Math.min(Math.max(level, 0.25), 3.0) }),
  zoomIn: () => set((state) => ({ zoomLevel: Math.min(state.zoomLevel + 0.25, 3.0) })),
  zoomOut: () => set((state) => ({ zoomLevel: Math.max(state.zoomLevel - 0.25, 0.25) })),
  zoomToFit: () => set({ zoomLevel: 1.0 }),

  updateDraftAttributes: (nodeId, attributes) => {
    get().saveHistory();
    set((state) => {
      const existing = state.draftAttributes[nodeId] || {
        cssClasses: [],
        inlineStyles: {},
        animationProps: {
          dataStart: 0,
          dataDuration: 1,
          dataTrackIndex: 0,
          ease: "power2.out",
          fromProps: {}
        },
        transform: {
          translateX: 0,
          translateY: 0,
          scaleX: 1,
          scaleY: 1,
          rotate: 0
        },
        content: null,
        visible: true,
        locked: false
      };
      
      const newAttributes = { ...existing };
      
      if (attributes.cssClasses !== undefined) newAttributes.cssClasses = attributes.cssClasses;
      if (attributes.inlineStyles !== undefined) newAttributes.inlineStyles = { ...existing.inlineStyles, ...attributes.inlineStyles };
      if (attributes.animationProps !== undefined) newAttributes.animationProps = { ...existing.animationProps, ...attributes.animationProps };
      if (attributes.transform !== undefined) newAttributes.transform = { ...existing.transform, ...attributes.transform };
      if (attributes.content !== undefined) newAttributes.content = attributes.content;
      if (attributes.visible !== undefined) newAttributes.visible = attributes.visible;
      if (attributes.locked !== undefined) newAttributes.locked = attributes.locked;

      return {
        draftAttributes: {
          ...state.draftAttributes,
          [nodeId]: newAttributes
        }
      };
    });
  },
  
  clearDrafts: () => set({ draftAttributes: {}, draftNodeOrder: null }),
  
  deleteNode: (nodeId) => {
    get().saveHistory();
    set((state) => {
      const newDraftNodeOrder = state.draftNodeOrder ? state.draftNodeOrder.filter(id => id !== nodeId) : null;
      return { draftNodeOrder: newDraftNodeOrder };
    });
  },
  
  // Compatibility
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
}));
