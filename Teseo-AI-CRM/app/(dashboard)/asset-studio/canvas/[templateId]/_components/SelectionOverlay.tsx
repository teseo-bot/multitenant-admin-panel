import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '@/hooks/use-canvas-store';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const SelectionOverlay: React.FC = () => {
  const { selectedNodeId, zoomLevel } = useCanvasStore();
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!selectedNodeId) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(`[data-node-id="${selectedNodeId}"]`);
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
    
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [selectedNodeId, zoomLevel]);

  if (!rect) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: '2px solid hsl(var(--primary))',
        pointerEvents: 'none',
        zIndex: 100
      }}
    >
      {/* Corner handles for future resize capabilities */}
      <div style={{ position: 'absolute', top: -4, left: -4, width: 8, height: 8, background: 'hsl(var(--primary))', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: 'hsl(var(--primary))', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: -4, left: -4, width: 8, height: 8, background: 'hsl(var(--primary))', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: -4, right: -4, width: 8, height: 8, background: 'hsl(var(--primary))', borderRadius: '50%' }} />
    </div>
  );
};
