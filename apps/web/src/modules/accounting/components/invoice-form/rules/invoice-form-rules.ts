import type { InvoiceOperationType } from "@/modules/accounting/types/invoice-type";
export type { InvoiceOperationType };

export interface InvoiceLineItem {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
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
  descricao_servicos: string;
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
  valor_servicos: number;
  valor_deducoes: number;
  base_calculo: number;
  aliquota_iss: number;
  valor_iss: number;
  iss_retido: boolean;
  valor_pis: number;
  valor_cofins: number;
  valor_inss: number;
  valor_ir: number;
  valor_csll: number;
  valor_liquido: number;
  forma_pagamento: string;
  condicao_pagamento: string;
  itens: InvoiceLineItem[];
  url_pdf: string;
  observacoes: string;
}

export const INITIAL_ITEM: InvoiceLineItem = {
  descricao: "",
  quantidade: 1,
  valor_unitario: 0,
  valor_total: 0,
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
  descricao_servicos: "",
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
  valor_servicos: 0,
  valor_deducoes: 0,
  base_calculo: 0,
  aliquota_iss: 5,
  valor_iss: 0,
  iss_retido: false,
  valor_pis: 0,
  valor_cofins: 0,
  valor_inss: 0,
  valor_ir: 0,
  valor_csll: 0,
  valor_liquido: 0,
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
