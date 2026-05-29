"use client";

import { usePromptVersions } from "@/hooks/queries/use-prompt-versions";
import { useAssetStudioStore } from "@/stores/asset-studio-store";
import { VersionBadge } from "./version-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface VersionTimelineProps {
  templateId: string;
}

export function VersionTimeline({ templateId }: VersionTimelineProps) {
  const { data: versions, isLoading } = usePromptVersions(templateId);
  const { activeVersionId, setActiveVersion } = useAssetStudioStore();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  // Sort versions descending by versionNumber
  const sortedVersions = [...(versions || [])].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="flex flex-col h-full bg-muted/10 border-r">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">Versions</h3>
      </div>
      
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {sortedVersions.map((version) => {
          const isSelected = activeVersionId === version.id;
          return (
            <button
              key={version.id}
              onClick={() => setActiveVersion(version.id)}
              className={`w-full text-left p-3 rounded-md transition-colors ${
                isSelected 
                  ? "bg-primary/10 border border-primary/20" 
                  : "hover:bg-muted/50 border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">v{version.versionNumber}</span>
                <VersionBadge status={version.status} />
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {version.changelog || "No changes specified."}
              </div>
              <div className="text-[10px] text-muted-foreground mt-2">
                {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="p-4 border-t bg-muted/30">
        <Button variant="outline" className="w-full text-xs h-8">
          <Plus className="mr-2 h-3 w-3" />
          New Draft
        </Button>
      </div>
    </div>
  );
}
