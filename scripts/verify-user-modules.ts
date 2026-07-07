// scripts/verify-user-modules.ts — G2-W2: verifica el guard del endpoint M2M.
// Casos 401/400 (sin BD). El caso "2 activos + 1 inactivo" ([INV-G4.3]) requiere
// BD sembrada → se valida en runtime contra control-plane.
import { GET } from "@/app/api/internal/user-modules/route";

type ReqArg = Parameters<typeof GET>[0];
function req(url: string, headers: Record<string, string> = {}): ReqArg {
  return new Request(url, { headers }) as unknown as ReqArg;
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

(async () => {
  process.env.M2M_API_KEY = "test-key";
  const base = "http://x/api/internal/user-modules";

  const r1 = await GET(req(`${base}?user_id=u&tenant_id=t`));
  check("sin api-key → 401", r1.status === 401);

  const r2 = await GET(req(`${base}?user_id=u&tenant_id=t`, { "x-api-key": "wrong" }));
  check("api-key incorrecta → 401", r2.status === 401);

  const r3 = await GET(req(base, { "x-api-key": "test-key" }));
  check("params faltantes → 400", r3.status === 400);

  console.log(`\nverify-user-modules: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
