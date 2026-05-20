export const queryKeys = {
  threads: {
    all:    ['leads'] as const,
    detail: (id: string) => ['leads', id] as const,
    messages: (id: string) => ['leads', id, 'messages'] as const,
  },
  leads: {
    all:    ['leads'] as const,
    detail: (id: string) => ['leads', id] as const,
    messages: (id: string) => ['leads', id, 'messages'] as const,
  },
  prompts: {
    all:        ['prompts'] as const,
    detail:     (id: string) => ['prompts', id] as const,
    versions:   (id: string) => ['prompts', id, 'versions'] as const,
    version:    (templateId: string, versionId: string) => ['prompts', templateId, 'versions', versionId] as const,
  },
  experiments: {
    all:        ['experiments'] as const,
    byTemplate: (templateId: string) => ['experiments', 'template', templateId] as const,
    detail:     (id: string) => ['experiments', id] as const,
    stats:      (id: string) => ['experiments', id, 'stats'] as const,
    timeSeries: (id: string, bucket: string) => ['experiments', id, 'timeSeries', bucket] as const,
  },
  variables: {
    all:        ['variables'] as const,
    detail:     (id: string) => ['variables', id] as const,
  },
  documents: {
    all:        ['documents'] as const,
    detail:     (id: string) => ['documents', id] as const,
    chunks:     (id: string) => ['documents', id, 'chunks'] as const,
  },
} as const;
