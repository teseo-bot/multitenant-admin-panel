'use client';

import React, { useState } from 'react';
import { useCanvasStore } from '@/hooks/use-canvas-store';
import { ChevronDown, ChevronRight, Settings2, Type, Layout, Activity, Move } from 'lucide-react';

// Using a more specific type than any for the icon component
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true }: { title: string, icon: React.ElementType, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button 
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && <div className="p-3 pt-0 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

export function PropertiesPanel() {
  const { selectedNodeId, draftAttributes, updateDraftAttributes } = useCanvasStore();

  if (!selectedNodeId) {
    return (
      <aside className="w-64 border-l border-border bg-card p-4 text-sm text-muted-foreground flex items-center justify-center h-full">
        No element selected
      </aside>
    );
  }

  const currentAttrs = draftAttributes[selectedNodeId] || {
    cssClasses: [],
    inlineStyles: {},
    animationProps: { dataStart: 0, dataDuration: 1, dataTrackIndex: 0, ease: "power2.out", fromProps: {} },
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0 },
    content: null,
    visible: true,
    locked: false
  };

  const handleStyleChange = (key: string, value: string) => {
    updateDraftAttributes(selectedNodeId, {
      inlineStyles: { ...currentAttrs.inlineStyles, [key]: value }
    });
  };

  const handleTransformChange = (key: keyof typeof currentAttrs.transform, value: number) => {
    updateDraftAttributes(selectedNodeId, {
      transform: { ...currentAttrs.transform, [key]: value }
    });
  };

  const handleAnimationPropChange = (key: keyof typeof currentAttrs.animationProps, value: string | number | Record<string, string | number>) => {
    updateDraftAttributes(selectedNodeId, {
      animationProps: { ...currentAttrs.animationProps, [key]: value }
    });
  };

  const handleContentChange = (value: string) => {
    updateDraftAttributes(selectedNodeId, { content: value });
  };

  const applyAnimationPreset = (preset: string) => {
    let fromProps = {};
    let ease = "power2.out";
    
    switch (preset) {
      case 'fade-in': fromProps = { opacity: 0 }; break;
      case 'slide-up': fromProps = { opacity: 0, y: 50 }; break;
      case 'slide-left': fromProps = { opacity: 0, x: 50 }; break;
      case 'scale-up': fromProps = { opacity: 0, scale: 0.5 }; ease = "back.out(1.7)"; break;
      case 'blur-in': fromProps = { opacity: 0, filter: "blur(10px)" }; break;
    }

    updateDraftAttributes(selectedNodeId, {
      animationProps: { ...currentAttrs.animationProps, fromProps, ease }
    });
  };

  return (
    <aside className="w-64 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      <div className="h-14 border-b border-border flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center">
          <Settings2 className="w-4 h-4 mr-2" />
          <h2 className="font-semibold text-sm">Properties</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3 bg-muted/30 border-b border-border">
          <div className="text-xs text-muted-foreground font-mono truncate" title={selectedNodeId}>
            {selectedNodeId}
          </div>
        </div>

        <CollapsibleSection title="Content" icon={Type}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Text / Image URL</label>
            <textarea 
              className="w-full text-sm p-2 border rounded bg-background resize-none h-20"
              value={currentAttrs.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Override content..."
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Style" icon={Layout}>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs text-muted-foreground">Background</label>
              <input 
                type="text" 
                placeholder="e.g. #ff0000"
                className="w-full text-sm p-1.5 border rounded bg-background"
                value={currentAttrs.inlineStyles['backgroundColor'] || ''}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Opacity</label>
              <input 
                type="number" min="0" max="1" step="0.1"
                className="w-full text-sm p-1.5 border rounded bg-background"
                value={currentAttrs.inlineStyles['opacity'] || ''}
                onChange={(e) => handleStyleChange('opacity', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Radius</label>
              <input 
                type="text" placeholder="4px"
                className="w-full text-sm p-1.5 border rounded bg-background"
                value={currentAttrs.inlineStyles['borderRadius'] || ''}
                onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Transform" icon={Move}>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Translate X</label>
              <input 
                type="number" 
                className="w-full text-sm p-1.5 border rounded bg-background"
                value={currentAttrs.transform.translateX || 0}
                onChange={(e) => handleTransformChange('translateX', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Translate Y</label>
              <input 
                type="number"
                className="w-full text-sm p-1.5 border rounded bg-background"
                value={currentAttrs.transform.translateY || 0}
                onChange={(e) => handleTransformChange('translateY', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Scale</label>
              <input 
                type="number" step="0.1"
                className="w-full text-sm p-1.5 border rounded bg-background"
                value={currentAttrs.transform.scaleX || 1}
                onChange={(e) => {
                  handleTransformChange('scaleX', parseFloat(e.target.value) || 1);
                  handleTransformChange('scaleY', parseFloat(e.target.value) || 1);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Rotate (deg)</label>
              <input 
                type="number"
                className="w-full text-sm p-1.5 border rounded bg-background"
                value={currentAttrs.transform.rotate || 0}
                onChange={(e) => handleTransformChange('rotate', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Animation" icon={Activity}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Start (s)</label>
                <input 
                  type="number" min="0" step="0.1"
                  className="w-full text-sm p-1.5 border rounded bg-background"
                  value={currentAttrs.animationProps.dataStart}
                  onChange={(e) => handleAnimationPropChange('dataStart', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Duration (s)</label>
                <input 
                  type="number" min="0.1" step="0.1"
                  className="w-full text-sm p-1.5 border rounded bg-background"
                  value={currentAttrs.animationProps.dataDuration}
                  onChange={(e) => handleAnimationPropChange('dataDuration', parseFloat(e.target.value) || 0.1)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Ease</label>
              <select 
                className="w-full text-sm p-1.5 border rounded bg-background"
                value={currentAttrs.animationProps.ease || "power2.out"}
                onChange={(e) => handleAnimationPropChange('ease', e.target.value)}
              >
                <option value="none">Linear (none)</option>
                <option value="power1.inOut">Power1 inOut</option>
                <option value="power2.out">Power2 out</option>
                <option value="power3.out">Power3 out</option>
                <option value="power4.out">Power4 out</option>
                <option value="back.out(1.7)">Back out</option>
                <option value="elastic.out(1, 0.3)">Elastic out</option>
                <option value="bounce.out">Bounce out</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs text-muted-foreground font-medium">Quick Presets</label>
              <div className="flex flex-wrap gap-1.5">
                {['fade-in', 'slide-up', 'slide-left', 'scale-up', 'blur-in'].map(preset => (
                  <button
                    key={preset}
                    onClick={() => applyAnimationPreset(preset)}
                    className="text-[10px] px-2 py-1 bg-muted hover:bg-primary/10 hover:text-primary rounded transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </aside>
  );
}
