import { PromptTemplate, PromptVersion } from "@/types/prompt";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VersionBadge } from "./version-badge";
import { formatDistanceToNow } from "date-fns";

interface PromptCardProps {
  template: PromptTemplate;
  activeVersion?: PromptVersion;
  onClick: () => void;
}

export function PromptCard({ template, activeVersion, onClick }: PromptCardProps) {
  const status = activeVersion ? activeVersion.status : 'draft';
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow duration-200"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg line-clamp-1">{template.name}</CardTitle>
            <Badge variant="secondary" className="font-normal capitalize">
              {template.role}
            </Badge>
          </div>
          <VersionBadge status={status} />
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2 min-h-[2.5rem]">
          {template.description || "No description provided."}
        </CardDescription>
        <div className="mt-4 flex items-center text-xs text-muted-foreground">
          <span>Updated {formatDistanceToNow(new Date(template.updatedAt), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
