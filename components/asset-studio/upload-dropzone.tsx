"use client";

import { useCallback } from "react";
import { useDropzone, FileRejection, FileError } from "react-dropzone";
import { UploadCloud, Loader2 } from "lucide-react";
import { useUploadDocument } from "@/hooks/mutations/use-upload-document";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UploadDropzone() {
  const { mutate: uploadDocs, isPending } = useUploadDocument();

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    // Handle rejected files
    fileRejections.forEach((rejection) => {
      const { file, errors } = rejection;
      const errorMessages = errors.map((e: FileError) => e.message).join(", ");
      toast.error(`Error con ${file.name}: ${errorMessages}`);
    });

    if (acceptedFiles.length === 0) return;

    uploadDocs(acceptedFiles, {
      onSuccess: () => {
        toast.success(`${acceptedFiles.length} archivo(s) subido(s) exitosamente.`);
      },
      onError: (err) => {
        toast.error(`Error de subida: ${err.message}`);
      }
    });
  }, [uploadDocs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
    disabled: isPending,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'text/markdown': ['.md'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }
  });

  return (
    <div 
      {...getRootProps()}
      className={cn(
        "relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer",
        isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/50",
        isPending && "pointer-events-none opacity-60"
      )}
    >
      <input {...getInputProps()} />
      
      {isPending ? (
        <>
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
          <h3 className="font-semibold text-lg">Subiendo...</h3>
          <p className="text-sm text-muted-foreground mt-1">Por favor espera un momento.</p>
        </>
      ) : isDragActive ? (
        <>
          <div className="p-4 bg-primary/10 rounded-full mb-4">
            <UploadCloud className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-lg text-primary">Suelta los archivos aquí...</h3>
        </>
      ) : (
        <>
          <div className="p-4 bg-muted rounded-full mb-4">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Haz clic o arrastra archivos aquí</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Soporta PDF, TXT, CSV, MD, JPG y PNG (Máx. 10MB)
          </p>
        </>
      )}
    </div>
  );
}
