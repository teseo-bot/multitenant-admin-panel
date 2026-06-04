export default function TenantDatabasePage() {
  return (
    <div className="p-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Base de Datos (Multi-Tenant)</h1>
        <p className="text-muted-foreground mt-2">
          Estado y características de la BD, número de usuarios, tablas, registros, health checker y fecha/hora de la última acción.
        </p>
      </div>
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        Módulo en construcción.
      </div>
    </div>
  );
}
