"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useCanvasStore } from "@/hooks/use-canvas-store";

interface PlayheadProps {
  templateId: string;
}

export function Playhead({ templateId }: PlayheadProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isPlaying = useCanvasStore((state) => state.isPlaying);
  const currentTime = useCanvasStore((state) => state.currentTime);
  const totalDuration = useCanvasStore((state) => state.totalDuration);
  const isLooping = useCanvasStore((state) => state.isLooping);
  const playbackSpeed = useCanvasStore((state) => state.playbackSpeed);
  
  const stopStore = useCanvasStore((state) => state.stop);
  const seekStore = useCanvasStore((state) => state.seek);
  const setTotalDuration = useCanvasStore((state) => state.setTotalDuration);

  const [isDragging, setIsDragging] = useState(false);
  const lastSyncTime = useRef(0);
  const rafId = useRef<number | null>(null);

  // Sync GSAP state based on Zustand isPlaying
  useEffect(() => {
    const tl = window.__timelines?.[templateId];
    if (!tl) return;
    
    tl.timeScale(playbackSpeed);

    if (isPlaying) {
      tl.play();
    } else {
      tl.pause();
    }
  }, [isPlaying, playbackSpeed, templateId]);

  // Update total duration once timeline is ready
  useEffect(() => {
    const tl = window.__timelines?.[templateId];
    if (tl && tl.duration() > 0) {
      setTotalDuration(tl.duration());
    }
  }, [templateId, setTotalDuration]);

  // RAF loop for updating playhead position and throttled Zustand sync
  const updatePlayhead = useCallback(() => {
    const tl = window.__timelines?.[templateId];
    if (!tl) {
      if (isPlaying) {
        rafId.current = requestAnimationFrame(updatePlayhead);
      }
      return;
    }

    let time = tl.time();
    const duration = totalDuration || 1;

    // Handle loop end
    if (isPlaying && time >= duration) {
      if (isLooping) {
        tl.play(0);
        time = 0;
      } else {
        tl.pause();
        stopStore();
        time = duration; // Snap to end
      }
    }

    // Visual update (No re-render)
    if (playheadRef.current) {
      const percent = (time / duration) * 100;
      playheadRef.current.style.left = `${percent}%`;
    }

    // Throttled Zustand update (10fps = 100ms)
    const now = Date.now();
    if (now - lastSyncTime.current > 100) {
      seekStore(time);
      lastSyncTime.current = now;
    }

    if (isPlaying && !isDragging) {
      rafId.current = requestAnimationFrame(updatePlayhead);
    }
  }, [isPlaying, isDragging, templateId, totalDuration, isLooping, stopStore, seekStore]);

  useEffect(() => {
    if (isPlaying && !isDragging) {
      rafId.current = requestAnimationFrame(updatePlayhead);
    }
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isPlaying, isDragging, updatePlayhead]);

  // Sync visual position when currentTime changes externally (not during playback)
  useEffect(() => {
    if (!isPlaying && !isDragging && playheadRef.current && totalDuration > 0) {
      const percent = (currentTime / totalDuration) * 100;
      playheadRef.current.style.left = `${percent}%`;
      const tl = window.__timelines?.[templateId];
      if (tl && Math.abs(tl.time() - currentTime) > 0.01) {
        tl.time(currentTime);
      }
    }
  }, [currentTime, isPlaying, isDragging, totalDuration, templateId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    if (rafId.current) cancelAnimationFrame(rafId.current);
    
    const container = containerRef.current?.parentElement;
    if (!container) return;

    const tl = window.__timelines?.[templateId];
    if (tl) tl.pause();

    const updatePosition = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = x / rect.width;
      const newTime = percent * totalDuration;
      
      if (playheadRef.current) {
        playheadRef.current.style.left = `${percent * 100}%`;
      }
      
      if (tl) tl.time(newTime);
      seekStore(newTime);
    };

    updatePosition(e.clientX);

    const handlePointerMove = (e: PointerEvent) => {
      updatePosition(e.clientX);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      
      if (isPlaying && tl) {
        tl.play();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div className="absolute inset-0 pointer-events-none" ref={containerRef}>
      <div
        ref={playheadRef}
        className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-auto cursor-col-resize group flex justify-center"
        onPointerDown={handlePointerDown}
        style={{ left: "0%" }}
      >
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 absolute -top-0 group-hover:scale-125 transition-transform origin-top" />
        <div className="absolute -left-1 w-3 h-full cursor-col-resize" />
      </div>
    </div>
  );
}
