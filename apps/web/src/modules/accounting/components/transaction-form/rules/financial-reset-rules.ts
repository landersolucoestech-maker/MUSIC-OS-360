import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import type { FinancialFormRules } from "./financial-form-rules";

type SimpleReset = keyof TransactionFormData;

interface ConditionalReset {
  field:  keyof TransactionFormData;
  value?: string;
  when?:  (newValue: string) => boolean;
}

type ResetEntry = SimpleReset | ConditionalReset;

export const RESET_MAP: Partial<Record<keyof TransactionFormData, ResetEntry[]>> = {
  transactionType: [
    {
      field: "counterpartyType",
      when: (v) => ["tax", "transfer", "investment"].includes(v),
    },
    "category",
    "subcategory",
    "investmentItem",
    "artistId",
    "projectId",
    "contractId",
    "eventId",
    "linkType",
    "travelReason",
    "advertisingName",
    "taxAuthority",
    "costCenter",
    "referenceMonth",
    "sourceBankAccount",
    "destinationBankAccount",
  ],
  counterpartyType: [
    "category",
    "subcategory",
    "artistId",
    "projectId",
    "contractId",
    "eventId",
    "linkType",
    "travelReason",
    "advertisingName",
    "costCenter",
    "referenceMonth",
    "sourceBankAccount",
    "destinationBankAccount",
  ],
  category: [
    "subcategory",
    "investmentItem",
    "artistId",
    "projectId",
    "contractId",
    "eventId",
    "linkType",
    "travelReason",
    "advertisingName",
    "taxAuthority",
    "costCenter",
    "referenceMonth",
    "sourceBankAccount",
    "destinationBankAccount",
  ],
  subcategory: [
    "artistId",
    "projectId",
    "contractId",
    "eventId",
    "counterpartyName",
    "taxAuthority",
    "linkType",
    "costCenter",
    "referenceMonth",
    "sourceBankAccount",
    "destinationBankAccount",
  ],
  linkType: [
    "artistId",
    "projectId",
    "contractId",
    "eventId",
    "counterpartyName",
    "taxAuthority",
    "costCenter",
    "referenceMonth",
    "sourceBankAccount",
    "destinationBankAccount",
  ],
  artistId: [
    "projectId",
    "eventId",
    "contractId",
  ],
  paymentType: [
    { field: "installmentCount",     when: (v) => v === "upfront" },
    { field: "installmentInterval",  value: "monthly", when: (v) => v === "upfront" },
    { field: "firstInstallmentDate", when: (v) => v === "upfront" },
  ],
};

export function applyResets(
  field:    keyof TransactionFormData,
  newValue: string,
): Partial<TransactionFormData> {
  const entries = RESET_MAP[field];
  if (!entries) return {};

  const resets: Partial<TransactionFormData> = {};
  const write = resets as Record<string, string>;
  for (const entry of entries) {
    if (typeof entry === "string") {
      write[entry] = "";
    } else {
      const shouldReset = !entry.when || entry.when(newValue);
      if (shouldReset) {
        write[entry.field] = entry.value ?? "";
      }
    }
  }
  return resets;
}

const HIDDEN_FIELD_RULES: Partial<Record<keyof FinancialFormRules, (keyof TransactionFormData)[]>> = {
  showInvestmentItem: ["investmentItem"],
  showArtist: ["artistId"],
  showProject: ["projectId"],
  showEvent: ["eventId"],
  showSupplier: ["counterpartyName"],
  showCollectingAgency: ["taxAuthority"],
  showTravelReason: ["travelReason"],
  showAdvertisingName: ["advertisingName"],
  showInstallments: ["installmentCount", "installmentInterval", "firstInstallmentDate"],
};

function getResetValue(field: keyof TransactionFormData): string {
  return field === "installmentInterval" ? "monthly" : "";
}

export function getHiddenFieldResets(
  formData: TransactionFormData,
  rules: FinancialFormRules,
): {
  values: Partial<TransactionFormData>;
  fields: (keyof TransactionFormData)[];
} {
  const values: Partial<TransactionFormData> = {};
  const fields: (keyof TransactionFormData)[] = [];

  for (const [ruleKey, relatedFields] of Object.entries(HIDDEN_FIELD_RULES) as [
    keyof FinancialFormRules,
    (keyof TransactionFormData)[],
  ][]) {
    if (rules[ruleKey] !== false) continue;

    for (const field of relatedFields) {
      if (field === "artistId" && formData.linkType === "artist") continue;
      if (field === "projectId" && formData.linkType === "project") continue;

      const resetValue = getResetValue(field);
      if (formData[field] !== resetValue) {
        (values as Record<string, string>)[field] = resetValue;
        fields.push(field);
      }
    }
  }

  return { values, fields };
}

export function clearFieldsFromErrors<T extends Partial<Record<keyof TransactionFormData, string>>>(
  errors: T,
  fields: (keyof TransactionFormData)[],
): T {
  if (fields.length === 0) return errors;

  const next = { ...errors };
  for (const field of fields) {
    delete next[field];
  }
  return next;
}

