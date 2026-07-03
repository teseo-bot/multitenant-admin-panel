// app/(control-panel)/knowledge-ops/[tenantId]/browser/page.tsx
// UXUI P3 — Bundle Browser (read-only).
"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConceptMetaTable } from "@/components/knowledge-ops/ConceptMetaTable";
import { MarkdownViewer } from "@/components/knowledge-ops/MarkdownViewer";
import { ErrorState } from "@/components/knowledge-ops/ErrorState";
import { useConcepts, useConceptContent, useErrorToast } from "@/lib/knowledge-ops/hooks";
import { buildConceptTree } from "@/lib/knowledge-ops/tree-utils";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
}

function TreeNodeComponent({
  node,
  expanded,
  onToggle,
  selected,
  onSelect,
  indent = 0,
}: {
  node: TreeNode;
  expanded: boolean;
  onToggle: (path: string) => void;
  selected: string | null;
  onSelect: (path: string) => void;
  indent?: number;
}) {
  const isFile = !node.isDirectory;

  return (
    <div>
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-1 px-2 py-1 text-sm hover:bg-muted rounded-sm transition-colors",
          isFile && selected === node.path && "bg-accent text-accent-foreground",
          isFile && selected !== node.path && "text-muted-foreground"
        )}
        style={{ paddingLeft: `${indent * 12 + 8}px` }}
        onClick={() => {
          if (isFile) {
            onSelect(node.path);
          } else {
            onToggle(node.path);
          }
        }}
      >
        {node.isDirectory && <span className="text-xs">{expanded ? "▼" : "▶"}</span>}
        {isFile && <span className="text-xs">📄</span>}
        <span>{node.name}</span>
      </button>
      {node.isDirectory && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              expanded={true}
              onToggle={onToggle}
              selected={selected}
              onSelect={onSelect}
              indent={indent + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeOpsBrowserPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const {
    data: concepts,
    isLoading: isLoadingConcepts,
    error: conceptsError,
    refetch: refetchConcepts,
  } = useConcepts(tenantId, { q: searchQuery || undefined });
  useErrorToast(conceptsError, refetchConcepts);

  const {
    data: conceptContent,
    isLoading: isLoadingContent,
    error: contentError,
    refetch: refetchContent,
  } = useConceptContent(tenantId, selectedPath);
  useErrorToast(contentError, refetchContent);

  const tree = useMemo(() => {
    if (!concepts) return [];
    const paths = concepts.map((c) => c.path);
    return buildConceptTree(paths);
  }, [concepts]);

  const handleToggle = (path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleLinkClick = (path: string) => {
    const normalizedPath = path.replace(/\.md$/, "").replace(/^\//, "");
    setSelectedPath(normalizedPath);
  };

  if (tree.length > 0 && expandedNodes.size === 0) {
    const firstSystemPath = tree[0]?.path;
    if (firstSystemPath) {
      setExpandedNodes(new Set([firstSystemPath]));
    }
  }

  const conceptTitle = conceptContent?.frontmatter
    ? String(conceptContent.frontmatter.title ?? "Concepto")
    : "Concepto";

  return (
    <div className="flex flex-1 flex-col h-full gap-4 p-6">
      <div className="space-y-2">
        <label htmlFor="search" className="text-sm font-medium">
          Buscar conceptos
        </label>
        <Input
          id="search"
          type="text"
          placeholder="Por título o descripción..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-64 border rounded-lg flex flex-col">
          <div className="border-b px-4 py-2 bg-muted">
            <h3 className="text-sm font-semibold">Sistemas</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoadingConcepts && (
                <>
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-6 w-32 ml-4 mb-2" />
                  <Skeleton className="h-6 w-36 ml-4" />
                </>
              )}
              {conceptsError && (
                <ErrorState
                  message={
                    conceptsError instanceof Error
                      ? conceptsError.message
                      : "Error al cargar conceptos"
                  }
                  onRetry={refetchConcepts}
                />
              )}
              {!isLoadingConcepts && tree.map((node) => (
                <TreeNodeComponent
                  key={node.path}
                  node={node}
                  expanded={expandedNodes.has(node.path)}
                  onToggle={handleToggle}
                  selected={selectedPath}
                  onSelect={setSelectedPath}
                  indent={0}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {!selectedPath && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Selecciona un concepto del árbol
            </div>
          )}

          {selectedPath && (
            <>
              {isLoadingContent && (
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              )}

              {contentError && (
                <ErrorState
                  message={
                    contentError instanceof Error
                      ? contentError.message
                      : "Error al cargar el concepto"
                  }
                  onRetry={refetchContent}
                />
              )}

              {conceptContent && (
                <div className="flex-1 overflow-auto space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{conceptTitle}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ConceptMetaTable frontmatter={conceptContent.frontmatter} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Contenido</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MarkdownViewer
                        content={conceptContent.body}
                        onLinkClick={handleLinkClick}
                      />
                    </CardContent>
                  </Card>

                  {conceptContent.log_entries && conceptContent.log_entries.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Historia</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          {conceptContent.log_entries.map((entry, idx) => (
                            <div
                              key={idx}
                              className="p-2 bg-muted rounded text-muted-foreground"
                            >
                              {entry}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {Array.isArray(conceptContent.frontmatter?.sources) &&
                    conceptContent.frontmatter.sources.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Fuentes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {(conceptContent.frontmatter.sources as string[]).map((src, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {src}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
