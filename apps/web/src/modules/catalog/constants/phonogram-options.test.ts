import { describe, it, expect } from "vitest";
import {
  PHONOGRAM_AGGREGATOR_OPTIONS,
  PHONOGRAM_COUNTRY_OPTIONS,
  PHONOGRAM_MEDIA_TYPES,
  PHONOGRAM_MEDIA_TYPE_OPTIONS,
  PHONOGRAM_PARTICIPATION_CATEGORIES,
  PHONOGRAM_PARTICIPATION_CATEGORY_LABELS,
  PHONOGRAM_PARTICIPATION_CATEGORY_MAX_PERCENTAGE,
  PHONOGRAM_RECORDING_CLASSIFICATIONS,
  PHONOGRAM_RECORDING_CLASSIFICATION_OPTIONS,
  PHONOGRAM_STATUS_OPTIONS,
  phonogramAggregatorLabel,
  phonogramCountryLabel,
  phonogramMediaTypeLabel,
  phonogramRecordingClassificationLabel,
  phonogramStatusLabel,
} from "./phonogram-options";

describe("phonogram-options — canonical values (API contract, CZ-040)", () => {
  it("media types and recording classifications equal the API vocabulary", () => {
    // apps/api/src/modules/phonograms/phonogram-legacy-fields.ts
    expect([...PHONOGRAM_MEDIA_TYPES]).toEqual(["all", "digital", "physical", "streaming"]);
    expect([...PHONOGRAM_RECORDING_CLASSIFICATIONS]).toEqual(["studio", "live", "remix", "demo", "other"]);
    expect(PHONOGRAM_MEDIA_TYPE_OPTIONS.map((o) => o.value)).toEqual([...PHONOGRAM_MEDIA_TYPES]);
    expect(PHONOGRAM_RECORDING_CLASSIFICATION_OPTIONS.map((o) => o.value)).toEqual([...PHONOGRAM_RECORDING_CLASSIFICATIONS]);
  });

  it("offers ISO 3166-1 alpha-2 country codes only (ZZ = other)", () => {
    expect(PHONOGRAM_COUNTRY_OPTIONS.map((o) => o.value)).toEqual(["BR", "US", "GB", "PT", "AR", "ZZ"]);
    for (const { value } of PHONOGRAM_COUNTRY_OPTIONS) expect(value).toMatch(/^[A-Z]{2}$/);
  });

  it("no option value is a pre-CZ-040 Portuguese value", () => {
    const values = [
      ...PHONOGRAM_MEDIA_TYPE_OPTIONS, ...PHONOGRAM_RECORDING_CLASSIFICATION_OPTIONS,
      ...PHONOGRAM_AGGREGATOR_OPTIONS, ...PHONOGRAM_COUNTRY_OPTIONS, ...PHONOGRAM_STATUS_OPTIONS,
    ].map((o) => o.value);
    for (const legacy of ["todos", "físico", "fisico", "outro", "brazil", "usa", "uk", "portugal", "argentina", "em_análise", "pendente", "registrado", "rejeitado"]) {
      expect(values).not.toContain(legacy);
    }
    expect(PHONOGRAM_AGGREGATOR_OPTIONS.map((o) => o.value)).toContain("other");
  });

  it("participation categories use the canonical keys and ECAD shares", () => {
    expect([...PHONOGRAM_PARTICIPATION_CATEGORIES]).toEqual(["phonographic_producers", "performers", "session_musicians"]);
    expect(PHONOGRAM_PARTICIPATION_CATEGORY_LABELS).toEqual({
      phonographic_producers: "Produtor Fonográfico",
      performers: "Intérprete",
      session_musicians: "Músico Acompanhante",
    });
    const total = PHONOGRAM_PARTICIPATION_CATEGORIES.reduce((sum, c) => sum + PHONOGRAM_PARTICIPATION_CATEGORY_MAX_PERCENTAGE[c], 0);
    expect(total).toBeCloseTo(100);
  });
});

describe("phonogram-options — PT-BR labels (never the raw code)", () => {
  it("country ISO code → PT-BR label; ZZ → Outro", () => {
    expect(phonogramCountryLabel("BR")).toBe("Brasil");
    expect(phonogramCountryLabel("US")).toBe("Estados Unidos");
    expect(phonogramCountryLabel("GB")).toBe("Reino Unido");
    expect(phonogramCountryLabel("PT")).toBe("Portugal");
    expect(phonogramCountryLabel("AR")).toBe("Argentina");
    expect(phonogramCountryLabel("ZZ")).toBe("Outro");
  });

  it("unknown/legacy/empty values have no label (the UI shows —)", () => {
    for (const value of ["FR", "brazil", "br", "", null, undefined, 42]) {
      expect(phonogramCountryLabel(value)).toBeNull();
    }
    expect(phonogramMediaTypeLabel("todos")).toBeNull();
    expect(phonogramRecordingClassificationLabel("outro")).toBeNull();
    expect(phonogramAggregatorLabel("outro")).toBeNull();
    expect(phonogramAggregatorLabel("toString")).toBeNull();
  });

  it("media type, classification and aggregator labels are PT-BR", () => {
    expect(phonogramMediaTypeLabel("all")).toBe("Todas");
    expect(phonogramMediaTypeLabel("physical")).toBe("Física");
    expect(phonogramRecordingClassificationLabel("studio")).toBe("Estúdio");
    expect(phonogramRecordingClassificationLabel("live")).toBe("Ao vivo");
    expect(phonogramRecordingClassificationLabel("other")).toBe("Outra");
    expect(phonogramAggregatorLabel("cd_baby")).toBe("CD Baby");
    expect(phonogramAggregatorLabel("other")).toBe("Outra");
  });

  it("status labels are PT-BR; unknown status never shows the raw value", () => {
    expect(PHONOGRAM_STATUS_OPTIONS).toEqual([
      { value: "under_review", label: "Em análise" },
      { value: "pending", label: "Pendente" },
      { value: "registered", label: "Registrado" },
      { value: "rejected", label: "Rejeitado" },
    ]);
    expect(phonogramStatusLabel("active")).toBe("Ativo");
    expect(phonogramStatusLabel("analise")).toBe("Status desconhecido");
    expect(phonogramStatusLabel(null)).toBe("—");
  });
});
