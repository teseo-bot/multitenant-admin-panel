/**
 * components/lead-detail/SemanticPanel.tsx
 * 
 * Right column of LeadDetail — three tabbed sections:
 *   1. Resumen Semántico (AI)   — AI-generated summary, signals, suggested action
 *   2. Campos Reactivos (SSE)   — Etapa, Valor, Etiquetas (real-time via SSE)
 *   3. Expediente / Hunter      — OSINT entries from web search
 * 
 * All data fetched via TanStack Query hooks, refreshed by SSE invalidation.
 */

"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Zap,
  Globe,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Tag,
  DollarSign,
  GitBranch,
  Search,
  Loader2,
  Sparkles,
} from "lucide-react";

import { useSemanticSummary } from "@/hooks/queries/use-semantic-summary";
import { useOsintEntries } from "@/hooks/queries/use-osint-entries";
import { useOutboundTouchpoints } from "@/hooks/queries/use-outbound-touchpoints";
import type { Lead } from "@/types/lead";
import type { SemanticSignal, OsintEntry, OutboundEnrollment } from "@/types/outbound";

interface SemanticPanelProps {
  leadId: string;
  lead: Lead;
}

// ─── Sentiment Icons ──────────────────────────────────────────────────
const SENTIMENT_ICON: Record<string, React.ReactNode> = {
  positive: <TrendingUp className="w-3 h-3 text-green-500" />,
  negative: <TrendingDown className="w-3 h-3 text-red-500" />,
  neutral: <Minus className="w-3 h-3 text-gray-400" />,
};

export function SemanticPanel({ leadId, lead }: SemanticPanelProps) {
  const { data: summary, isLoading: summaryLoading } = useSemanticSummary(leadId);
  const { data: osintEntries, isLoading: osintLoading } = useOsintEntries(leadId);
  const { data: outboundData, isLoading: outboundLoading } = useOutboundTouchpoints(leadId);

  // ─── Reactive fields from lead metadata (updated via SSE) ─────────
  const dealValue = (lead.metadata as Record<string, unknown>)?.deal_value as number | undefined;
  const tags = ((lead.metadata as Record<string, unknown>)?.tags as string[]) ?? [];

  return (
    <div className="flex flex-col h-full min-h-0 bg-card">
      <Tabs defaultValue="summary" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-3 pb-0 shrink-0 gap-2 h-10">
          <TabsTrigger
            value="summary"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 bg-transparent pb-2 text-xs gap-1"
          >
            <Brain className="w-3.5 h-3.5" />
            Resumen IA
          </TabsTrigger>
          <TabsTrigger
            value="fields"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 bg-transparent pb-2 text-xs gap-1"
          >
            <Zap className="w-3.5 h-3.5" />
            Datos
          </TabsTrigger>
          <TabsTrigger
            value="expediente"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-2 bg-transparent pb-2 text-xs gap-1"
          >
            <Search className="w-3.5 h-3.5" />
            Expediente
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* ════════════════════════════════════════════════════════════ */}
          {/*  TAB 1: Resumen Semántico (AI)                             */}
          {/* ════════════════════════════════════════════════════════════ */}
          <TabsContent value="summary" className="p-4 m-0 space-y-5">
            {summaryLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : summary ? (
              <>
                {/* Headline */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Resumen IA
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium leading-relaxed">
                    {summary.headline}
                  </p>
                </div>

                {/* Signals */}
                {summary.signals.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Señales Detectadas
                    </h4>
                    <div className="space-y-1.5">
                      {summary.signals.map((signal: SemanticSignal, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/50 text-xs"
                        >
                          {SENTIMENT_ICON[signal.sentiment]}
                          <span className="font-medium">{signal.label}:</span>
                          <span className="text-muted-foreground flex-1 truncate">
                            {signal.value}
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4 capitalize">
                            {signal.source.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Action */}
                {summary.suggested_action && (
                  <div className="p-3 bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg text-xs leading-relaxed">
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      💡 Sugerencia:
                    </span>{" "}
                    {summary.suggested_action}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Generado:{" "}
                  {new Date(summary.generated_at).toLocaleString()}
                </p>
              </>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Aún no hay resumen semántico para este lead.
                <br />
                <span className="text-xs">
                  Se generará automáticamente tras las primeras interacciones.
                </span>
              </div>
            )}
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════ */}
          {/*  TAB 2: Campos Reactivos (SSE-driven)                      */}
          {/* ════════════════════════════════════════════════════════════ */}
          <TabsContent value="fields" className="p-4 m-0 space-y-5">
            {/* Etapa (Stage) — reactive via SSE */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> Etapa
              </h4>
              <Badge
                variant="outline"
                className="text-sm px-3 py-1"
              >
                {lead.status}
              </Badge>
            </div>

            {/* Valor (Deal Value) — reactive via SSE */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Valor del Negocio
              </h4>
              <p className="text-2xl font-bold tracking-tight">
                {dealValue != null
                  ? `$${dealValue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                  : "—"}
              </p>
            </div>

            {/* Etiquetas (Tags) — reactive via SSE */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" /> Etiquetas
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {tags.length > 0 ? (
                  tags.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sin etiquetas
                  </span>
                )}
              </div>
            </div>

            {/* ICP Score */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                ICP Score
              </h4>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-green-500 transition-all"
                    style={{ width: `${lead.icp_score ?? 0}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-8 text-right">
                  {lead.icp_score ?? "—"}
                </span>
              </div>
            </div>

            {/* Outbound Enrollment Status */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Secuencias Outbound
              </h4>
              {outboundLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (outboundData?.enrollments?.length ?? 0) > 0 ? (
                <div className="space-y-1.5">
                  {outboundData!.enrollments.map((enrollment: OutboundEnrollment) => (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/50 text-xs"
                    >
                      <span className="font-medium truncate">
                        {enrollment.sequence?.name || "Sequence"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">
                          Paso {enrollment.current_step}
                        </span>
                        <Badge variant="outline" className="text-[9px] h-4 capitalize">
                          {enrollment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  No inscrito en ninguna secuencia outbound
                </span>
              )}
            </div>

            {/* Source + Assigned Node */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Fuente
                </h4>
                <Badge variant="outline" className="text-xs capitalize">
                  {lead.source.replace("_", " ")}
                </Badge>
              </div>
              <div className="space-y-1">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Nodo Asignado
                </h4>
                <Badge variant="outline" className="text-xs capitalize">
                  {lead.assigned_node}
                </Badge>
              </div>
            </div>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════ */}
          {/*  TAB 3: Expediente / Hunter (OSINT)                        */}
          {/* ════════════════════════════════════════════════════════════ */}
          <TabsContent value="expediente" className="p-4 m-0 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3 h-3" /> Investigación OSINT
              </h3>
              {/* TODO (Executor): trigger Hunter agent to run OSINT search */}
              <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Search className="w-3 h-3" /> Buscar
              </button>
            </div>

            {osintLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (osintEntries?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {osintEntries!.map((entry: OsintEntry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] h-4 capitalize">
                          {entry.source}
                        </Badge>
                        <span className="text-xs font-medium truncate max-w-[200px]">
                          {entry.title}
                        </span>
                      </div>
                      {entry.url && (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {entry.snippet}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.fetched_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Sin datos de investigación aún.
                <br />
                <span className="text-xs">
                  El agente Hunter buscará información automáticamente o puedes
                  iniciar una búsqueda manual.
                </span>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
