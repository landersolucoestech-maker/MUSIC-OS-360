/**
 * ContractWizard.valor-persist.guard.test.ts
 *
 * Guarda permanente (CODEBASE_MAP Gotcha #22 — "Contract-creation wizard
 * never populates the `valor`/`fixed_value` column"): the primary
 * contract-creation flow had no field to set the contract's canonical value
 * at all -- money typed into a template's "currency" manifest variable (if
 * any) was serialized only into the wizardBlob/notes JSON. That silently fed
 * contracts.service.ts's CONTRACT_SIGNED handler `contractValor = 0` for the
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

describe("ContractWizard — valor do contrato persiste na coluna canônica (CODEBASE_MAP #22)", () => {
  it("WizardMeta declara o campo value", () => {
    expect(SOURCE).toMatch(/interface WizardMeta \{[\s\S]*?\bvalue: string;[\s\S]*?\}/);
  });

  it("inclui fixed_value (número parseado, não a string bruta) no payload enviado ao backend", () => {
    expect(SOURCE).toMatch(/fixed_value:\s*parsedValor,/);
  });

  it("popula meta.value a partir do contrato ao editar (não reinicia sempre vazio)", () => {
    expect(SOURCE).toMatch(/value:\s*contrato\.fixed_value\s*!=\s*null\s*\?\s*String\(contrato\.fixed_value\)\s*:\s*""/);
  });
});
