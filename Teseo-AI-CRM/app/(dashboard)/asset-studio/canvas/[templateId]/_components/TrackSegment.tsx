"use client";

import React from "react";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import { CanvasNodeDef } from "@/types/canvas";

interface TrackSegmentProps {
  node: CanvasNodeDef;
  totalDuration: number;
}

export function TrackSegment({ node, totalDuration }: TrackSegmentProps) {
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const draftAttributes = useCanvasStore((state) => state.draftAttributes);

  const draft = draftAttributes[node.id];
  const start = draft?.animationProps?.dataStart ?? node.animation.start;
  const duration = draft?.animationProps?.dataDuration ?? node.animation.duration;

  const leftPercent = (start / totalDuration) * 100;
  const widthPercent = (duration / totalDuration) * 100;
  const isSelected = selectedNodeId === node.id;

  const colorMap: Record<string, string> = {
    text: "bg-blue-500/80 border-blue-600",
    heading: "bg-indigo-500/80 border-indigo-600",
    image: "bg-emerald-500/80 border-emerald-600",
    button: "bg-amber-500/80 border-amber-600",
    container: "bg-slate-500/80 border-slate-600",
    divider: "bg-zinc-500/80 border-zinc-600",
  };

  const bgClass = colorMap[node.type] || "bg-gray-500 border-gray-600";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        selectNode(node.id);
      }}
      className={`absolute top-1 bottom-1 rounded border text-[10px] px-1 overflow-hidden whitespace-nowrap cursor-pointer transition-colors hover:brightness-110 ${bgClass} ${
        isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
      }`}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }}
      title={`${node.label} (${start}s - ${start + duration}s)`}
    >
      {node.label}
    </div>
  );
}
