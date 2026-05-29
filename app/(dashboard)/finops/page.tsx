import { FinOpsDashboard } from "@/components/finops-dashboard"
export default function FinOpsPage() {
  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">FinOps Engine</h1>
        <p className="text-muted-foreground text-sm">Dashboard de consumo y facturación de tokens por inquilino.</p>
      </div>
      <FinOpsDashboard />
    </div>
  )
}
