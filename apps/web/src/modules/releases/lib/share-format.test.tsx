import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ShareStatus } from "@music-os-360/types";
import {
  SHARE_DIRECTION_LABELS,
  SHARE_FORM_STATUS_OPTIONS,
  SHARE_FUNCTION_OPTIONS,
  isPendingShareStatus,
  shareFunctionLabel,
  shareStatusLabel,
} from "./share-format";
import { RELEASE_TYPE_LABELS, releaseLanguageLabel, releaseTypeLabel } from "./release-format";

/**
 * CZ-037/CZ-038: persisted share/release values are English; every value the
 * UI shows goes through a PT-BR label — never the raw technical value.
 */
describe("share-format — PT-BR labels for canonical share values", () => {
  it("labels every ShareStatus (no raw value, no fallback text)", () => {
    for (const status of Object.values(ShareStatus)) {
      const label = shareStatusLabel(status);
      expect(label).not.toBe(status);
      expect(label).not.toBe("Status não reconhecido");
    }
    expect(shareStatusLabel(ShareStatus.SENT)).toBe("Enviado");
    expect(shareStatusLabel(ShareStatus.RECEIVED)).toBe("Recebido");
  });

  it("never echoes an unknown status", () => {
    expect(shareStatusLabel("pendente")).toBe("Status não reconhecido");
  });

  it("labels every participant function and both directions", () => {
    expect(SHARE_FUNCTION_OPTIONS.map((o) => o.value)).toEqual([
      "composer", "performer", "producer", "publisher", "record_label", "manager", "other",
    ]);
    expect(shareFunctionLabel("record_label")).toBe("Gravadora");
    expect(shareFunctionLabel("performer")).toBe("Intérprete");
    expect(shareFunctionLabel("interprete")).toBe("Função não reconhecida");
    expect(SHARE_DIRECTION_LABELS).toEqual({ receivable: "A receber", payable: "A enviar" });
  });

  it("form status options are canonical values with PT-BR labels", () => {
    for (const option of SHARE_FORM_STATUS_OPTIONS) {
      expect(Object.values(ShareStatus)).toContain(option.value);
      expect(option.label).not.toBe(option.value);
    }
  });

  it("pending-like statuses drive the settlement KPIs", () => {
    expect(isPendingShareStatus(ShareStatus.PENDING)).toBe(true);
    expect(isPendingShareStatus(ShareStatus.PARTIAL)).toBe(true);
    expect(isPendingShareStatus(ShareStatus.RECEIVED)).toBe(false);
  });
});

describe("release-format — PT-BR labels for canonical release values", () => {
  it("labels every canonical release type", () => {
    expect(Object.keys(RELEASE_TYPE_LABELS)).toEqual(["single", "ep", "album", "compilation", "live", "video", "other"]);
    expect(releaseTypeLabel("compilation")).toBe("Coletânea");
    expect(releaseTypeLabel("mixtape")).toBe("Tipo não informado");
  });

  it("labels release language codes with correct accents", () => {
    expect(releaseLanguageLabel("es")).toBe("Espanhol");
    expect(releaseLanguageLabel("ja")).toBe("Japonês");
    expect(releaseLanguageLabel("pt")).toBe("Português");
    expect(releaseLanguageLabel(null)).toBeNull();
    expect(releaseLanguageLabel("pt-BR")).toBe("Português (Brasil)");
    expect(releaseLanguageLabel("xx")).toBe("Idioma não reconhecido");
  });
});

describe("Shares page — no Portuguese persisted values left in the page", () => {
  const page = readFileSync(resolve(__dirname, "../pages/Shares.tsx"), "utf8");
  it("offers every ShareStatus in the status filter/form (no empty select for a stored status)", () => {
    expect(SHARE_FORM_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual(Object.values(ShareStatus).sort());
  });

  it("uses the canonical function vocabulary and never raw type values", () => {
    for (const legacy of ['"interprete"', '"compositor"', '"gravadora"', '"empresario"', '"a_receber"', '"a_enviar"', '"pendente"']) {
      expect(page).not.toContain(legacy);
    }
    expect(page).toContain("shareFunctionLabel(share.type)");
  });
});
