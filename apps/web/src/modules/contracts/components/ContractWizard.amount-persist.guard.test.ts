/**
 * ContractWizard.amount-persist.guard.test.ts
 *
 * Guarda permanente (CODEBASE_MAP Gotcha #22 — "Contract-creation wizard
 * never populates the `valor`/`fixed_value` column"): the primary
 * contract-creation flow had no field to set the contract's canonical value
 * at all -- money typed into a template's "currency" manifest variable (if
 * any) was serialized only into the wizardBlob/notes JSON. That silently fed
 * contract-events.handler.ts CONTRACT_SIGNED handler `contractAmount = 0` for the
 * provisional revenue transaction (a wrong financial record, not just a
 * missing "Valor Total" KPI), and every contract from the primary flow was
 * excluded from that KPI. This test fails if the regression returns.
 *
 * Cluster G (naming-normalization mandate) renamed the physical column
 * `valor` -> `fixed_value` and WizardMeta's local field `valor` -> `value`;
 * this guard's assertions were updated in lockstep.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ContractWizard.tsx"), "utf8");

describe("ContractWizard — the contract amount persists in the canonical column (CODEBASE_MAP #22)", () => {
  it("WizardMeta declares the value field", () => {
    expect(SOURCE).toMatch(/interface WizardMeta \{[\s\S]*?\bvalue: string;[\s\S]*?\}/);
  });

  it("includes fixed_value (parsed number, not the raw string) in the payload sent to the backend", () => {
    expect(SOURCE).toMatch(/fixed_value:\s*parsedAmount,/);
  });

  it("populates meta.value from the contract when editing (does not always reset to empty)", () => {
    expect(SOURCE).toMatch(/value:\s*contract\.fixed_value\s*!=\s*null\s*\?\s*String\(contract\.fixed_value\)\s*:\s*""/);
  });
});
