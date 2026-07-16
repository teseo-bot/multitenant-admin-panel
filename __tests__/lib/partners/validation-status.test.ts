import { describe, it } from "node:test";
import assert from "node:assert";
import { semaforoFor, countErrors, type ValidationStatus } from "@/lib/partners/validation-status";
import { ValidationReport } from "@/lib/partners/compiler-client";

describe("lib/partners/validation-status", () => {
  describe("semaforoFor", () => {
    it("returns 'gray' when report is undefined", () => {
      assert.strictEqual(semaforoFor(undefined), "gray");
    });

    it("returns 'green' when there are 0 findings", () => {
      const report: ValidationReport = {
        path: "test.md",
        findings: [],
        valid: true,
      };
      assert.strictEqual(semaforoFor(report), "green");
    });

    it("returns 'red' when there is at least 1 error", () => {
      const report: ValidationReport = {
        path: "test.md",
        findings: [
          {
            rule_id: "n1-test",
            level: "n1",
            severity: "error",
            message_es: "Error de prueba",
          },
        ],
        valid: false,
      };
      assert.strictEqual(semaforoFor(report), "red");
    });

    it("returns 'amber' when there are only warnings (no errors)", () => {
      const report: ValidationReport = {
        path: "test.md",
        findings: [
          {
            rule_id: "n2-test",
            level: "n2",
            severity: "warn",
            message_es: "Advertencia de prueba",
          },
        ],
        valid: true,
      };
      assert.strictEqual(semaforoFor(report), "amber");
    });

    it("returns 'red' when there are both errors and warnings", () => {
      const report: ValidationReport = {
        path: "test.md",
        findings: [
          {
            rule_id: "n1-error",
            level: "n1",
            severity: "error",
            message_es: "Error",
          },
          {
            rule_id: "n2-warn",
            level: "n2",
            severity: "warn",
            message_es: "Advertencia",
          },
        ],
        valid: false,
      };
      assert.strictEqual(semaforoFor(report), "red");
    });

    it("returns 'amber' when there are multiple warnings", () => {
      const report: ValidationReport = {
        path: "test.md",
        findings: [
          {
            rule_id: "n2-warn1",
            level: "n2",
            severity: "warn",
            message_es: "Advertencia 1",
          },
          {
            rule_id: "n2-warn2",
            level: "n2",
            severity: "warn",
            message_es: "Advertencia 2",
          },
        ],
        valid: true,
      };
      assert.strictEqual(semaforoFor(report), "amber");
    });
  });

  describe("countErrors", () => {
    it("returns 0 when report is undefined", () => {
      assert.strictEqual(countErrors(undefined), 0);
    });

    it("returns 0 when there are no errors", () => {
      const report: ValidationReport = {
        path: "test.md",
        findings: [
          {
            rule_id: "n2-warn",
            level: "n2",
            severity: "warn",
            message_es: "Advertencia",
          },
        ],
        valid: true,
      };
      assert.strictEqual(countErrors(report), 0);
    });

    it("counts only error-severity findings", () => {
      const report: ValidationReport = {
        path: "test.md",
        findings: [
          {
            rule_id: "n1-error1",
            level: "n1",
            severity: "error",
            message_es: "Error 1",
          },
          {
            rule_id: "n1-error2",
            level: "n1",
            severity: "error",
            message_es: "Error 2",
          },
          {
            rule_id: "n2-warn",
            level: "n2",
            severity: "warn",
            message_es: "Advertencia",
          },
        ],
        valid: false,
      };
      assert.strictEqual(countErrors(report), 2);
    });
  });
});
