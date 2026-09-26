/**
 * scheduler-form-metadata-guard.test.ts
 *
 * Guarda permanente (auditoria 2026-07-18 — regra sem-metadata, eventos):
 * SchedulerFormModal.tsx `buildPayload` gravava endereco, contato_local,
 * valor_cache, publico_esperado, descricao, observacoes e participantes
 * dentro de `metadata`, mesmo já existindo coluna própria para cada um
 * (migration CrmFinanceOpsFormFieldColumns20260712000005 / EventEntity) —
 * os dados formais do formulário nunca chegavam às colunas reais.
 *
 * Este teste falha se o arquivo voltar a montar um objeto `metadata` a
 * partir de campos formais do formulário de evento.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "SchedulerFormModal.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("SchedulerFormModal — does not write formal fields into metadata", () => {
  it("no longer builds a `metadata` object from form data", () => {
    expect(SOURCE).not.toMatch(/metadata\["endereco"\]/);
    expect(SOURCE).not.toMatch(/metadata\["contato_local"\]/);
    expect(SOURCE).not.toMatch(/metadata\["valor_cache"\]/);
    expect(SOURCE).not.toMatch(/metadata\["publico_esperado"\]/);
    expect(SOURCE).not.toMatch(/metadata\["descricao"\]/);
    expect(SOURCE).not.toMatch(/metadata\["observacoes"\]/);
    expect(SOURCE).not.toMatch(/metadata\["status_legado"\]/);
    expect(SOURCE).not.toMatch(/metadata\["participants"\]/);
    expect(SOURCE).not.toMatch(/payload\["metadata"\]\s*=\s*metadata/);
  });

  it("sends the formal fields as top-level payload keys (own column via the DTO)", () => {
    expect(SOURCE).toMatch(/payload\["endereco"\]\s*=\s*data\.endereco/);
    expect(SOURCE).toMatch(/payload\["contato_local"\]\s*=\s*data\.contatoLocal/);
    expect(SOURCE).toMatch(/payload\["fee_amount"\]\s*=\s*valorCache/);
    expect(SOURCE).toMatch(/payload\["publico_esperado"\]\s*=\s*publicoEsperado/);
    expect(SOURCE).toMatch(/payload\["description"\]\s*=\s*data\.descricao/);
    expect(SOURCE).toMatch(/payload\["notes"\]\s*=\s*data\.observacoes/);
    expect(SOURCE).toMatch(/payload\["participantes"\]\s*=\s*data\.participantes/);
  });

  it("reads `participantes` primarily from the entity's real column, not only from legacy metadata", () => {
    expect(SOURCE).toMatch(/normalizeAgendaParticipants\(event\?\.participantes \?\? meta\["participants"\]\)/);
  });
});
