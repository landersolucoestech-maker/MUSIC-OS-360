import type { InvoiceFormData } from "./invoice-form-rules";

type SimpleReset = keyof InvoiceFormData;

interface ConditionalReset {
  field: keyof InvoiceFormData;
  value?: any;
  when?: (newValue: any) => boolean;
}

type ResetEntry = SimpleReset | ConditionalReset;

export const NF_RESET_MAP: Partial<Record<keyof InvoiceFormData, ResetEntry[]>> = {
  tipo_nota: [
    {
      field: "codigo_servico_municipal",
      value: "12.07",
      when: (v) => v === "nfe" || v === "nfce",
    },
    {
      field: "cfop",
      value: "5933",
      when: (v) => v === "nfe" || v === "nfce",
    },
  ],
  client_id: ["tomador_cnpj", "tomador_razao_social", "tomador_email", "tomador_endereco", "tomador_cidade"],
  iss_retido: [],
};

export function applyResets(
  field: keyof InvoiceFormData,
  newValue: any,
): Partial<InvoiceFormData> {
  const entries = NF_RESET_MAP[field];
  if (!entries || entries.length === 0) return {};

  const resets: Partial<InvoiceFormData> = {};
  for (const entry of entries) {
    if (typeof entry === "string") {
      (resets as any)[entry] = "";
    } else {
      const shouldReset = !entry.when || entry.when(newValue);
      if (shouldReset) {
        (resets as any)[entry.field] = entry.value ?? "";
      }
    }
  }
  return resets;
}
