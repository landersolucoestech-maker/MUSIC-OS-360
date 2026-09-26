/**
 * event-type.test.ts
 *
 * Task S — guarda permanente: events.type só guarda o enum coarse do
 * backend (show/festival/recording/meeting/interview/tour/other). A
 * categoria granular configurada em Configurações → Operacional
 * (metadata.backend_type) precisa ser traduzida corretamente nos dois
 * sentidos usados pela Agenda: filtro (granular → coarse, para bater com o
 * dado real) e exibição (coarse real → rótulo pt-BR).
 */
import { describe, it, expect } from "vitest";
import {
  BACKEND_EVENT_TYPES,
  backendEventTypeLabels,
  buildGranularToBackendTypeMap,
  getBackendEventTypeLabel,
  normalizeToBackendType,
} from "./event-type";
import type { OperationalListItem } from "@/modules/settings/hooks/useOperationalSettings";

function item(slug: string, backendType: string): OperationalListItem {
  return {
    id: `id-${slug}`,
    kind: "event_type",
    name: slug,
    slug,
    description: "",
    active: true,
    order: 0,
    metadata: { backend_type: backendType },
  };
}

describe("buildGranularToBackendTypeMap", () => {
  it("reads metadata.backend_type from each operational item", () => {
    const map = buildGranularToBackendTypeMap([
      item("sessoes_estudio", "recording"),
      item("shows", "show"),
    ]);
    expect(map).toEqual({ sessoes_estudio: "recording", shows: "show" });
  });

  it("ignores items without a valid metadata.backend_type (injects no garbage into the filter)", () => {
    const semMetadata: OperationalListItem = { ...item("x", "recording"), metadata: undefined };
    const backendTypeInvalido: OperationalListItem = { ...item("y", "not-a-real-type") };
    const map = buildGranularToBackendTypeMap([semMetadata, backendTypeInvalido]);
    expect(map).toEqual({});
  });
});

describe("normalizeToBackendType", () => {
  const map = buildGranularToBackendTypeMap([
    item("sessoes_estudio", "recording"),
    item("reunioes", "meeting"),
  ]);

  it("maps a configured granular slug to the real coarse enum", () => {
    expect(normalizeToBackendType("sessoes_estudio", map)).toBe("recording");
    expect(normalizeToBackendType("reunioes", map)).toBe("meeting");
  });

  it("keeps a value that is already a valid coarse enum", () => {
    for (const t of BACKEND_EVENT_TYPES) {
      expect(normalizeToBackendType(t, map)).toBe(t);
    }
  });

  it("falls back to 'other' for an unknown/absent value (never breaks the filter)", () => {
    expect(normalizeToBackendType("categoria-inexistente", map)).toBe("other");
    expect(normalizeToBackendType(undefined, map)).toBe("other");
    expect(normalizeToBackendType(null, map)).toBe("other");
    expect(normalizeToBackendType("", map)).toBe("other");
  });

  it("is case-insensitive", () => {
    expect(normalizeToBackendType("SESSOES_ESTUDIO", map)).toBe("recording");
    expect(normalizeToBackendType("Show", map)).toBe("show");
  });
});

describe("getBackendEventTypeLabel", () => {
  it("resolves the pt-BR label of each real coarse value", () => {
    for (const t of BACKEND_EVENT_TYPES) {
      expect(getBackendEventTypeLabel(t)).toBe(backendEventTypeLabels[t]);
    }
  });

  it("never throws and always returns something displayable for an absent/unknown value", () => {
    expect(getBackendEventTypeLabel(undefined)).toBe("Evento");
    expect(getBackendEventTypeLabel(null)).toBe("Evento");
    expect(getBackendEventTypeLabel("valor-nunca-visto")).toBe("valor-nunca-visto");
  });
});
