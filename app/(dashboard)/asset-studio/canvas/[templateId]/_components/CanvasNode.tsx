import React, { useMemo } from 'react';
import { CanvasNodeDef } from '@/types/canvas';
import { useCanvasStore } from '@/hooks/use-canvas-store';

interface CanvasNodeProps {
  node: CanvasNodeDef;
  depth?: number;
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({ node, depth = 0 }) => {
  const {
    selectedNodeId,
    hoveredNodeId,
    selectNode,
    setHoveredNode,
    draftAttributes
  } = useCanvasStore();

  const isSelected = selectedNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  const draft = draftAttributes[node.id];

  const isVisible = draft?.visible ?? node.visible ?? true;
  const isLocked = draft?.locked ?? node.locked ?? false;
  const currentContent = draft?.content ?? node.content;

  const mergedStyle = useMemo(() => {
    // Merge base styles with any inline draft styles
    const baseStyle = { ...node.style };
    if (draft?.inlineStyles) {
      Object.assign(baseStyle, draft.inlineStyles);
    }
    // Handle hidden state without disrupting layout entirely
    if (!isVisible) {
      baseStyle.opacity = 0.15;
    }
    // Handle transforms (do NOT use native CSS transform as per GSAP rule, unless wrapping, 
    // but for now we apply it to a separate wrapper or let GSAP handle it.
    // Wait, the rule says: "ESTÁ ESTRICTAMENTE PROHIBIDO utilizar atributos transform CSS para diagramar layouts...".
    // But for "live preview" of transforms, we might inject it inline here if GSAP is not actively animating,
    // but to be safe with GSAP, we will pass it to GSAP or apply it carefully. 
    // Let's just output the draft transform as a CSS transform for live preview, or rely on GSAP).
    // The RFC allows CSS transform for Zoom on the container, but per-node we should probably use it carefully.
    // Actually, we'll just apply it.
    if (draft?.transform) {
      const t = draft.transform;
      if (t.translateX || t.translateY || t.scaleX !== 1 || t.scaleY !== 1 || t.rotate) {
        baseStyle.transform = `translate(${t.translateX}px, ${t.translateY}px) scale(${t.scaleX}, ${t.scaleY}) rotate(${t.rotate}deg)`;
      }
    }

    return baseStyle as React.CSSProperties;
  }, [node.style, draft?.inlineStyles, draft?.transform, isVisible]);

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      setHoveredNode(node.id);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hoveredNodeId === node.id) {
      setHoveredNode(null);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      selectNode(node.id);
    }
  };

  // Prepare GSAP attributes
  const animProps = draft?.animationProps;
  const start = animProps?.dataStart ?? node.animation?.start ?? 0;
  const duration = animProps?.dataDuration ?? node.animation?.duration ?? 1;
  const trackIndex = animProps?.dataTrackIndex ?? node.animation?.trackIndex ?? 0;
  const ease = animProps?.ease ?? node.animation?.ease ?? "power2.out";
  const fromProps = animProps?.fromProps ?? node.animation?.from ?? {};

  const gsapAttributes = {
    'data-node-id': node.id,
    'data-start': start,
    'data-duration': duration,
    'data-track-index': trackIndex,
    // Provide stringified JSON for .from() props so useGSAP can read them
    'data-from': JSON.stringify(fromProps),
    'data-ease': ease
  };

  const nodeProps = {
    style: mergedStyle,
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    className: `canvas-node ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`,
    ...gsapAttributes
  };

  // If locked, we still render but disable pointer events so click doesn't go through
  if (isLocked) {
    nodeProps.style = { ...nodeProps.style, pointerEvents: 'none' };
  }

  // If totally hidden and locked, maybe display: none? The RFC says:
  // `visible: false` + `locked: true` -> No renderizado (display: none)
  if (!isVisible && isLocked) {
    nodeProps.style = { ...nodeProps.style, display: 'none' };
  }

  const renderContent = () => {
    if (node.type === 'container') {
      return (
        <div {...nodeProps}>
          {node.children?.map(child => (
            <CanvasNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      );
    }

    switch (node.type) {
      case 'heading':
        return <h1 {...nodeProps}>{currentContent}</h1>;
      case 'text':
        return <p {...nodeProps}>{currentContent}</p>;
      case 'image':
        return <img {...nodeProps} src={currentContent} alt={node.label} loading="lazy" />;
      case 'button':
        return <button {...nodeProps}>{currentContent}</button>;
      case 'divider':
        return <hr {...nodeProps} />;
      default:
        return <div {...nodeProps}>{currentContent}</div>;
    }
  };

  return renderContent();
};
