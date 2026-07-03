// app/(control-panel)/knowledge-ops/[tenantId]/evals/page.tsx
// UXUI P4 — Evals: gráfica de scores + tabla de corridas + gestión de preguntas doradas.
"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/knowledge-ops/ErrorState";
import { useEvals, useErrorToast } from "@/lib/knowledge-ops/hooks";
import {
  filterLast12Weeks,
  enrichRunsWithDeltas,
  hasSignificantRegression,
} from "@/lib/knowledge-ops/eval-utils";
import { formatTimestamp } from "@/lib/knowledge-ops/format";

export default function KnowledgeOpsEvalsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const { data: evalData, isLoading, error, refetch } = useEvals(tenantId);
  useErrorToast(error, refetch);

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const processedRuns = useMemo(() => {
    if (!evalData?.runs) return [];
    const filtered = filterLast12Weeks(evalData.runs);
    return enrichRunsWithDeltas(filtered);
  }, [evalData?.runs]);

  const chartData = useMemo(() => {
    return [...processedRuns].reverse().map((run) => ({
      date: formatTimestamp(run.run_at),
      score: run.score,
    }));
  }, [processedRuns]);

  const hasRegression = useMemo(() => {
    return processedRuns.length > 0 && hasSignificantRegression(processedRuns);
  }, [processedRuns]);

  return (
    <div className="space-y-6 p-6">
      {/* Banner de alerta si hay regresión */}
      {hasRegression && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <h3 className="font-semibold text-sm text-destructive mb-1">
            Mirror bloqueado por regresión
          </h3>
          <p className="text-sm text-destructive/90">
            El score ha caído más de 10 puntos vs la corrida anterior. Revisar antes de
            aprobar.
          </p>
        </div>
      )}

      {/* Gráfica de línea */}
      <Card>
        <CardHeader>
          <CardTitle>Score de Evaluación (últimas 12 semanas)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-64 w-full" />}
          {error && (
            <ErrorState
              message={error instanceof Error ? error.message : "Error al cargar evals"}
              onRetry={refetch}
            />
          )}
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {!isLoading && chartData.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Sin corridas de evaluación aún
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla de corridas */}
      <Card>
        <CardHeader>
          <CardTitle>Corridas de Evaluación</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {error && (
            <ErrorState
              message={error instanceof Error ? error.message : "Error al cargar evals"}
              onRetry={refetch}
            />
          )}
          {processedRuns.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Δ vs anterior</TableHead>
                    <TableHead>Modelo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRuns.map((run) => {
                    const isExpanded = expandedRunId === run.id;
                    const hasDelta = run.delta !== undefined;
                    const deltaValue = run.delta ?? 0;
                    const isDeltaNegative = hasDelta && deltaValue < 0;

                    return (
                      <tbody key={run.id}>
                        <tr>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpandedRunId(isExpanded ? null : run.id)
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatTimestamp(run.run_at)}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold">{run.score}</span>
                          </TableCell>
                          <TableCell>
                            {hasDelta ? (
                              <Badge
                                variant={isDeltaNegative ? "destructive" : "default"}
                                className="font-mono"
                              >
                                {deltaValue > 0 ? "+" : ""}{deltaValue}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{run.model_version}</TableCell>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <TableCell colSpan={5} className="bg-muted p-4">
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm">
                                  Detalles por pregunta dorada
                                </h4>
                                {Object.entries(run.details || {}).length > 0 ? (
                                  <div className="space-y-2 text-sm">
                                    {Object.entries(run.details || {}).map(([key, value]) => {
                                      const detail = value as Record<string, unknown>;
                                      return (
                                        <div
                                          key={key}
                                          className="border-l-2 border-primary pl-3 py-2"
                                        >
                                          <div className="font-medium">{key}</div>
                                          <div className="text-muted-foreground text-xs space-y-1">
                                            <div>
                                              <strong>Respuesta:</strong>{" "}
                                              {String(detail?.answer || "—")}
                                            </div>
                                            <div>
                                              <strong>Referencia:</strong>{" "}
                                              {String(detail?.reference || "—")}
                                            </div>
                                            <div>
                                              <strong>Veredicto:</strong>{" "}
                                              {String(detail?.verdict || "—")}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground text-sm">
                                    Sin detalles disponibles
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!isLoading && processedRuns.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Sin corridas de evaluación en las últimas 12 semanas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gestión de preguntas doradas (TODO K8-W2) */}
      <Card>
        <CardHeader>
          <CardTitle>
            Preguntas Doradas ({evalData?.questions_count ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button disabled>+ Crear pregunta dorada</Button>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Disponible en K8-W2</strong> (endpoint de escritura pendiente)
              </p>
              <p className="text-xs">
                Los controles de creación/edición de preguntas doradas se se activarán cuando
                el endpoint de backend esté implementado en la épica K8-W2.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
