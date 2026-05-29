import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '@/hooks/use-canvas-store';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const HoverHighlight: React.FC = () => {
  const { hoveredNodeId, selectedNodeId, zoomLevel } = useCanvasStore();
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!hoveredNodeId || hoveredNodeId === selectedNodeId) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(`[data-node-id="${hoveredNodeId}"]`);
      const container = document.getElementById('canvas-container');
      
      if (el && container) {
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate position relative to the container, accounting for zoom
        setRect({
          top: (elRect.top - containerRect.top) / zoomLevel,
          left: (elRect.left - containerRect.left) / zoomLevel,
          width: elRect.width / zoomLevel,
          height: elRect.height / zoomLevel
        });
      } else {
        setRect(null);
      }
    };

    updateRect();
    
    // Add listeners for resize and scroll inside the container
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [hoveredNodeId, selectedNodeId, zoomLevel]);

  if (!rect) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: '2px dashed hsl(var(--primary) / 0.5)',
        pointerEvents: 'none',
        zIndex: 50
      }}
    />
  );
};
