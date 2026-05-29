import { z } from 'zod';

export const VariantSetupSchema = z.object({
  versionId: z.string().uuid(),
  trafficPct: z.number().min(0).max(100),
  label: z.string().length(1), // e.g. 'A', 'B'
});

export const CreateExperimentSchema = z.object({
  name: z.string().min(1).max(255),
  minImpressions: z.number().min(10).default(100),
  confidenceLevel: z.number().min(0.8).max(0.99).default(0.95),
  variants: z.array(VariantSetupSchema).min(2).max(5),
}).refine(data => {
  const totalTraffic = data.variants.reduce((acc, v) => acc + v.trafficPct, 0);
  return totalTraffic === 100;
}, {
  message: "La suma de trafficPct de todas las variantes debe ser 100",
  path: ["variants"],
});
