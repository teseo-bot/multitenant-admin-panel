'use client';

import React from 'react';
import { useSaveCanvas } from '@/hooks/use-save-canvas';
import { useCanvasStore } from '@/hooks/use-canvas-store';
import { Button } from '@/components/ui/button';

export function SaveCanvasButton({ templateId }: { templateId: string }) {
  const { mutate: saveCanvas, isPending } = useSaveCanvas(templateId);
  const draftAttributes = useCanvasStore((state) => state.draftAttributes);
  const draftNodeOrder = useCanvasStore((state) => state.draftNodeOrder);

  const handleSave = () => {
    saveCanvas();
  };

  const hasDrafts = Object.keys(draftAttributes).length > 0 || draftNodeOrder !== null;

  return (
    <Button 
      onClick={handleSave} 
      disabled={!hasDrafts || isPending}
      size="sm"
      className="ml-auto"
    >
      {isPending ? 'Saving...' : 'Save Canvas'}
    </Button>
  );
}
