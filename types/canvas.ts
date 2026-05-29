export interface CanvasLayout {
  width: number;
  height: number;
  background: string;
  nodes: CanvasNodeDef[];
}

export interface CanvasNodeDef {
  id: string;
  type: 'text' | 'heading' | 'image' | 'button' | 'container' | 'divider';
  label: string;
  content: string;
  children?: CanvasNodeDef[];
  style: Record<string, string | number>;
  animation: {
    start: number;
    duration: number;
    trackIndex: number;
    ease: string;
    from: Record<string, string | number>;
  };
  visible: boolean;
  locked: boolean;
}

// Extensión para persistencia (Sprint 5.5)
export interface PersistedCanvasData extends CanvasLayout {
  nodeOrder: string[];           // Orden visual de los nodos (z-index / layer order)
  metadata: CanvasMetadata;
}

export interface CanvasMetadata {
  savedAt: string;               // ISO 8601
  savedBy: string;               // user UUID
  editorVersion: string;         // semver del editor
  totalDuration: number;         // duración total del timeline en segundos
}
