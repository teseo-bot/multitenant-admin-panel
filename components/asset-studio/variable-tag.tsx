import { Badge } from "@/components/ui/badge";
import { VariableType } from "@/types/variable";
import { Type, Hash, List, ToggleLeft } from "lucide-react";

interface VariableTagProps {
  variableKey: string;
  status: 'matched' | 'undefined' | 'unused';
  type?: VariableType;
  onClick: () => void;
}

const TypeIcon = ({ type }: { type?: VariableType }) => {
  switch (type) {
    case 'number': return <Hash size={12} className="mr-1 opacity-70" />;
    case 'enum': return <List size={12} className="mr-1 opacity-70" />;
    case 'json': return <ToggleLeft size={12} className="mr-1 opacity-70" />;
    case 'text':
    case 'url':
    default: return <Type size={12} className="mr-1 opacity-70" />;
  }
};

export function VariableTag({ variableKey, status, type, onClick }: VariableTagProps) {
  let badgeClasses = "cursor-pointer transition-colors";
  let variant: "default" | "secondary" | "outline" = "outline";

  if (status === 'matched') {
    badgeClasses += " bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200";
    variant = "default";
  } else if (status === 'undefined') {
    badgeClasses += " bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200";
    variant = "secondary";
  } else {
    // unused
    badgeClasses += " hover:bg-muted";
  }

  return (
    <Badge 
      variant={variant} 
      className={badgeClasses}
      onClick={onClick}
    >
      <TypeIcon type={type} />
      <span>{variableKey}</span>
    </Badge>
  );
}
