import React from "react";
import { CanvasViewport } from "./_components/CanvasViewport";
import { PropertiesPanel } from "./_components/PropertiesPanel";
import { PlaybackBar } from "./_components/PlaybackBar";
import { SaveCanvasButton } from "./_components/SaveCanvasButton";
import { LayerPanel } from "./_components/LayerPanel";

export default function CanvasPage({
  params,
}: {
  params: { templateId: string };
}) {
  return (
    <div className="h-full flex flex-col w-full overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b flex items-center px-4 bg-background shrink-0">
        <h1 className="text-sm font-semibold">Canvas Editor</h1>
        <SaveCanvasButton templateId={params.templateId} />
      </header>

      <div className="flex-1 flex w-full overflow-hidden">
        {/* Panel lateral izquierdo para capas/nodos */}
        <LayerPanel templateId={params.templateId} />

        {/* Main Column */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Canvas Viewport central */}
          <div className="flex-1 bg-muted/50 p-4 relative overflow-hidden flex items-center justify-center">
            <CanvasViewport templateId={params.templateId} />
          </div>
          
          {/* Playback Bar (replaces TimelineScrubber) */}
          <div className="shrink-0">
            <PlaybackBar templateId={params.templateId} />
          </div>
        </main>

        {/* Panel derecho para propiedades */}
        <aside className="shrink-0 h-full">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}
