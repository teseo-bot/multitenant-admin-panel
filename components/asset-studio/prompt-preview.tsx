"use client";

import { useState } from "react";
import { VariableDef } from "@/types/variable";
import { interpolate } from "@/lib/prompt-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PromptPreviewProps {
  content: string;
  variables: VariableDef[];
}

export function PromptPreview({ content, variables }: PromptPreviewProps) {
  // Use default values from definitions if available
  const initialValues = variables.reduce((acc, v) => {
    acc[v.key] = v.defaultValue || `[${v.key}]`;
    return acc;
  }, {} as Record<string, string>);

  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const previewContent = interpolate(content, values);

  return (
    <div className="flex h-full bg-background divide-x">
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto prose dark:prose-invert">
          <pre className="whitespace-pre-wrap font-sans text-sm p-4 bg-muted/30 rounded-lg border">
            {previewContent}
          </pre>
        </div>
      </div>
      
      {variables.length > 0 && (
        <div className="w-80 p-4 overflow-auto bg-muted/10">
          <h3 className="font-medium text-sm mb-4">Test Variables</h3>
          <div className="space-y-4">
            {variables.map((v) => (
              <div key={v.key} className="space-y-1.5">
                <Label htmlFor={v.key} className="text-xs">{v.label || v.key}</Label>
                <Input 
                  id={v.key}
                  value={values[v.key] || ''}
                  onChange={(e) => setValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
