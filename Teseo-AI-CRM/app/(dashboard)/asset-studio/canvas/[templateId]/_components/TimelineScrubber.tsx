'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/hooks/use-canvas-store';
import { Play, Pause } from 'lucide-react';

interface GsapTimelineLike {
  duration: () => number;
  play: () => void;
  pause: () => void;
  time: (value?: number) => number;
}

interface TimelineScrubberProps {
  templateId: string;
}

const getTimeline = (templateId: string): GsapTimelineLike | undefined => {
  if (typeof window === 'undefined') return undefined;
  const timelines = window.__timelines as unknown as Record<string, GsapTimelineLike> | undefined;
  return timelines?.[templateId];
};

export function TimelineScrubber({ templateId }: TimelineScrubberProps) {
  const { isPlaying, currentTime, play, pause, seek } = useCanvasStore();
  const [duration, setDuration] = useState<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tl = getTimeline(templateId);
    if (tl) {
      setDuration(tl.duration() || 0);
    } else {
      // Polling for the timeline in case it initializes slightly after component mount
      const interval = setInterval(() => {
        const t = getTimeline(templateId);
        if (t) {
          setDuration(t.duration() || 0);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [templateId]);

  useEffect(() => {
    const tl = getTimeline(templateId);
    if (!tl) return;

    if (isPlaying) {
      tl.play();
      const update = () => {
        seek(tl.time());
        rafRef.current = requestAnimationFrame(update);
      };
      rafRef.current = requestAnimationFrame(update);
    } else {
      tl.pause();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, templateId, seek]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seek(time);
    const tl = getTimeline(templateId);
    if (tl) {
      tl.pause();
      tl.time(time);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 border-t bg-background w-full">
      <button 
        onClick={handlePlayPause}
        className="p-2 rounded-full hover:bg-muted"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>

      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
          {currentTime.toFixed(1)}s
        </span>
        <input 
          type="range"
          min={0}
          max={duration || 10}
          step={0.01}
          value={currentTime}
          onChange={handleScrub}
          onMouseDown={() => pause()}
          className="flex-1"
        />
        <span className="text-xs tabular-nums text-muted-foreground w-10">
          {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
