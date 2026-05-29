"use client";

import React from "react";
import { CanvasNodeDef } from "@/types/canvas";
import { TrackSegment } from "./TrackSegment";
import { useCanvasStore } from "@/hooks/use-canvas-store";

interface TrackLanesProps {
  nodes: CanvasNodeDef[];
}

// Helper to flatten nodes
const flattenNodes = (nodes: CanvasNodeDef[]): CanvasNodeDef[] => {
  let flat: CanvasNodeDef[] = [];
  for (const node of nodes) {
    flat.push(node);
    if (node.children) {
      flat = flat.concat(flattenNodes(node.children));
    }
  }
  return flat;
};

export function TrackLanes({ nodes }: TrackLanesProps) {
  const totalDuration = useCanvasStore((state) => state.totalDuration);
  const flatNodes = flattenNodes(nodes);

  // Group by trackIndex
  const tracks: Record<number, CanvasNodeDef[]> = {};
  let maxTrackIndex = -1;
  flatNodes.forEach((node) => {
    const trackIndex = node.animation.trackIndex || 0;
    if (!tracks[trackIndex]) tracks[trackIndex] = [];
    tracks[trackIndex].push(node);
    if (trackIndex > maxTrackIndex) maxTrackIndex = trackIndex;
  });

  const numTracks = Math.max(3, maxTrackIndex + 1);
  const trackLanes = [];

  for (let i = 0; i < numTracks; i++) {
    trackLanes.push(
      <div
        key={`track-${i}`}
        className="relative h-8 border-b border-border/50 bg-background/50 hover:bg-background/80 transition-colors"
      >
        {tracks[i]?.map((node) => (
          <TrackSegment key={node.id} node={node} totalDuration={totalDuration} />
        ))}
      </div>
    );
  }

  return <div className="flex flex-col relative w-full">{trackLanes}</div>;
}
