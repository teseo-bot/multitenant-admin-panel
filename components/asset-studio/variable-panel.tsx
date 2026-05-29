"use client";

import { useVariableDefs } from "@/hooks/queries/use-variable-defs";
import { VariableTag } from "./variable-tag";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface VariablePanelProps {
  detectedVars: string[];
  onInsertVariable: (key: string) => void;
}

export function VariablePanel({ detectedVars, onInsertVariable }: VariablePanelProps) {
  const { data: definedVars } = useVariableDefs();
  
  const definedKeys = definedVars?.map((v) => v.key) || [];
  
  const matchedVars = detectedVars.filter((v) => definedKeys.includes(v));
  const undefinedVars = detectedVars.filter((v) => !definedKeys.includes(v));
  const unusedVars = definedKeys.filter((v) => !detectedVars.includes(v));

  const getDef = (key: string) => definedVars?.find((v) => v.key === key);

  return (
    <div className="flex flex-col h-full bg-muted/20 border-l">
      <div className="p-4 border-b bg-muted/40">
        <h3 className="font-medium text-sm">Variables</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Click to insert into your prompt.
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Matched Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-emerald-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              In Use & Defined ({matchedVars.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {matchedVars.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">None</span>
              ) : (
                matchedVars.map((v) => (
                  <VariableTag 
                    key={v} 
                    variableKey={v} 
                    status="matched" 
                    type={getDef(v)?.type}
                    onClick={() => onInsertVariable(v)} 
                  />
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* Undefined Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-amber-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Undefined ({undefinedVars.length})
            </h4>
            <p className="text-[10px] text-muted-foreground">Found in text but not defined.</p>
            <div className="flex flex-wrap gap-2">
              {undefinedVars.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">None</span>
              ) : (
                undefinedVars.map((v) => (
                  <VariableTag 
                    key={v} 
                    variableKey={v} 
                    status="undefined" 
                    onClick={() => onInsertVariable(v)} 
                  />
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* Available/Unused Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-300" />
              Available ({unusedVars.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {unusedVars.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">None</span>
              ) : (
                unusedVars.map((v) => (
                  <VariableTag 
                    key={v} 
                    variableKey={v} 
                    status="unused" 
                    type={getDef(v)?.type}
                    onClick={() => onInsertVariable(v)} 
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
