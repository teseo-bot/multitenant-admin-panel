"use client";

import React, { useRef } from "react";
import { TransportControls } from "./TransportControls";
import { TimelineRuler } from "./TimelineRuler";
import { TrackLanes } from "./TrackLanes";
import { Playhead } from "./Playhead";
import { useTemplate } from "@/hooks/use-template";

interface PlaybackBarProps {
  templateId: string;
}

export function PlaybackBar({ templateId }: PlaybackBarProps) {
  const { data: template, isLoading } = useTemplate(templateId);
  const containerRef = useRef<HTMLDivElement>(null);

  if (isLoading || !template) {
    return (
      <div className="h-48 border-t bg-background flex flex-col">
        <div className="h-12 border-b flex items-center px-4">
          <div className="animate-pulse bg-muted h-8 w-64 rounded" />
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading timeline...
        </div>
      </div>
    );
  }

  const nodes = template.layout.nodes || [];

  return (
    <div className="h-48 border-t bg-background flex flex-col select-none">
      <div className="flex border-b bg-muted/10 shrink-0">
        <TransportControls />
        <div className="flex-1 overflow-hidden relative border-l border-border/50">
          <TimelineRuler />
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative bg-muted/5 flex flex-col"
      >
        <div className="relative min-h-full w-full">
          <TrackLanes nodes={nodes} />
          <Playhead templateId={templateId} />
        </div>
      </div>
    </div>
  );
}
