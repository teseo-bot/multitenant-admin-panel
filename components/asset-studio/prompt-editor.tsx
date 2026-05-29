"use client";

import React, { useRef, useEffect } from "react";
import { useAssetStudioStore } from "@/stores/asset-studio-store";
import { PromptVersion } from "@/types/prompt";

interface PromptEditorProps {
  version: PromptVersion | null;
  readOnly: boolean;
  onSaveRequest?: () => void;
}

export function PromptEditor({ version, readOnly, onSaveRequest }: PromptEditorProps) {
  const { editorContent, updateEditorContent } = useAssetStudioStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onSaveRequest?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSaveRequest]);

  // Sync scrolling
  const handleScroll = () => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Generate highlighted HTML
  const generateHighlightedContent = (text: string) => {
    if (!text) return "";
    const varsInVersion = version?.variables?.map(v => v.key) || [];
    
    // Replace {{var}} with highlighted span
    // Note: this simple replace can break with HTML entities, but it's a basic implementation
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const isDefined = varsInVersion.includes(key);
        const colorClass = isDefined 
          ? "bg-emerald-200/50 text-emerald-800 rounded px-1" 
          : "bg-amber-200/50 text-amber-800 border-b-2 border-amber-400 border-dotted rounded px-1";
        return `<span class="${colorClass}">${match}</span>`;
      });
  };

  return (
    <div className="relative w-full h-full flex flex-col group border rounded-md overflow-hidden bg-background">
      <div className="relative flex-1 overflow-hidden font-mono text-sm">
        {/* Backdrop for highlights */}
        <div 
          ref={backdropRef}
          className="absolute inset-0 p-4 whitespace-pre-wrap break-words pointer-events-none text-transparent"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: generateHighlightedContent(editorContent) }}
        />
        {/* Actual Textarea */}
        <textarea
          ref={textareaRef}
          value={editorContent}
          onChange={(e) => updateEditorContent(e.target.value)}
          onScroll={handleScroll}
          readOnly={readOnly}
          className={`absolute inset-0 w-full h-full p-4 bg-transparent resize-none outline-none caret-black dark:caret-white ${
            readOnly ? "text-muted-foreground/80" : "text-foreground"
          }`}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
