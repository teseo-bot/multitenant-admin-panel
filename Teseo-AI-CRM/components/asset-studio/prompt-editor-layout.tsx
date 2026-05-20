"use client";

import { useEffect } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useAssetStudioStore } from "@/stores/asset-studio-store";
import { VersionTimeline } from "./version-timeline";
import { EditorToolbar } from "./editor-toolbar";
import { PromptEditor } from "./prompt-editor";
import { PromptPreview } from "./prompt-preview";
import { VariablePanel } from "./variable-panel";
import { PromptDiffViewer } from "./prompt-diff-viewer";
import { usePromptVersions } from "@/hooks/queries/use-prompt-versions";
import { useVariableDefs } from "@/hooks/queries/use-variable-defs";
import { extractVariables } from "@/lib/prompt-utils";
import { useSaveVersion } from "@/hooks/mutations/use-save-version";
import { usePromoteVersion } from "@/hooks/mutations/use-promote-version";

interface PromptEditorLayoutProps {
  templateId: string;
}

export function PromptEditorLayout({ templateId }: PromptEditorLayoutProps) {
  const { 
    activeVersionId, 
    setActiveVersion, 
    editorContent, 
    updateEditorContent,
    previewMode, 
    variablePanelOpen,
    compareVersionIds,
    openCompare,
    closeCompare,
    startExperimentSetup,
    markClean
  } = useAssetStudioStore();

  const { data: versions } = usePromptVersions(templateId);
  const { data: variableDefs } = useVariableDefs();
  const { mutate: saveVersion } = useSaveVersion();
  const { mutate: promoteVersion } = usePromoteVersion();

  const activeVersion = versions?.find(v => v.id === activeVersionId) || null;
  const isReadOnly = activeVersion?.status !== "draft";

  // When active version changes, initialize editor content
  useEffect(() => {
    if (activeVersion) {
      updateEditorContent(activeVersion.content);
      markClean();
    }
  }, [activeVersionId, activeVersion, updateEditorContent, markClean]);

  // Set default active version if none selected
  useEffect(() => {
    if (!activeVersionId && versions && versions.length > 0) {
      // Find active or newest
      const active = versions.find(v => v.status === "active") || versions[0];
      setActiveVersion(active.id);
    }
  }, [versions, activeVersionId, setActiveVersion]);

  const detectedVars = extractVariables(editorContent);
  
  const handleInsertVariable = (key: string) => {
    if (isReadOnly) return;
    updateEditorContent(editorContent + `{{${key}}}`);
  };

  const handleSave = () => {
    if (!activeVersionId) return;
    saveVersion(
      { templateId, content: editorContent },
      { onSuccess: () => markClean() }
    );
  };

  const handlePromote = () => {
    if (!activeVersionId) return;
    promoteVersion({ templateId, versionId: activeVersionId });
  };

  const handleNewTest = () => {
    startExperimentSetup();
  };

  const handleCompare = () => {
    if (!activeVersionId || !versions) return;
    const activeOrPrev = versions.find(v => v.status === "active" && v.id !== activeVersionId) || 
                         versions.find(v => v.id !== activeVersionId);
    
    openCompare(activeOrPrev ? activeOrPrev.id : activeVersionId, activeVersionId);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background border rounded-lg shadow-sm">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <VersionTimeline templateId={templateId} />
        </ResizablePanel>
        
        <ResizableHandle />
        
        <ResizablePanel defaultSize={80}>
          <div className="flex flex-col h-full">
            <EditorToolbar 
              templateName="Prompt Template" 
              version={activeVersion}
              onSave={handleSave}
              onPromote={handlePromote}
              onNewTest={handleNewTest}
              onCompare={handleCompare}
            />
            
            <div className="flex-1 flex overflow-hidden">
              <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel defaultSize={variablePanelOpen ? 70 : 100}>
                  {previewMode ? (
                    <PromptPreview 
                      content={editorContent} 
                      variables={variableDefs || []} 
                    />
                  ) : (
                    <PromptEditor 
                      version={activeVersion} 
                      readOnly={isReadOnly} 
                      onSaveRequest={handleSave} 
                    />
                  )}
                </ResizablePanel>

                {variablePanelOpen && (
                  <>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                      <VariablePanel 
                        detectedVars={detectedVars} 
                        onInsertVariable={handleInsertVariable} 
                      />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {(() => {
        if (!compareVersionIds || !versions) return null;
        const v1 = versions.find(v => v.id === compareVersionIds[0]);
        const v2 = versions.find(v => v.id === compareVersionIds[1]);
        if (!v1 || !v2) return null;
        
        return (
          <PromptDiffViewer 
            leftVersion={v1}
            rightVersion={v2}
            open={true}
            onClose={closeCompare}
          />
        );
      })()}
    </div>
  );
}
