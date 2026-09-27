/**
 * scheduler-form-metadata-guard.test.ts
 *
 * Permanent guard (2026-07-18 audit — no-metadata rule, events):
 * SchedulerFormModal.tsx `buildPayload` wrote the address, venue contact,
 * fee, expected attendance, description, notes and participants
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
    expect(SOURCE).toMatch(/payload\["address"\]\s*=\s*data\.address/);
    expect(SOURCE).toMatch(/payload\["venue_contact"\]\s*=\s*data\.venueContact/);
    expect(SOURCE).toMatch(/payload\["fee_amount"\]\s*=\s*feeAmount/);
    expect(SOURCE).toMatch(/payload\["expected_attendance"\]\s*=\s*expectedAudience/);
    expect(SOURCE).toMatch(/payload\["description"\]\s*=\s*data\.description/);
    expect(SOURCE).toMatch(/payload\["notes"\]\s*=\s*data\.notes/);
    expect(SOURCE).toMatch(/payload\["participants"\]\s*=\s*data\.participants/);
  });

  it("reads `participants` primarily from the entity's real column, not only from legacy metadata", () => {
    expect(SOURCE).toMatch(/normalizeScheduleParticipants\(event\?\.participants \?\? meta\["participants"\]\)/);
  });
});
