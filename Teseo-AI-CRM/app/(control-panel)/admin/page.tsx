export default function AdminOverviewPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Admin Overview</h2>
      </div>
      <div className="flex items-center justify-center h-[50vh] border rounded-lg border-dashed">
        <p className="text-muted-foreground">Admin overview content will appear here.</p>
      </div>
    </div>
  );
}
