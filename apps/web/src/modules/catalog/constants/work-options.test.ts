import { describe, it, expect } from "vitest";
import { LANGUAGE_LABELS, toLanguageSlug } from "@/constants/languages";
import {
  WORK_AI_USAGE_LEVEL_LABELS,
  WORK_LANGUAGE_LABEL_BY_CODE,
  WORK_LANGUAGE_OPTIONS,
  WORK_ORIGIN_BADGE_LABELS,
  WORK_ORIGIN_LABELS,
  WORK_PARTICIPANT_ROLE_LABELS,
  WORK_PARTICIPANT_ROLE_OPTIONS,
  WORK_STATUS_OPTIONS,
  workLanguageCodeFromProjectLanguage,
  workLanguageLabel,
  workParticipantRoleLabel,
} from "./work-options";

/** ISO 639 codes of the CZ-039 works contract (`works.language`). */
const CONTRACT_LANGUAGE_CODES = [
  "de", "am", "ar", "bn", "zh", "ko", "da", "es", "fi", "fr", "el", "he", "hi", "nl",
  "id", "en", "yo", "it", "ja", "la", "ms", "no", "fa", "pl", "pt", "pa", "ru", "sw",
  "sv", "th", "ta", "te", "tr", "uk", "ur", "vi", "zu", "yue", "fil", "mul", "zxx", "und",
];

describe("work language vocabulary (ISO code ↔ PT-BR label)", () => {
  it("covers every PT-BR label of constants/languages exactly — labels unchanged", () => {
    expect(Object.values(WORK_LANGUAGE_LABEL_BY_CODE).sort()).toEqual([...LANGUAGE_LABELS].sort());
    expect(WORK_LANGUAGE_OPTIONS.map((o) => o.label)).toEqual(LANGUAGE_LABELS);
  });

  it("uses exactly the contract's ISO codes, one per label", () => {
    const codes = WORK_LANGUAGE_OPTIONS.map((o) => o.value);
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort()).toEqual([...CONTRACT_LANGUAGE_CODES].sort());
  });

  it("renders the PT-BR label of a code, never the raw code", () => {
    expect(workLanguageLabel("pt")).toBe("Português");
    expect(workLanguageLabel("en")).toBe("Inglês");
    expect(workLanguageLabel("zxx")).toBe("Instrumental (Sem Letra)");
    expect(workLanguageLabel("und")).toBe("Outro");
    expect(workLanguageLabel("xx-unknown")).toBeNull();
    expect(workLanguageLabel(null)).toBeNull();
    expect(workLanguageLabel("")).toBeNull();
  });

  it("maps a project language slug (constants/languages value) to the ISO code", () => {
    expect(workLanguageCodeFromProjectLanguage(toLanguageSlug("Português"))).toBe("pt");
    expect(workLanguageCodeFromProjectLanguage(toLanguageSlug("Chinês Mandarim"))).toBe("zh");
    expect(workLanguageCodeFromProjectLanguage(toLanguageSlug("Instrumental (Sem Letra)"))).toBe("zxx");
    for (const label of LANGUAGE_LABELS) {
      expect(workLanguageCodeFromProjectLanguage(toLanguageSlug(label))).toBe(
        WORK_LANGUAGE_OPTIONS.find((o) => o.label === label)?.value,
      );
    }
    expect(workLanguageCodeFromProjectLanguage("unknown-slug")).toBeNull();
    expect(workLanguageCodeFromProjectLanguage(undefined)).toBeNull();
  });
});

describe("work participant roles", () => {
  it("offers exactly the two canonical roles (composer/author and publisher) with PT-BR labels in the form select", () => {
    expect(WORK_PARTICIPANT_ROLE_OPTIONS).toEqual([
      { value: "composer_author", label: "Compositor/Autor" },
      { value: "publisher", label: "Editora" },
    ]);
    expect(WORK_PARTICIPANT_ROLE_LABELS.unspecified).toBe("Não informado");
  });

  it("keeps the label of a legacy role already stored on a work, though it is no longer offered", () => {
    expect(WORK_PARTICIPANT_ROLE_OPTIONS.map((o) => o.value)).not.toContain("administrator");
    expect(WORK_PARTICIPANT_ROLE_OPTIONS.map((o) => o.value)).not.toContain("translator");
    expect(workParticipantRoleLabel("administrator")).toBe("Administrador");
    expect(workParticipantRoleLabel("translator")).toBe("Tradutor");
  });

  it("labels every role in PT-BR and never shows a raw role value", () => {
    expect(workParticipantRoleLabel("composer_author")).toBe("Compositor/Autor");
    expect(workParticipantRoleLabel("translator")).toBe("Tradutor");
    expect(workParticipantRoleLabel("unspecified")).toBe("Não informado");
    expect(workParticipantRoleLabel("some_legacy_role")).toBe("Não informado");
    expect(workParticipantRoleLabel(undefined)).toBe("Não informado");
  });
});

describe("other work vocabularies", () => {
  it("labels work origin, AI usage level and status in PT-BR", () => {
    expect(WORK_ORIGIN_LABELS).toEqual({ original: "Autoral", reference: "Referência" });
    expect(WORK_ORIGIN_BADGE_LABELS).toEqual({ original: "Obra Autoral", reference: "Obra por Referência" });
    expect(WORK_AI_USAGE_LEVEL_LABELS).toEqual({ full: "Totalmente", partial: "Parcialmente" });
    expect(WORK_STATUS_OPTIONS.map((o) => o.value)).toEqual(["under_review", "pending", "registered", "rejected"]);
    expect(WORK_STATUS_OPTIONS.map((o) => o.label)).toEqual(["Em Análise", "Pendente", "Registrado", "Rejeitado"]);
  });
});

import { workParticipantRoleOptionsFor } from "./work-options";

describe("workParticipantRoleOptionsFor", () => {
  it("offers only composer/author and publisher to a participant without a legacy role", () => {
    for (const role of ["", "unspecified", "composer_author", "publisher", undefined]) {
      expect(workParticipantRoleOptionsFor(role).map((o) => o.value)).toEqual(["composer_author", "publisher"]);
    }
  });

  it("keeps a stored legacy role visible for that participant only", () => {
    expect(workParticipantRoleOptionsFor("translator").map((o) => o.value)).toEqual(["composer_author", "publisher", "translator"]);
    expect(workParticipantRoleOptionsFor("administrator").map((o) => o.label)).toContain("Administrador");
  });

  it("never offers a role outside the contract", () => {
    expect(workParticipantRoleOptionsFor("my-custom-role").map((o) => o.value)).toEqual(["composer_author", "publisher"]);
  });
});
