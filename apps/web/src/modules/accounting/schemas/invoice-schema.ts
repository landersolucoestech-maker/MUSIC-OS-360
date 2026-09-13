import { z } from "zod";

export const invoiceLineItemSchema = z.object({
  descricao: z.string().min(1, "Descrição do item é obrigatória").trim(),
  quantidade: z.number().min(1, "Quantidade mínima é 1"),
  valor_unitario: z.number().min(0, "Valor não pode ser negativo"),
  valor_total: z.number().min(0, "Valor não pode ser negativo"),
});

export const invoiceSchema = z.object({
  numero: z.string().optional().or(z.literal("")),
  serie: z.string().optional().or(z.literal("")),
  tipo_nota: z.enum(["nfse", "nfe", "nfce"]).default("nfse"),
  client_id: z.string().optional().or(z.literal("")),
  natureza_operacao: z.string().max(200, "Natureza da operação deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  codigo_servico_municipal: z.string().optional().or(z.literal("")),
  codigo_municipio: z.string().optional().or(z.literal("")),
  cfop: z.string().optional().or(z.literal("")),
  descricao_servicos: z.string().max(2000, "Descrição deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
  data_emissao: z.date().optional().nullable(),
  vencimento: z.date().optional().nullable(),
  status: z.string().optional().or(z.literal("")),
  tomador_cnpj: z.string().max(20, "CNPJ inválido").optional().or(z.literal("")),
  tomador_razao_social: z.string().max(200, "Razão social deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  tomador_inscricao_estadual: z.string().max(30, "IE deve ter no máximo 30 caracteres").optional().or(z.literal("")),
  tomador_inscricao_municipal: z.string().max(30, "IM deve ter no máximo 30 caracteres").optional().or(z.literal("")),
  tomador_email: z.string().email("Email inválido").max(100, "Email deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  tomador_endereco: z.string().max(300, "Endereço deve ter no máximo 300 caracteres").optional().or(z.literal("")),
  tomador_cidade: z.string().max(100, "Cidade deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  tomador_uf: z.string().max(2, "UF deve ter 2 caracteres").optional().or(z.literal("")),
  tomador_cep: z.string().max(10, "CEP inválido").optional().or(z.literal("")),
  valor_servicos: z.number().min(0, "Valor não pode ser negativo").optional(),
  valor_deducoes: z.number().min(0, "Valor não pode ser negativo").optional(),
  base_calculo: z.number().min(0, "Valor não pode ser negativo").optional(),
  aliquota_iss: z.number().min(0).max(100).optional(),
  valor_iss: z.number().min(0, "Valor não pode ser negativo").optional(),
  iss_retido: z.boolean().default(false),
  valor_pis: z.number().min(0).optional(),
  valor_cofins: z.number().min(0).optional(),
  valor_inss: z.number().min(0).optional(),
  valor_ir: z.number().min(0).optional(),
  valor_csll: z.number().min(0).optional(),
  valor_liquido: z.number().min(0).optional(),
  forma_pagamento: z.string().optional().or(z.literal("")),
  condicao_pagamento: z.string().optional().or(z.literal("")),
  itens: z.array(invoiceLineItemSchema).optional(),
  url_pdf: z.string().max(500, "URL deve ter no máximo 500 caracteres").optional().or(z.literal("")),
  observacoes: z.string().max(2000, "Observações deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type InvoiceLineItemFormData = z.infer<typeof invoiceLineItemSchema>;
