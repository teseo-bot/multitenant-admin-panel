"use client";

import { useDocuments } from "@/hooks/queries/use-documents";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, File, AlertCircle, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DocumentsTable() {
  const { data: documents, isLoading, isError } = useDocuments();

  if (isLoading) {
    return (
      <div className="space-y-4 w-full">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError || !documents) {
    return (
      <div className="flex justify-center p-8 text-muted-foreground border rounded-md border-dashed">
        Error al cargar los Documentos.
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-md border-dashed">
        <File className="h-12 w-12 mb-4 text-muted-foreground/50" />
        <p>No hay documentos en la base de conocimiento.</p>
        <p className="text-sm mt-1">Sube archivos para alimentar el sistema RAG.</p>
      </div>
    );
  }

  const getStatusBadge = (status: string, error?: string | null) => {
    switch (status) {
      case "ready":
        return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Procesado</Badge>;
      case "processing":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Ingestando
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" title={error || "Error desconocido"}>
            <AlertCircle className="h-3 w-3 mr-1" /> Error
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Tamaño</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Subido</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {doc.name}
              </TableCell>
              <TableCell className="uppercase text-xs text-muted-foreground font-mono">
                {doc.file_type}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatSize(doc.size_bytes)}
              </TableCell>
              <TableCell>
                {getStatusBadge(doc.status, doc.error_message)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: es })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
