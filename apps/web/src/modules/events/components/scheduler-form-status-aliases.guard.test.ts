/**
 * Guard: SchedulerFormModal no longer special-cases Portuguese status words
 * (events.status is English-only since migration 20260910000023; every caller hands
 * canonical English). Only the canonical-English planned/held mapping remains.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "SchedulerFormModal.tsx"), "utf8");
const BLOCK = SOURCE.slice(SOURCE.indexOf("const statusAliases"), SOURCE.indexOf("const normalizeSelectValue"));

describe("SchedulerFormModal status aliases", () => {
  it.each(["adiado", "agendado", "cancelado", "concluido", "confirmado", "negociacao", "pendente", "planejado", "realizado"])(
    "does not map the Portuguese status %s",
    (word) => {
      expect(BLOCK).not.toMatch(new RegExp(`\\b${word}\\b\\s*:`));
    },
  );

  it("keeps the canonical-English event status mapping", () => {
    expect(BLOCK).toMatch(/planned:\s*"scheduled"/);
    expect(BLOCK).toMatch(/held:\s*"completed"/);
  });
});
