export function extractVariables(content: string): string[] {
  const matches = Array.from(content.matchAll(/\{\{(\w+)\}\}/g));
  const variables = matches.map(m => m[1]);
  return Array.from(new Set(variables));
}

export function interpolate(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return values[key] !== undefined ? values[key] : match;
  });
}
