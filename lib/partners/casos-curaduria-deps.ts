// lib/partners/casos-curaduria-deps.ts
// Las dependencias reales de lib/partners/casos-curaduria.ts. Aparte, para que los tests importen
// la lógica sin arrastrar la sesión ni el pool de control.

import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { compilerCuraduria, type CuraduriaDeps } from "@/lib/partners/casos-curaduria";

export const curaduriaDeps: CuraduriaDeps = {
  guard: requirePlatformAdmin,
  compiler: compilerCuraduria,
  query: (text, params) => pool.query(text, params as unknown[]),
  logError: (event, data) => logger.error(event, data),
};
