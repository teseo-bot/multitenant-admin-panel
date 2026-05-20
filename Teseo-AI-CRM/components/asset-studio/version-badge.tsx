import { Badge } from "@/components/ui/badge";
import { VersionStatus } from "@/types/prompt";

interface VersionBadgeProps {
  status: VersionStatus;
}

export function VersionBadge({ status }: VersionBadgeProps) {
  switch (status) {
    case "draft":
      return <Badge variant="outline" className="text-muted-foreground">Draft</Badge>;
    case "active":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200">Active</Badge>;
    case "testing":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">Testing</Badge>;
    case "archived":
      return <Badge variant="outline" className="bg-slate-100 text-slate-500 hover:bg-slate-200">Archived</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}
