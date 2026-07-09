// __tests__/lib/partners/assist-mode.test.ts
// KL4-W2: tests unitarios para la lógica pura de decidir el mode del asistente.

import { describe, it } from "node:test";
import assert from "node:assert";
import { decidAssistMode } from "../../../lib/partners/assist-mode";
import type { ValidationReport } from "../../../lib/partners/compiler-client";

describe("decidAssistMode", () => {
  it("null report => reorganize", () => {
    const result = decidAssistMode(null);
    assert.strictEqual(result, "reorganize");
  });

  it("report vacío (sin findings) => reorganize", () => {
    const report: ValidationReport = {
      path: "test.md",
      findings: [],
      valid: true,
    };
    const result = decidAssistMode(report);
    assert.strictEqual(result, "reorganize");
  });

  it("report con solo warnings => reorganize", () => {
    const report: ValidationReport = {
      path: "test.md",
      findings: [
        {
          rule_id: "n2-body-largo",
          level: "n2",
          severity: "warn",
          message_es: "Cuerpo largo",
        },
      ],
      valid: true,
    };
    const result = decidAssistMode(report);
    assert.strictEqual(result, "reorganize");
  });

  it("report con al menos 1 error => fix_findings", () => {
    const report: ValidationReport = {
      path: "test.md",
      findings: [
        {
          rule_id: "n1-type-missing",
          level: "n1",
          severity: "error",
          message_es: "type es obligatorio",
        },
      ],
      valid: false,
    };
    const result = decidAssistMode(report);
    assert.strictEqual(result, "fix_findings");
  });

  it("report con errores y warnings => fix_findings", () => {
    const report: ValidationReport = {
      path: "test.md",
      findings: [
        {
          rule_id: "n1-type-missing",
          level: "n1",
          severity: "error",
          message_es: "type es obligatorio",
        },
        {
          rule_id: "n2-body-largo",
          level: "n2",
          severity: "warn",
          message_es: "Cuerpo largo",
        },
      ],
      valid: false,
    };
    const result = decidAssistMode(report);
    assert.strictEqual(result, "fix_findings");
  });
});
