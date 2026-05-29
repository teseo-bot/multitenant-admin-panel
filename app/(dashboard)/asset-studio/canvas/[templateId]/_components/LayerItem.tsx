"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Lock, Unlock, Type, Image as ImageIcon, Box, Square, ChevronDown, Heading, Minus } from 'lucide-react';
import { useCanvasStore } from '@/hooks/use-canvas-store';
import { cn } from '@/lib/utils';
import { CanvasNodeDef } from '@/types/canvas';

interface LayerItemProps {
  node: CanvasNodeDef;
  depth?: number;
}

const TypeIcon = ({ type, className }: { type: string, className?: string }) => {
  switch (type) {
    case 'text': return <Type className={className} />;
    case 'heading': return <Heading className={className} />;
    case 'image': return <ImageIcon className={className} />;
    case 'button': return <Square className={className} />;
    case 'container': return <Box className={className} />;
    case 'divider': return <Minus className={className} />;
    default: return <Box className={className} />;
  }
};

export function LayerItem({ node, depth = 0 }: LayerItemProps) {
  const { 
    selectedNodeId, 
    selectNode, 
    hoveredNodeId, 
    setHoveredNode,
    draftAttributes,
    updateDraftAttributes
  } = useCanvasStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSelected = selectedNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  
  const draft = draftAttributes[node.id];
  const isVisible = draft?.visible ?? node.visible ?? true;
  const isLocked = draft?.locked ?? node.locked ?? false;

  const handleToggleVisible = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateDraftAttributes(node.id, { visible: !isVisible });
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateDraftAttributes(node.id, { locked: !isLocked });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      selectNode(node.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center h-8 pr-2 text-sm border-b border-border/50 transition-colors",
        isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground",
        isHovered && !isSelected && "bg-muted/50",
        isDragging && "opacity-50 z-50 bg-background shadow-md",
        !isVisible && "opacity-50"
      )}
      onClick={handleClick}
      onMouseEnter={() => setHoveredNode(node.id)}
      onMouseLeave={() => setHoveredNode(null)}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className={cn(
          "w-6 h-full flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors",
          isLocked && "pointer-events-none opacity-20"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Indentation (fake) */}
      <div style={{ width: `${depth * 16}px` }} />

      {/* Collapse Icon (if container) */}
      <div className="w-5 flex items-center justify-center">
        {node.type === 'container' && (
           <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        )}
      </div>

      {/* Type Icon */}
      <TypeIcon type={node.type} className="h-4 w-4 mr-2 opacity-70" />

      {/* Label */}
      <span className="flex-1 truncate select-none">
        {node.label}
      </span>

      {/* Quick Actions (visible on hover or if active) */}
      <div className={cn(
        "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
        (!isVisible || isLocked) && "opacity-100" // Always show if toggled
      )}>
        <button 
          onClick={handleToggleLock}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          {isLocked ? <Lock className="h-3.5 w-3.5 text-orange-500" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
        <button 
          onClick={handleToggleVisible}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}
