import { VariablesTable } from "@/components/asset-studio/variables-table";
import { VariableCreateDialog } from "@/components/asset-studio/variable-create-dialog";

export const metadata = {
  title: "Variables | Asset Studio",
  description: "Parámetros dinámicos del Tenant.",
};

export default function VariablesPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Variables de Entorno</h1>
          <p className="text-muted-foreground text-sm">
            Define pares de Key-Value (ej. Tono, Contacto) inyectables en los Prompts en tiempo real mediante {'{{llave}}'}.
          </p>
        </div>
        <VariableCreateDialog />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <VariablesTable />
      </div>
    </div>
  );
}
