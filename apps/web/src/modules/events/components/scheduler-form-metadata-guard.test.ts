/**
 * scheduler-form-metadata-guard.test.ts
 *
 * Permanent guard (2026-07-18 audit — no-metadata rule, events):
 * SchedulerFormModal.tsx `buildPayload` wrote endereco, contato_local,
 * valor_cache, publico_esperado, descricao, observacoes and participantes
 * inside `metadata`, even though each already had its own column
 * (migration CrmFinanceOpsFormFieldColumns20260712000005 / EventEntity) —
 * the formal form data never reached the real columns.
 *
 * This test fails if the file goes back to building a `metadata` object
 * from formal event-form fields.
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
    expect(SOURCE).toMatch(/payload\["fee_amount"\]\s*=\s*feeAmount/);
    expect(SOURCE).toMatch(/payload\["publico_esperado"\]\s*=\s*expectedAudience/);
    expect(SOURCE).toMatch(/payload\["description"\]\s*=\s*data\.descricao/);
    expect(SOURCE).toMatch(/payload\["notes"\]\s*=\s*data\.observacoes/);
    expect(SOURCE).toMatch(/payload\["participantes"\]\s*=\s*data\.participantes/);
  });

  it("reads `participantes` primarily from the entity's real column, not only from legacy metadata", () => {
    expect(SOURCE).toMatch(/normalizeAgendaParticipants\(event\?\.participantes \?\? meta\["participants"\]\)/);
  });
});
