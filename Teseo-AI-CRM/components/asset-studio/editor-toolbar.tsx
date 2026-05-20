"use client";

import { PromptVersion } from "@/types/prompt";
import { Button } from "@/components/ui/button";
import { VersionBadge } from "./version-badge";
import { Eye, Code, Save, ArrowUpCircle, GitCompare, FlaskConical, LayoutPanelLeft, Camera } from "lucide-react";
import { useAssetStudioStore } from "@/stores/asset-studio-store";
import { useGenerateSnapshot } from "@/hooks/mutations/use-generate-snapshot";

interface EditorToolbarProps {
  templateName?: string;
  version: PromptVersion | null;
  onSave: () => void;
  onPromote: () => void;
  onNewTest: () => void;
  onCompare: () => void;
}

export function EditorToolbar({ 
  templateName = "Template", 
  version, 
  onSave, 
  onPromote, 
  onNewTest, 
  onCompare 
}: EditorToolbarProps) {
  const { isDirty, previewMode, togglePreview, variablePanelOpen, toggleVariablePanel } = useAssetStudioStore();
  const { mutate: generateSnapshot, isPending: isGeneratingSnapshot } = useGenerateSnapshot();

  const isDraft = version?.status === "draft";
  const isReadOnly = !isDraft;

  return (
    <div className="flex items-center justify-between h-14 px-4 border-b bg-background">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm">{templateName}</span>
        {version && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>/</span>
            <span>v{version.versionNumber}</span>
            <VersionBadge status={version.status} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleVariablePanel}
          className={variablePanelOpen ? "bg-muted" : ""}
          title="Toggle Variables Panel"
        >
          <LayoutPanelLeft className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button variant="outline" size="sm" onClick={togglePreview}>
          {previewMode ? (
            <><Code className="mr-2 h-4 w-4" /> Editor</>
          ) : (
            <><Eye className="mr-2 h-4 w-4" /> Preview</>
          )}
        </Button>

        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => version && generateSnapshot({ templateId: version.templateId, versionId: version.id })} 
          disabled={!version || isGeneratingSnapshot}
        >
          <Camera className={`mr-2 h-4 w-4 ${isGeneratingSnapshot ? 'animate-pulse' : ''}`} /> 
          {isGeneratingSnapshot ? 'Capturando...' : 'Snapshot'}
        </Button>

        <Button variant="outline" size="sm" onClick={onCompare} disabled={!version}>
          <GitCompare className="mr-2 h-4 w-4" /> Compare
        </Button>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={onSave} 
          disabled={!isDirty || isReadOnly}
        >
          <Save className="mr-2 h-4 w-4" /> Save Draft
        </Button>

        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onPromote} 
          disabled={isDirty || isReadOnly}
        >
          <ArrowUpCircle className="mr-2 h-4 w-4" /> Promote
        </Button>

        <Button size="sm" onClick={onNewTest} disabled={isDirty || isDraft}>
          <FlaskConical className="mr-2 h-4 w-4" /> New A/B Test
        </Button>
      </div>
    </div>
  );
}
