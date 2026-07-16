// lib/partners/citation-stats.test.ts
// Tests para PA7-W3 agrupación de métricas de citas de aliados.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { groupStatsByContract } from "./citation-stats";
import type { CitationStatRow } from "@/app/api/partners/me/citation-stats/route";

function row(overrides: Partial<CitationStatRow>): CitationStatRow {
  return {
    contract_id: "contract-1",
    day: "2026-07-09",
    citations: 1,
    tenant_id: "t-demo",
    package_id: "pkg-1",
    ...overrides,
  };
}

test("agrupa 2 contratos por separado", () => {
  const stats: CitationStatRow[] = [
    row({ contract_id: "contract-1", day: "2026-07-09", citations: 3 }),
    row({ contract_id: "contract-2", day: "2026-07-09", citations: 5 }),
  ];

  const result = groupStatsByContract(stats);

  assert.equal(result.length, 2);
  const c1 = result.find((r) => r.contract_id === "contract-1");
  const c2 = result.find((r) => r.contract_id === "contract-2");
  assert.equal(c1?.total, 3);
  assert.equal(c2?.total, 5);
});

test("ordena los días de más reciente a más antiguo", () => {
  const stats: CitationStatRow[] = [
    row({ contract_id: "contract-1", day: "2026-07-05", citations: 1 }),
    row({ contract_id: "contract-1", day: "2026-07-09", citations: 2 }),
    row({ contract_id: "contract-1", day: "2026-07-07", citations: 3 }),
  ];

  const result = groupStatsByContract(stats);

  assert.equal(result.length, 1);
  assert.deepEqual(
    result[0].byDay.map((d) => d.day),
    ["2026-07-09", "2026-07-07", "2026-07-05"]
  );
});

test("el total del contrato suma correctamente todas sus filas", () => {
  const stats: CitationStatRow[] = [
    row({ contract_id: "contract-1", day: "2026-07-09", citations: 4 }),
    row({ contract_id: "contract-1", day: "2026-07-08", citations: 6 }),
  ];

  const result = groupStatsByContract(stats);

  assert.equal(result[0].total, 10);
  assert.equal(result[0].byDay.length, 2);
});

test("array vacío -> []", () => {
  assert.deepEqual(groupStatsByContract([]), []);
});
