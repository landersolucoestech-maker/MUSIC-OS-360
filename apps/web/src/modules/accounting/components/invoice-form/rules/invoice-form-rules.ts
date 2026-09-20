import type { InvoiceOperationType } from "@/modules/accounting/types/invoice-type";
export type { InvoiceOperationType };

export interface InvoiceLineItem {
  description: string;
  quantidade: number;
  unit_price: number;
  total_amount: number;
  codigo_servico: string;
}

export interface InvoiceFormData {
  numero: string;
  serie: string;
  tipo_nota: string;
  client_id: string;
  natureza_operacao: string;
  codigo_servico_municipal: string;
  codigo_municipio: string;
  cfop: string;
  service_description: string;
  data_emissao: Date | undefined;
  vencimento: Date | undefined;
  status: string;
  tomador_cnpj: string;
  tomador_razao_social: string;
  tomador_inscricao_estadual: string;
  tomador_inscricao_municipal: string;
  tomador_email: string;
  tomador_endereco: string;
  tomador_cidade: string;
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
  forma_pagamento: string;
  condicao_pagamento: string;
  itens: InvoiceLineItem[];
  url_pdf: string;
  observacoes: string;
}

export const INITIAL_ITEM: InvoiceLineItem = {
  description: "",
  quantidade: 1,
  unit_price: 0,
  total_amount: 0,
  codigo_servico: "12.07",
};

export const INITIAL_FORM_DATA: InvoiceFormData = {
  numero: "",
  serie: "001",
  tipo_nota: "nfse",
  client_id: "",
  natureza_operacao: "Prestação de Serviços Artísticos",
  codigo_servico_municipal: "12.07",
  codigo_municipio: "3550308",
  cfop: "5933",
  service_description: "",
  data_emissao: new Date(),
  vencimento: undefined,
  status: "issued",
  tomador_cnpj: "",
  tomador_razao_social: "",
  tomador_inscricao_estadual: "ISENTO",
  tomador_inscricao_municipal: "",
  tomador_email: "",
  tomador_endereco: "",
  tomador_cidade: "",
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
  forma_pagamento: "transferencia",
  condicao_pagamento: "30 dias",
  itens: [{ ...INITIAL_ITEM }],
  url_pdf: "",
  observacoes: "",
};

export interface InvoiceFormRules {
  isEntrada: boolean;
  tomadorSectionLabel: string;
  prestadorCardLabel: string;
  clienteSelectLabel: string;
  valorLiquidoLabel: string;
  tributosSectionDesc: string;
}

export function computeInvoiceRules(operationType: InvoiceOperationType): InvoiceFormRules {
  const isEntrada = operationType === "entrada";
  return {
    isEntrada,
    tomadorSectionLabel: isEntrada ? "Fornecedor / Emitente" : "Tomador",
    prestadorCardLabel: isEntrada
      ? "Tomador (sua empresa, configurada em Empresa)"
      : "Prestador (configurado em Empresa)",
    clienteSelectLabel: isEntrada
      ? "Fornecedor Cadastrado (preenche automaticamente)"
      : "Cliente Cadastrado (preenche automaticamente)",
    valorLiquidoLabel: isEntrada ? "Valor Líquido a Pagar" : "Valor Líquido a Receber",
    tributosSectionDesc: isEntrada
      ? "Tributos retidos / pagos sobre o valor da nota."
      : "Tributos calculados automaticamente sobre o valor dos serviços.",
  };
}
