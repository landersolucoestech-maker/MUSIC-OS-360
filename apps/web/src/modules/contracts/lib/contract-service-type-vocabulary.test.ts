import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_FINANCIAL_MODELS,
  CLIENT_TYPES,
  CLIENT_TYPE_LABELS_PT_BR,
  FINANCIAL_MODEL_LABELS_PT_BR,
  LEGACY_CLIENT_TYPES,
  LEGACY_FINANCIAL_MODELS,
  LEGACY_PAYMENT_FREQUENCIES,
  PAYMENT_FREQUENCIES,
  PAYMENT_FREQUENCY_LABELS_PT_BR,
  UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL,
  normalizeClientTypes,
  normalizeFinancialModel,
  normalizePaymentFrequency,
} from "./contract-service-type-vocabulary";

describe("contract service type vocabulary (web mirror of the API contract)", () => {
  it("canonical ids match the API vocabulary and the label maps cover every id", () => {
    const api = readFileSync(
      resolve(__dirname, "../../../../../api/src/modules/contract-service-types/contract-service-type.vocabulary.ts"),
      "utf8",
    );
    for (const id of [...CLIENT_TYPES, ...CANONICAL_FINANCIAL_MODELS, ...PAYMENT_FREQUENCIES]) {
      expect(api).toContain(`'${id}'`);
    }
    expect(Object.keys(CLIENT_TYPE_LABELS_PT_BR).sort()).toEqual([...CLIENT_TYPES].sort());
    expect(Object.keys(PAYMENT_FREQUENCY_LABELS_PT_BR).sort()).toEqual([...PAYMENT_FREQUENCIES].sort());
    expect(Object.keys(FINANCIAL_MODEL_LABELS_PT_BR).sort()).toEqual(
      [...CANONICAL_FINANCIAL_MODELS, UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL].sort(),
    );
  });

  it("every legacy id maps onto a canonical id, and no legacy id is itself canonical", () => {
    expect(Object.values(LEGACY_CLIENT_TYPES).every((v) => (CLIENT_TYPES as readonly string[]).includes(v))).toBe(true);
    expect(Object.values(LEGACY_FINANCIAL_MODELS).every((v) => (CANONICAL_FINANCIAL_MODELS as readonly string[]).includes(v))).toBe(true);
    expect(Object.values(LEGACY_PAYMENT_FREQUENCIES).every((v) => (PAYMENT_FREQUENCIES as readonly string[]).includes(v))).toBe(true);
    expect(Object.keys(LEGACY_CLIENT_TYPES).some((k) => (CLIENT_TYPES as readonly string[]).includes(k))).toBe(false);
  });

  it("reads legacy rows as canonical and leaves canonical values alone", () => {
    expect(normalizeClientTypes(["artista", "pessoa_fisica", "pessoa_juridica"])).toEqual(["artist", "individual", "company"]);
    expect(normalizeClientTypes(["artist", "company"])).toEqual(["artist", "company"]);
    expect(normalizeClientTypes(["artista", "artist"])).toEqual(["artist"]);
    expect(normalizeClientTypes("artist")).toEqual([]);
    expect(normalizeFinancialModel("valor_fixo")).toBe("fixed_value");
    expect(normalizeFinancialModel("misto")).toBe("mixed");
    expect(normalizeFinancialModel("recorrente")).toBe("recurring");
    expect(normalizeFinancialModel("fixed_value")).toBe("fixed_value");
    expect(normalizePaymentFrequency("unico")).toBe("one_time");
    expect(normalizePaymentFrequency("trimestral")).toBe("quarterly");
    expect(normalizePaymentFrequency("yearly")).toBe("yearly");
    expect(normalizeFinancialModel(null)).toBe("fixed_value");
    expect(normalizePaymentFrequency(undefined)).toBe("one_time");
  });

  it("keeps the external-rights value and unknown values UNMAPPED (pending owner decision)", () => {
    expect(normalizeFinancialModel(UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL)).toBe(UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL);
    expect(normalizeFinancialModel("royalties")).toBe("royalties");
    expect(normalizePaymentFrequency("semestral")).toBe("semestral");
    expect(Object.keys(LEGACY_FINANCIAL_MODELS)).not.toContain(UNMAPPED_EXTERNAL_RIGHTS_FINANCIAL_MODEL);
  });

  it("the form no longer uses the persisted phrase as a DOM id (value untouched)", () => {
    const modal = readFileSync(resolve(__dirname, "../components/ContractFormModal.tsx"), "utf8");
    expect(modal).not.toMatch(/id="[^"]*\s[^"]*"/);
    expect(modal).toContain('value="recebimentos externos de direitos"');
  });
});
