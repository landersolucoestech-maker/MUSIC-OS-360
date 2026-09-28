import { describe, expect, it } from "vitest";
import { describeAuditAction, describeAuditRow } from "./audit-activity";

const UUID = "3f2b9c1e-8a7d-4e21-9b3c-5d6e7f8a9b0c";
const RAW = /[a-z]+_[a-z_]+|\bworkflow\b|\btransition\b|\bcreated\b|\bupdated\b|\bdeleted\b|Accounting/;

describe("dashboard audit feed — PT-BR labels with gender agreement", () => {
  it("agrees the participle with the entity's gender", () => {
    expect(describeAuditAction("work.created", "work")).toBe("Obra criada");
    expect(describeAuditAction("event.created", "event")).toBe("Agenda criada");
    expect(describeAuditAction("transaction.updated", "transaction")).toBe("Transação atualizada");
    expect(describeAuditAction("contract.updated", "contract")).toBe("Contrato atualizado");
    expect(describeAuditAction("artist.deleted", "artist")).toBe("Artista removido");
    expect(describeAuditAction("contract.cancelled", "contract")).toBe("Contrato cancelado");
  });

  it("accepts the legacy plural/PT-BR entity keys of older rows", () => {
    expect(describeAuditAction("create", "obras")).toBe("Obra criada");
    expect(describeAuditAction("update", "transacoes")).toBe("Transação atualizada");
  });

  it("falls back to generic PT-BR for unknown actions/entities (never the raw value)", () => {
    expect(describeAuditAction("registry.sync.run", "registry")).toBe("Registro atualizado");
    expect(describeAuditAction("mystery.created", "mystery")).toBe("Registro criado");
    expect(describeAuditAction("", "")).toBe("Registro atualizado");
    expect(describeAuditAction(undefined, undefined)).toBe("Registro atualizado");
  });

  it("renders workflow transitions as 'Status alterado' + PT-BR status, never the UUID", () => {
    const view = describeAuditRow({ action: "workflow.transition", entity: "contract", after: { status: "signed" } });
    expect(view.label).toBe("Status alterado");
    expect(view.description).toBe("Contrato: Assinado");
    expect(view.badge).toBe("Contrato");
    expect(JSON.stringify(view)).not.toContain(UUID);
  });

  it("uses 'Status não reconhecido' for a status outside the entity's enum", () => {
    const view = describeAuditRow({ action: "workflow.transition", entity: "contract", after: { status: "weird_state" } });
    expect(view.description).toBe("Contrato: Status não reconhecido");
  });

  it("never falls back to entity_id/UUID, raw action or raw entity", () => {
    const rows = [
      { action: "contract.updated", entity: "contract", after: {} },
      { action: "workflow.transition", entity: "ticket", after: { status: "open" } },
      { action: "billing.override_enabled", entity: "billing", after: null },
      { action: "entity.action", entity: "entity", after: { id: UUID } },
    ];
    for (const row of rows) {
      const view = describeAuditRow(row);
      const text = `${view.label} ${view.description} ${view.badge}`;
      expect(text).not.toContain(UUID);
      expect(text).not.toMatch(RAW);
    }
  });

  it("prefers the record's display name (title / stage_name / name, and historical nome_artistico)", () => {
    expect(describeAuditRow({ action: "work.created", entity: "work", after: { title: "Canção" } }).description).toBe("Canção");
    expect(describeAuditRow({ action: "artist.updated", entity: "artist", after: { nome_artistico: "Banda Antiga" } }).description).toBe("Banda Antiga");
    expect(describeAuditRow({ action: "transaction.created", entity: "transaction", after: {} }).badge).toBe("Contabilidade");
  });
});
