/**
 * LC1 guard: the invoice form payload carries only the canonical service_amount. The API derives the
 * legacy_amount mirror (InvoicesService.normalizePayload) so the web never writes it again.
 * Reading legacy_amount as a fallback (edit mode) stays until the legacy_amount drop is authorized.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "useInvoiceForm.ts"), "utf8");

describe("useInvoiceForm payload", () => {
  it("sends service_amount and never writes legacy_amount", () => {
    const start = SOURCE.indexOf("const servicesAmount = Number(formData.service_amount)");
    expect(start).toBeGreaterThan(-1);
    const payload = SOURCE.slice(start, start + 2500);
    expect(payload).toMatch(/service_amount: servicesAmount/);
    expect(payload).not.toMatch(/legacy_amount\s*:/);
  });
});
