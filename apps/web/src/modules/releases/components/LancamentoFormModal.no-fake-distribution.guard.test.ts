/**
 * find-ed7823e9 — guarda permanente: criar um lançamento não pode simular
 * distribuição. O backend cria em DRAFT e só aceita SCHEDULED -> DISTRIBUTED;
 * o antigo PATCH status:"distributed" pós-create falhava com 400 depois do
 * create bem-sucedido. Também garante que a página não grava share 100%
 * automático ("distribuição automática") na criação.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MODAL = fs.readFileSync(path.resolve(__dirname, "LancamentoFormModal.tsx"), "utf8");
const PAGE = fs.readFileSync(path.resolve(__dirname, "../pages/Lancamentos.tsx"), "utf8");

describe("LancamentoFormModal — sem distribuição simulada", () => {
  it("não força status distributed nem distributedAt no fluxo de criação", () => {
    expect(MODAL).not.toMatch(/status:\s*"distributed"/);
    expect(MODAL).not.toMatch(/distributionCompletedAt/);
    expect(MODAL).not.toMatch(/onCreatedAndDistributed/);
  });

  it("a página não cria share automático ao criar lançamento", () => {
    expect(PAGE).not.toMatch(/ensureInitialShare/);
    expect(PAGE).not.toMatch(/distribuído com sucesso/);
    expect(PAGE).toMatch(/onCreated=\{handleReleaseCreated\}/);
  });
});
