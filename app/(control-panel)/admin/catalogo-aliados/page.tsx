// app/(control-panel)/admin/catalogo-aliados/page.tsx
// PA7-W4 — Catálogo interno de paquetes de aliados.
// Herramienta de venta de Knowledge Ops: lista paquetes publicados de aliados verificados.

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { filterCatalog, type CatalogItem } from "@/lib/partners/catalog";

interface CatalogResponse {
  items: CatalogItem[];
}

function useCatalog() {
  return useQuery<CatalogItem[]>({
    queryKey: ["admin", "partners", "catalog"],
    queryFn: async () => {
      const res = await fetch("/api/admin/partners/catalog");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al listar catálogo");
      }
      const data: CatalogResponse = await res.json();
      return data.items;
    },
  });
}

export default function CatalogAliados() {
  const { data: allItems, isLoading, error, refetch } = useCatalog();
  const [searchQuery, setSearchQuery] = useState("");

  const items = allItems ? filterCatalog(allItems, searchQuery) : [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Catálogo de paquetes</h2>
          <p className="text-muted-foreground mt-1">
            Paquetes publicados de aliados verificados — herramienta de venta de Knowledge Ops.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="text-sm">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filtrar por aliado, paquete o vertical..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aliado</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Paquete</TableHead>
                  <TableHead>Sistemas</TableHead>
                  <TableHead>Altitud máx</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead>Contratos activos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length > 0 ? (
                  items.map((item) => (
                    <TableRow key={`${item.partner_id}-${item.package_id}`}>
                      <TableCell className="font-medium">
                        <div>{item.legal_name}</div>
                        <div className="text-xs text-muted-foreground">{item.partner_slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.vertical}</Badge>
                      </TableCell>
                      <TableCell title={item.description} className="cursor-help">
                        <div>{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.package_slug}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.systems && item.systems.length > 0 ? (
                            item.systems.map((sys) => (
                              <Badge key={sys} variant="outline" className="text-xs">
                                {sys}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.altitude_max}</TableCell>
                      <TableCell>
                        {item.latest_version !== null ? `v${item.latest_version}` : "—"}
                      </TableCell>
                      <TableCell>
                        {item.active_contracts > 0 ? (
                          <Badge variant="default">{item.active_contracts}</Badge>
                        ) : (
                          <span className="text-muted-foreground">{item.active_contracts}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Sin paquetes publicados de aliados verificados todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
