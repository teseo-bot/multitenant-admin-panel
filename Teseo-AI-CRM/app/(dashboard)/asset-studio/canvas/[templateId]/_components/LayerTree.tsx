"use client";

import React, { useMemo } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CanvasNodeDef } from '@/types/canvas';
import { LayerItem } from './LayerItem';
import { useCanvasStore } from '@/hooks/use-canvas-store';

interface LayerTreeProps {
  nodes: CanvasNodeDef[];
  depth?: number;
}

export function LayerTree({ nodes, depth = 0 }: LayerTreeProps) {
  const { draftNodeOrder, setDraftNodeOrder } = useCanvasStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize draft order if not set
  React.useEffect(() => {
    if (!draftNodeOrder && nodes.length > 0) {
      setDraftNodeOrder(nodes.map(n => n.id));
    }
  }, [nodes, draftNodeOrder, setDraftNodeOrder]);

  const displayOrder = draftNodeOrder || nodes.map(n => n.id);

  // Sort nodes based on displayOrder
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      const indexA = displayOrder.indexOf(a.id);
      const indexB = displayOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [nodes, displayOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = displayOrder.indexOf(active.id as string);
      const newIndex = displayOrder.indexOf(over.id as string);
      
      const newOrder = arrayMove(displayOrder, oldIndex, newIndex);
      setDraftNodeOrder(newOrder);
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={displayOrder}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col">
          {sortedNodes.map(node => (
            <React.Fragment key={node.id}>
              <LayerItem node={node} depth={depth} />
              {/* Recursive rendering for children could go here, but dnd-kit sortable
                  gets complex with nested contexts. Assuming flat list for the immediate 
                  requirement or simple recursion. If children exist: */}
              {node.children && node.children.length > 0 && (
                <div className="flex flex-col">
                  {/* For deep drag-and-drop to fully work nested, we need multi-container dnd-kit. 
                      Since Phase 5.4B focuses on ordering within same level as basic req, 
                      we just render a simpler recursive list. */}
                  {node.children.map(child => (
                    <LayerItem key={child.id} node={child} depth={depth + 1} />
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
