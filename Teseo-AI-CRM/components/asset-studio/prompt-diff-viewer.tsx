"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PromptVersion } from "@/types/prompt";
import * as Diff from "diff";

interface PromptDiffViewerProps {
  leftVersion: PromptVersion;
  rightVersion: PromptVersion;
  open: boolean;
  onClose: () => void;
}

export function PromptDiffViewer({ leftVersion, rightVersion, open, onClose }: PromptDiffViewerProps) {
  if (!leftVersion || !rightVersion) return null;

  const diffParts = Diff.diffWordsWithSpace(leftVersion.content, rightVersion.content);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Comparing v{leftVersion.versionNumber} → v{rightVersion.versionNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 bg-muted/20 border rounded-md font-mono text-sm whitespace-pre-wrap">
          {diffParts.map((part, index) => {
            const color = part.added
              ? "bg-emerald-200/50 text-emerald-900"
              : part.removed
              ? "bg-rose-200/50 text-rose-900 line-through"
              : "text-foreground";
            return (
              <span key={index} className={color}>
                {part.value}
              </span>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
