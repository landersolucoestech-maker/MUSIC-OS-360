import type { InvoiceOperationType } from "@/modules/accounting/types/invoice-type";
import { INVOICE_PAYMENT_METHOD_BANK_TRANSFER } from "@/modules/accounting/constants/invoice-payment-methods";
export type { InvoiceOperationType };

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  service_code: string;
}

export interface InvoiceFormData {
  invoice_number: string;
  serie: string;
  tipo_nota: string;
  client_id: string;
  natureza_operacao: string;
  codigo_servico_municipal: string;
  codigo_municipio: string;
  cfop: string;
  service_description: string;
  issued_at: Date | undefined;
  due_at: Date | undefined;
  status: string;
  tomador_cnpj: string;
  tomador_legal_name: string;
  tomador_inscricao_estadual: string;
  tomador_inscricao_municipal: string;
  tomador_email: string;
  tomador_address: string;
  tomador_city: string;
  tomador_uf: string;
  tomador_cep: string;
  service_amount: number;
  deductions_amount: number;
  base_calculo: number;
  aliquota_iss: number;
  iss_amount: number;
  iss_retido: boolean;
  pis_amount: number;
  cofins_amount: number;
  inss_amount: number;
  ir_amount: number;
  csll_amount: number;
  net_amount: number;
  payment_method: string;
  payment_terms: string;
  items: InvoiceLineItem[];
  url_pdf: string;
  notes: string;
}

export const INITIAL_ITEM: InvoiceLineItem = {
  description: "",
  quantity: 1,
  unit_price: 0,
  total_amount: 0,
  service_code: "12.07",
};

export const INITIAL_FORM_DATA: InvoiceFormData = {
  invoice_number: "",
  serie: "001",
  tipo_nota: "nfse",
  client_id: "",
  natureza_operacao: "Prestação de Serviços Artísticos",
  codigo_servico_municipal: "12.07",
  codigo_municipio: "3550308",
  cfop: "5933",
  service_description: "",
  issued_at: new Date(),
  due_at: undefined,
  status: "issued",
  tomador_cnpj: "",
  tomador_legal_name: "",
  tomador_inscricao_estadual: "ISENTO",
  tomador_inscricao_municipal: "",
  tomador_email: "",
  tomador_address: "",
  tomador_city: "",
  tomador_uf: "SP",
  tomador_cep: "",
  service_amount: 0,
  deductions_amount: 0,
  base_calculo: 0,
  aliquota_iss: 5,
  iss_amount: 0,
  iss_retido: false,
  pis_amount: 0,
  cofins_amount: 0,
  inss_amount: 0,
  ir_amount: 0,
  csll_amount: 0,
  net_amount: 0,
  payment_method: INVOICE_PAYMENT_METHOD_BANK_TRANSFER,
  payment_terms: "30 dias",
  items: [{ ...INITIAL_ITEM }],
  url_pdf: "",
  notes: "",
};

export interface InvoiceFormRules {
  isInflow: boolean;
  tomadorSectionLabel: string;
  prestadorCardLabel: string;
  clientSelectLabel: string;
  netAmountLabel: string;
  taxesSectionDescription: string;
}

export function computeInvoiceRules(operationType: InvoiceOperationType): InvoiceFormRules {
  const isInflow = operationType === "inflow";
  return {
    isInflow: isInflow,
    tomadorSectionLabel: isInflow ? "Fornecedor / Emitente" : "Tomador",
    prestadorCardLabel: isInflow
      ? "Tomador (sua empresa, configurada em Empresa)"
      : "Prestador (configurado em Empresa)",
    clientSelectLabel: isInflow
      ? "Fornecedor Cadastrado (preenche automaticamente)"
      : "Cliente Cadastrado (preenche automaticamente)",
    netAmountLabel: isInflow ? "Valor Líquido a Pagar" : "Valor Líquido a Receber",
    taxesSectionDescription: isInflow
      ? "Tributos retidos / pagos sobre o valor da nota."
      : "Tributos calculados automaticamente sobre o valor dos serviços.",
  };
}
