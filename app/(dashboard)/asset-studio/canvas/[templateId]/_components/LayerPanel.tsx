"use client";

import React from 'react';
import { Layers } from 'lucide-react';
import { useTemplate } from '@/hooks/use-template';
import { LayerTree } from './LayerTree';

export function LayerPanel({ templateId }: { templateId: string }) {
  const { data: template, isLoading } = useTemplate(templateId);

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col overflow-hidden h-full">
      <div className="h-14 border-b border-border flex items-center px-4 shrink-0">
        <Layers className="w-4 h-4 mr-2" />
        <h2 className="font-semibold text-sm">Layers</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : !template?.layout?.nodes || template.layout.nodes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No layers found
          </div>
        ) : (
          <LayerTree nodes={template.layout.nodes} />
        )}
      </div>
    </aside>
  );
}
