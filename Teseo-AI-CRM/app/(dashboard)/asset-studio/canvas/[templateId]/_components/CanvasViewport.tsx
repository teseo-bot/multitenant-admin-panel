"use client";

import React, { useRef, useEffect, useMemo } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useTemplate } from "@/hooks/use-template";
import { useCanvasStore } from "@/hooks/use-canvas-store";
import { useCanvasShortcuts } from "@/hooks/use-canvas-shortcuts";
import { CanvasNode } from "./CanvasNode";
import { HoverHighlight } from "./HoverHighlight";
import { SelectionOverlay } from "./SelectionOverlay";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";

gsap.registerPlugin(useGSAP);

interface CanvasViewportProps {
  templateId: string;
}

function CanvasViewportContent({ templateId }: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const { zoomLevel, draftAttributes } = useCanvasStore();
  const { data: template, isLoading, error } = useTemplate(templateId);

  // Enable keyboard shortcuts
  useCanvasShortcuts();

  // Setup window.__timelines context
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!window.__timelines) {
        window.__timelines = {};
      }
    }
  }, []);

  // Compute a dependency array that only changes when animation properties change
  const animationDeps = useMemo(() => {
    const deps: Record<string, unknown> = {};
    for (const key in draftAttributes) {
      if (draftAttributes[key]?.animationProps) {
        deps[key] = draftAttributes[key].animationProps;
      }
    }
    return JSON.stringify(deps);
  }, [draftAttributes]);

  const masterTl = useRef<gsap.core.Timeline | null>(null);

  useGSAP(() => {
    if (!containerRef.current || !template?.layout) return;
    
    if (!masterTl.current) {
      masterTl.current = gsap.timeline({
        paused: true,
        id: templateId
      });
      if (typeof window !== "undefined") {
        if (!window.__timelines) window.__timelines = {};
        window.__timelines[templateId] = masterTl.current;
      }
    } else {
      // Rebuild without flicker: clear the existing timeline and re-add tweens
      masterTl.current.clear();
    }

    const tl = masterTl.current;

    const animatableElements = gsap.utils.toArray<HTMLElement>("[data-start]", containerRef.current);

    animatableElements.forEach((el) => {
      const start = parseFloat(el.getAttribute("data-start") || "0");
      const duration = parseFloat(el.getAttribute("data-duration") || "1");
      const ease = el.getAttribute("data-ease") || "power3.out";
      const fromStr = el.getAttribute("data-from");
      
      let fromProps = { opacity: 0, y: 30 }; // Default fallback
      if (fromStr) {
        try {
          fromProps = JSON.parse(fromStr);
        } catch (e) {
          console.warn("Invalid data-from JSON", e);
        }
      }

      tl.from(el, {
        ...fromProps,
        duration,
        ease,
      }, start);
    });

    return () => {
      // We don't kill on every draft change, only on unmount
      // Wait, useGSAP cleans up when dependencies change. 
      // If we don't return kill() here, useGSAP will still remove the timeline when the component unmounts.
      // But if we return a cleanup that kills the timeline, it will kill it every time `animationDeps` changes!
      // So we shouldn't kill it in the return if it's just a dependency change.
      // Actually, `@gsap/react` `useGSAP` automatically reverts all GSAP animations created inside it when deps change!
      // This is a feature of `useGSAP`. It calls `ctx.revert()` which kills the timeline.
      // IF useGSAP reverts, our `masterTl.current` will be killed.
      // To bypass useGSAP reverting our master timeline, we could create it OUTSIDE the useGSAP or in a separate hook,
      // or we can just let useGSAP revert it and we re-create it, but that causes a flash!
      // The RFC says: "useGSAP en CanvasViewport use tl.clear() y no destruya el DOM ni el estado visual."
      // So we must NOT put `animationDeps` in `useGSAP`'s dependency array. Instead, we use a separate useEffect for updating!
    };
  }, { scope: containerRef, dependencies: [template?.layout, templateId] });

  // Separate effect to handle animation property changes without triggering useGSAP revert
  useEffect(() => {
    if (!masterTl.current || !containerRef.current) return;
    
    // Clear the timeline instead of destroying
    const tl = masterTl.current;
    const progress = tl.progress();
    const isPaused = tl.paused();
    
    tl.clear();
    
    const animatableElements = gsap.utils.toArray<HTMLElement>("[data-start]", containerRef.current);

    animatableElements.forEach((el) => {
      const start = parseFloat(el.getAttribute("data-start") || "0");
      const duration = parseFloat(el.getAttribute("data-duration") || "1");
      const ease = el.getAttribute("data-ease") || "power3.out";
      const fromStr = el.getAttribute("data-from");
      
      let fromProps = { opacity: 0, y: 30 };
      if (fromStr) {
        try {
          fromProps = JSON.parse(fromStr);
        } catch (e) {
          console.warn("Invalid data-from JSON", e);
        }
      }

      tl.from(el, {
        ...fromProps,
        duration,
        ease,
      }, start);
    });
    
    // Restore state
    tl.progress(progress);
    if (!isPaused) tl.play();
    
  }, [animationDeps]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30 p-8">
        <div className="w-full h-full max-w-4xl max-h-[800px] bg-card rounded-lg shadow-sm border border-border animate-pulse flex flex-col">
          <div className="w-full h-12 border-b border-border bg-muted/50" />
          <div className="flex-1 p-8">
            <div className="w-1/2 h-8 bg-muted rounded mb-4" />
            <div className="w-3/4 h-4 bg-muted rounded mb-2" />
            <div className="w-2/3 h-4 bg-muted rounded mb-8" />
            <div className="w-full h-64 bg-muted/50 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return <div className="w-full h-full flex items-center justify-center text-destructive">Error loading layout</div>;
  }

  return (
    <div 
      ref={outerContainerRef}
      className="w-full h-full bg-muted/30 overflow-auto relative flex items-center justify-center p-8"
    >
      <div 
        id="canvas-container"
        ref={containerRef}
        style={{
          width: template.layout.width,
          height: template.layout.height,
          background: template.layout.background,
          transform: `scale(${zoomLevel})`,
          transformOrigin: "center center",
          position: "relative",
          transition: "transform 0.2s ease-out"
        }}
        className="flex flex-col border shadow-lg overflow-hidden shrink-0"
      >
        {template.layout.nodes.map((node) => (
          <CanvasNode key={node.id} node={node} />
        ))}
        
        <HoverHighlight />
        <SelectionOverlay />
      </div>
    </div>
  );
}

export function CanvasViewport(props: CanvasViewportProps) {
  return (
    <CanvasErrorBoundary>
      <CanvasViewportContent {...props} />
    </CanvasErrorBoundary>
  );
}
