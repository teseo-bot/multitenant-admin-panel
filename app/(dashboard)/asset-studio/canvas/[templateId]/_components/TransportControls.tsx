"use client";

import React from "react";
import { Play, Pause, Square, Repeat, Rewind } from "lucide-react";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import { Button } from "@/components/ui/button";

export function TransportControls() {
  const isPlaying = useCanvasStore((state) => state.isPlaying);
  const play = useCanvasStore((state) => state.play);
  const pause = useCanvasStore((state) => state.pause);
  const stop = useCanvasStore((state) => state.stop);
  const isLooping = useCanvasStore((state) => state.isLooping);
  const toggleLoop = useCanvasStore((state) => state.toggleLoop);
  const playbackSpeed = useCanvasStore((state) => state.playbackSpeed);
  const setPlaybackSpeed = useCanvasStore((state) => state.setPlaybackSpeed);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-r border-border bg-background">
      <Button variant="ghost" size="icon" onClick={stop} title="Skip to Start" className="h-8 w-8">
        <Rewind className="w-4 h-4" />
      </Button>
      <Button
        variant={isPlaying ? "default" : "secondary"}
        size="icon"
        onClick={isPlaying ? pause : play}
        title={isPlaying ? "Pause" : "Play"}
        className="h-8 w-8"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={stop} title="Stop" className="h-8 w-8">
        <Square className="w-4 h-4" />
      </Button>
      <Button
        variant={isLooping ? "secondary" : "ghost"}
        size="icon"
        onClick={toggleLoop}
        title="Loop"
        className="h-8 w-8"
      >
        <Repeat className="w-4 h-4" />
      </Button>
      <select
        className="text-xs bg-transparent border border-border rounded px-1 h-8 ml-2"
        value={playbackSpeed}
        onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
      >
        <option value={0.5}>0.5x</option>
        <option value={1}>1x</option>
        <option value={2}>2x</option>
      </select>
    </div>
  );
}
