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
  tipoTransacao: [
    {
      field: "tipoCliente",
      when: (v) => ["imposto", "transferencia", "investimento"].includes(v),
    },
    "categoria",
    "subcategoria",
    "itemInvestimento",
    "artistaVinculado",
    "projetoVinculado",
    "contratoVinculado",
    "eventoVinculado",
    "tipoVinculacao",
    "motivoViagem",
    "nomePublicidade",
    "orgaoArrecadador",
    "centroCusto",
    "competencia",
    "contaOrigem",
    "contaDestino",
  ],
  tipoCliente: [
    "categoria",
    "subcategoria",
    "artistaVinculado",
    "projetoVinculado",
    "contratoVinculado",
    "eventoVinculado",
    "tipoVinculacao",
    "motivoViagem",
    "nomePublicidade",
    "centroCusto",
    "competencia",
    "contaOrigem",
    "contaDestino",
  ],
  categoria: [
    "subcategoria",
    "itemInvestimento",
    "artistaVinculado",
    "projetoVinculado",
    "contratoVinculado",
    "eventoVinculado",
    "tipoVinculacao",
    "motivoViagem",
    "nomePublicidade",
    "orgaoArrecadador",
    "centroCusto",
    "competencia",
    "contaOrigem",
    "contaDestino",
  ],
  subcategoria: [
    "artistaVinculado",
    "projetoVinculado",
    "contratoVinculado",
    "eventoVinculado",
    "fornecedorCliente",
    "orgaoArrecadador",
    "tipoVinculacao",
    "centroCusto",
    "competencia",
    "contaOrigem",
    "contaDestino",
  ],
  tipoVinculacao: [
    "artistaVinculado",
    "projetoVinculado",
    "contratoVinculado",
    "eventoVinculado",
    "fornecedorCliente",
    "orgaoArrecadador",
    "centroCusto",
    "competencia",
    "contaOrigem",
    "contaDestino",
  ],
  artistaVinculado: [
    "projetoVinculado",
    "eventoVinculado",
    "contratoVinculado",
  ],
  tipoPagamento: [
    { field: "quantidadeParcelas",  when: (v) => v === "avista" },
    { field: "intervaloParcelas",   value: "mensal", when: (v) => v === "avista" },
    { field: "dataPrimeiraParcela", when: (v) => v === "avista" },
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
  exibirItemInvestimento: ["itemInvestimento"],
  exibirArtista: ["artistaVinculado"],
  exibirProjeto: ["projetoVinculado"],
  exibirEvento: ["eventoVinculado"],
  exibirFornecedor: ["fornecedorCliente"],
  exibirOrgaoArrecadador: ["orgaoArrecadador"],
  exibirMotivoViagem: ["motivoViagem"],
  exibirNomePublicidade: ["nomePublicidade"],
  exibirParcelamento: ["quantidadeParcelas", "intervaloParcelas", "dataPrimeiraParcela"],
};

function getResetValue(field: keyof TransactionFormData): string {
  return field === "intervaloParcelas" ? "mensal" : "";
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
      if (field === "artistaVinculado" && formData.tipoVinculacao === "artista") continue;
      if (field === "projetoVinculado" && formData.tipoVinculacao === "projeto") continue;
      if (field === "fornecedorCliente" && formData.tipoVinculacao === "empresa") continue;

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

