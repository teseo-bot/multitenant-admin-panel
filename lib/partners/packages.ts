// lib/partners/packages.ts
// Validación y esquemas para paquetes de aliados.

import { z } from "zod";

// Los 7 sistemas HOCFLIT de la taxonomía del OKF
const HOCFLIT_SYSTEMS = [
  "h-talento-humano",
  "o-operaciones",
  "c-comercial",
  "f-finanzas",
  "l-legal",
  "i-innovacion",
  "t-tecnologia",
] as const;

export const CreatePackageBodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]{2,59}$/, {
      message: "slug debe empezar con letra/número, contener solo minúsculas y guiones, 4-60 chars",
    }),
  title: z.string().min(3).max(120),
  description: z.string().max(500).default(""),
  systems: z
    .array(z.enum(HOCFLIT_SYSTEMS))
    .nonempty("systems no puede estar vacío"),
  altitude_max: z.number().int().min(1).max(5).default(3),
});

export type CreatePackageBody = z.infer<typeof CreatePackageBodySchema>;
