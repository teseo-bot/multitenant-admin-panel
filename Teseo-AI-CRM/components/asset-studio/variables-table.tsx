"use client";

import { useVariableDefs } from "@/hooks/queries/use-variable-defs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Variable, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function VariablesTable() {
  const { data: variables, isLoading, isError } = useVariableDefs();

  if (isLoading) {
    return (
      <div className="space-y-4 w-full">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError || !variables) {
    return (
      <div className="flex justify-center p-8 text-muted-foreground border rounded-md border-dashed">
        Error al cargar las Variables.
      </div>
    );
  }

  if (variables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-md border-dashed">
        <Variable className="h-12 w-12 mb-4 text-muted-foreground/50" />
        <p className="mb-4">No hay variables de entorno configuradas.</p>
      </div>
    );
  }

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'enum': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'url': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'number': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'json': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variable (Key)</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor por Defecto</TableHead>
            <TableHead>Requerida</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variables.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded-md w-fit">
                    {`{{${v.key}}}`}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">{v.label}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getTypeColor(v.type)}>
                  {v.type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm font-mono text-muted-foreground max-w-[200px] truncate">
                {v.defaultValue || <span className="italic opacity-50">null</span>}
              </TableCell>
              <TableCell>
                {v.required ? (
                  <Badge variant="default" className="bg-red-500 hover:bg-red-600 text-white">Sí</Badge>
                ) : (
                  <Badge variant="secondary">Opcional</Badge>
                )}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="ghost" size="icon" title="Editar">
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Eliminar" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
