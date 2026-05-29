import { DocumentsTable } from "@/components/asset-studio/documents-table";
import { UploadDropzone } from "@/components/asset-studio/upload-dropzone";

export const metadata = {
  title: "Documentos | Asset Studio",
  description: "Ingesta de conocimiento corporativo para RAG.",
};

export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Base de Conocimiento (RAG)</h1>
        <p className="text-muted-foreground text-sm">
          Sube manuales, políticas y guías para que el orquestador pueda responder preguntas complejas.
        </p>
      </div>

      <UploadDropzone />
      
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Documentos Ingestados</h3>
        <DocumentsTable />
      </div>
    </div>
  );
}
