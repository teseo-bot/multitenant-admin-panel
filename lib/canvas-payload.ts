import { CanvasLayout, CanvasNodeDef, PersistedCanvasData } from '../types/canvas';
import { NodeAttributes } from '../hooks/use-canvas-store';

export function buildCanvasPayload(
  baseLayout: CanvasLayout,
  draftAttributes: Record<string, NodeAttributes>,
  draftNodeOrder: string[] | null,
  templateId: string,
  userId: string
): PersistedCanvasData {
  
  // 1. Merge de atributos sobre nodos base
  const mergedNodes = baseLayout.nodes.map((node) => {
    const draft = draftAttributes[node.id];
    if (!draft) return node; // Sin cambios → mantener original
    
    // Convert transform to inline styles if needed
    const transformStyles: Record<string, string | number> = {};
    if (draft.transform) {
      const { translateX, translateY, scaleX, scaleY, rotate } = draft.transform;
      if (translateX || translateY || scaleX !== 1 || scaleY !== 1 || rotate) {
        transformStyles.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY}) rotate(${rotate}deg)`;
      }
    }

    return {
      ...node,
      content: draft.content ?? node.content,
      visible: draft.visible ?? node.visible,
      locked: draft.locked ?? node.locked,
      style: { ...node.style, ...draft.inlineStyles, ...transformStyles },
      animation: {
        ...node.animation,
        start: draft.animationProps?.dataStart ?? node.animation.start,
        duration: draft.animationProps?.dataDuration ?? node.animation.duration,
        trackIndex: draft.animationProps?.dataTrackIndex ?? node.animation.trackIndex,
        ease: draft.animationProps?.ease ?? node.animation.ease,
        from: draft.animationProps?.fromProps 
          ? { ...node.animation.from, ...draft.animationProps.fromProps }
          : node.animation.from,
      },
    };
  });

  // 2. Aplicar orden de nodos (si fue reordenado)
  const nodeOrder = draftNodeOrder ?? baseLayout.nodes.map(n => n.id);
  
  // 3. Reordenar mergedNodes según nodeOrder
  const orderedNodes = nodeOrder
    .map(id => mergedNodes.find(n => n.id === id))
    .filter(Boolean) as CanvasNodeDef[];

  // 4. Capturar duración del timeline GSAP
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masterTl = typeof window !== 'undefined' ? (window as any).__timelines?.[templateId] : null;
  const totalDuration = masterTl?.duration?.() ?? 10.0;

  return {
    width: baseLayout.width,
    height: baseLayout.height,
    background: baseLayout.background,
    nodes: orderedNodes,
    nodeOrder,
    metadata: {
      savedAt: new Date().toISOString(),
      savedBy: userId,
      editorVersion: '5.5.0',
      totalDuration,
    },
  };
}