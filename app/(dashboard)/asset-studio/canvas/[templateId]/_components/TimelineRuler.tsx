"use client";

import React from "react";
import { useCanvasStore } from "@/hooks/use-canvas-store";

export function TimelineRuler() {
  const totalDuration = useCanvasStore((state) => state.totalDuration) || 10; // Avoid NaN

  const ticks = [];
  // Tick every 0.5s or 1s depending on duration
  const step = totalDuration > 20 ? 1 : 0.5;

  for (let t = 0; t <= totalDuration; t += step) {
    const isMajor = t % 1 === 0;
    const percent = (t / totalDuration) * 100;
    
    ticks.push(
      <div
        key={t}
        className="absolute bottom-0 border-l border-border"
        style={{
          left: `${percent}%`,
          height: isMajor ? "100%" : "50%",
        }}
      >
        {isMajor && (
          <span className="absolute left-1 top-0 text-[10px] text-muted-foreground whitespace-nowrap">
            {t.toFixed(1)}s
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-6 bg-muted/20 border-b border-border overflow-hidden w-full">
      {ticks}
    </div>
  );
}
