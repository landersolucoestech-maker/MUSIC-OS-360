import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useInvoices } from "@/modules/accounting/hooks/useInvoices";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { useCompanySettings } from "@/modules/settings/hooks/useCompanySettings";
import { parseOperationType, serializeOperationType } from "@/modules/accounting/types/invoice-type";
import { invoiceSchema } from "@/modules/accounting/schemas/invoice-schema";
import { validateInvoiceForm, type InvoiceValidationErrors } from "@/modules/accounting/components/invoice-form/validation/invoice-form-validation";
import { applyResets } from "@/modules/accounting/components/invoice-form/rules/invoice-reset-rules";
import { useInvoiceRules } from "./useInvoiceRules";
import {
  type InvoiceFormData,
  type InvoiceFormRules,
  type InvoiceOperationType,
  type InvoiceLineItem,
  INITIAL_ITEM,
  INITIAL_FORM_DATA,
} from "@/modules/accounting/components/invoice-form/rules/invoice-form-rules";

interface UseInvoiceFormOptions {
  open: boolean;
  mode: "create" | "edit" | "view";
  invoice?: any;
  defaultOperationType?: InvoiceOperationType;
  onClose: () => void;
}

/** Formato bruto retornado por GET /clients (ClientsService.mapClient) —
 * suficiente para o autofill do tomador; não precisa do view-model `Cliente`. */
export interface InvoiceClientLookup {
  id: string;
  nome: string;
  document?: string | null;
  email?: string | null;
  endereco_completo?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export interface UseInvoiceFormReturn {
  formData: InvoiceFormData;
  operationType: InvoiceOperationType;
  rules: InvoiceFormRules;
  validationErrors: InvoiceValidationErrors;
  isViewMode: boolean;
  isSubmitting: boolean;
  setOperationType: (t: InvoiceOperationType) => void;
  updateField: <K extends keyof InvoiceFormData>(field: K, value: InvoiceFormData[K]) => void;
  handleClientChange: (clientId: string, client?: InvoiceClientLookup) => void;
  updateItem: (index: number, field: keyof InvoiceLineItem, value: any) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  recalculateTaxes: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  companySettings: any;
}

export function useInvoiceForm({
  open,
  mode,
  invoice,
  defaultOperationType,
  onClose,
}: UseInvoiceFormOptions): UseInvoiceFormReturn {
  const { addInvoice, updateInvoice } = useInvoices();
  const { companySettings } = useCompanySettings();

  const [operationType, setOperationType] = useState<InvoiceOperationType>(defaultOperationType ?? "saida");
  const [formData, setFormData] = useState<InvoiceFormData>({ ...INITIAL_FORM_DATA });
  const [validationErrors, setValidationErrors] = useState<InvoiceValidationErrors>({});

  const isViewMode = mode === "view";
  const isSubmitting = addInvoice.isPending || updateInvoice.isPending;
  const rules = useInvoiceRules(operationType);

  useEffect(() => {
    if (invoice && (mode === "edit" || mode === "view")) {
      const { type, observacoesLimpas } = parseOperationType(invoice.observacoes);
      const valorServicos = numberValue(invoice.valor_servicos, invoice.valor, invoice.valor_total) ?? 0;
      const valorLiquido = numberValue(invoice.valor_liquido, invoice.valor_servicos, invoice.valor, invoice.valor_total) ?? 0;
      const descricaoServicos = invoice.descricao_servicos ?? invoice.descricao_servico ?? "";
      const tomadorRazaoSocial = invoice.tomador_razao_social ?? invoice.tomador_nome ?? invoice.clientes?.nome ?? "";
      setOperationType(type);
      setFormData({
        ...INITIAL_FORM_DATA,
        ...invoice,
        observacoes: observacoesLimpas,
        tomador_razao_social: tomadorRazaoSocial,
        descricao_servicos: descricaoServicos,
        valor_servicos: valorServicos,
        valor_liquido: valorLiquido,
        data_emissao: invoice.data_emissao ? new Date(invoice.data_emissao) : undefined,
        vencimento: invoice.vencimento
          ? new Date(invoice.vencimento)
          : invoice.data_vencimento
            ? new Date(invoice.data_vencimento)
            : undefined,
        itens: Array.isArray(invoice.itens) && invoice.itens.length > 0
          ? invoice.itens
          : [{ ...INITIAL_ITEM, descricao: descricaoServicos, valor_unitario: valorServicos, valor_total: valorServicos }],
      });
    } else if (!invoice && open) {
      setOperationType(defaultOperationType ?? "saida");
      setFormData({ ...INITIAL_FORM_DATA, data_emissao: new Date(), itens: [{ ...INITIAL_ITEM }] });
    }
    setValidationErrors({});
  }, [invoice, mode, open, defaultOperationType]);

  useEffect(() => {
    if (mode !== "create" || !open || !companySettings) return;
    setFormData((prev) => {
      const isDefault = !prev.codigo_municipio || prev.codigo_municipio === "3550308";
      if (!isDefault) return prev;
      const cidade = (companySettings.cidade || "").toLowerCase();
      return { ...prev, codigo_municipio: cidade.includes("são paulo") ? "3550308" : prev.codigo_municipio };
    });
  }, [companySettings, mode, open]);

  useEffect(() => {
    if (isViewMode) return;
    const valor = Number(formData.valor_servicos) || 0;
    if (valor === 0) return;
    const deducoes = Number(formData.valor_deducoes) || 0;
    const baseCalculo = +(valor - deducoes).toFixed(2);
    const aliquotaIss = Number(formData.aliquota_iss) || 0;
    const valorIss = +(baseCalculo * (aliquotaIss / 100)).toFixed(2);
    const valorPis = +(valor * 0.0065).toFixed(2);
    const valorCofins = +(valor * 0.03).toFixed(2);
    const valorIr = +(valor * 0.015).toFixed(2);
    const valorCsll = +(valor * 0.01).toFixed(2);
    const valorInss = Number(formData.valor_inss) || 0;
    const valorLiquido = +(valor - (formData.iss_retido ? valorIss : 0) - valorPis - valorCofins - valorIr - valorCsll - valorInss).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      base_calculo: baseCalculo,
      valor_iss: valorIss,
      valor_pis: valorPis,
      valor_cofins: valorCofins,
      valor_ir: valorIr,
      valor_csll: valorCsll,
      valor_liquido: valorLiquido,
    }));
  }, [formData.valor_servicos, formData.valor_deducoes, formData.aliquota_iss, formData.iss_retido, formData.valor_inss, isViewMode]);

  const updateField = useCallback(<K extends keyof InvoiceFormData>(field: K, value: InvoiceFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value, ...applyResets(field, value) }));
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleClientChange = useCallback((clientId: string, client?: InvoiceClientLookup) => {
    setFormData((prev) => client ? ({
      ...prev,
      client_id: clientId,
      tomador_cnpj: client.document || "",
      tomador_razao_social: client.nome || "",
      tomador_email: client.email || "",
      tomador_endereco: client.endereco_completo || "",
      tomador_cidade: client.cidade || "",
      tomador_uf: client.estado || "SP",
      tomador_cep: client.cep || "",
    }) : ({ ...prev, client_id: clientId }));
  }, []);

  const updateItem = useCallback((index: number, field: keyof InvoiceLineItem, value: any) => {
    setFormData((prev) => {
      const itens = [...prev.itens];
      itens[index] = { ...itens[index], [field]: value };
      if (field === "quantidade" || field === "valor_unitario") {
        itens[index].valor_total = +((itens[index].quantidade || 0) * (itens[index].valor_unitario || 0)).toFixed(2);
      }
      return { ...prev, itens, valor_servicos: itens.reduce((sum, item) => sum + (item.valor_total || 0), 0) };
    });
  }, []);

  const addItem = useCallback(() => setFormData((prev) => ({ ...prev, itens: [...prev.itens, { ...INITIAL_ITEM }] })), []);
  const removeItem = useCallback((index: number) => setFormData((prev) => {
    if (prev.itens.length === 1) return prev;
    const itens = prev.itens.filter((_, itemIndex) => itemIndex !== index);
    return { ...prev, itens, valor_servicos: itens.reduce((sum, item) => sum + (item.valor_total || 0), 0) };
  }), []);

  const recalculateTaxes = useCallback(() => {
    const valor = Number(formData.valor_servicos) || 0;
    const deducoes = Number(formData.valor_deducoes) || 0;
    const baseCalculo = valor - deducoes;
    const valorIss = +(baseCalculo * ((Number(formData.aliquota_iss) || 0) / 100)).toFixed(2);
    const valorPis = +(valor * 0.0065).toFixed(2);
    const valorCofins = +(valor * 0.03).toFixed(2);
    const valorIr = +(valor * 0.015).toFixed(2);
    const valorCsll = +(valor * 0.01).toFixed(2);
    const valorInss = Number(formData.valor_inss) || 0;
    const valorLiquido = +(valor - (formData.iss_retido ? valorIss : 0) - valorPis - valorCofins - valorIr - valorCsll - valorInss).toFixed(2);
    setFormData((prev) => ({ ...prev, base_calculo: baseCalculo, valor_iss: valorIss, valor_pis: valorPis, valor_cofins: valorCofins, valor_ir: valorIr, valor_csll: valorCsll, valor_liquido: valorLiquido }));
    toast.success("Tributos recalculados");
  }, [formData]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "view") return;

    const schemaValidation = invoiceSchema.safeParse({
      ...formData,
      numero: formData.numero || "",
      serie: formData.serie || "",
      client_id: formData.client_id || "",
      data_emissao: formData.data_emissao,
      vencimento: formData.vencimento,
      valor_servicos: Number(formData.valor_servicos) || 0,
      valor_deducoes: Number(formData.valor_deducoes) || 0,
      base_calculo: Number(formData.base_calculo) || 0,
      aliquota_iss: Number(formData.aliquota_iss) || 0,
      valor_iss: Number(formData.valor_iss) || 0,
      valor_pis: Number(formData.valor_pis) || 0,
      valor_cofins: Number(formData.valor_cofins) || 0,
      valor_inss: Number(formData.valor_inss) || 0,
      valor_ir: Number(formData.valor_ir) || 0,
      valor_csll: Number(formData.valor_csll) || 0,
      valor_liquido: Number(formData.valor_liquido) || 0,
    });
    if (!schemaValidation.success) {
      toast.error(schemaValidation.error.errors[0]?.message || "Preencha os campos obrigatórios");
      return;
    }

    const errors = validateInvoiceForm(formData);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0] as string);
      return;
    }

    const valorServicos = Number(formData.valor_servicos) || 0;
    const data = {
      numero: formData.numero.trim(),
      serie: formData.serie?.trim() || null,
      tipo_nota: formData.tipo_nota,
      client_id: formData.client_id || null,
      venda_id: null,
      valor: valorServicos,
      data_emissao: formData.data_emissao ? format(formData.data_emissao, "yyyy-MM-dd") : null,
      vencimento: formData.vencimento ? format(formData.vencimento, "yyyy-MM-dd") : null,
      status: formData.status,
      url_pdf: formData.url_pdf || null,
      observacoes: serializeOperationType(operationType, formData.observacoes?.trim() || "") || null,
      natureza_operacao: formData.natureza_operacao,
      codigo_servico_municipal: formData.codigo_servico_municipal,
      codigo_municipio: formData.codigo_municipio,
      cfop: formData.cfop,
      descricao_servicos: formData.descricao_servicos,
      tomador_cnpj: formData.tomador_cnpj,
      tomador_razao_social: formData.tomador_razao_social,
      tomador_inscricao_estadual: formData.tomador_inscricao_estadual,
      tomador_inscricao_municipal: formData.tomador_inscricao_municipal || null,
      tomador_email: formData.tomador_email,
      tomador_endereco: formData.tomador_endereco,
      tomador_cidade: formData.tomador_cidade,
      tomador_uf: formData.tomador_uf,
      tomador_cep: formData.tomador_cep,
      valor_servicos: valorServicos,
      valor_deducoes: Number(formData.valor_deducoes) || 0,
      base_calculo: Number(formData.base_calculo) || 0,
      aliquota_iss: Number(formData.aliquota_iss) || 0,
      valor_iss: Number(formData.valor_iss) || 0,
      iss_retido: Boolean(formData.iss_retido),
      valor_pis: Number(formData.valor_pis) || 0,
      valor_cofins: Number(formData.valor_cofins) || 0,
      valor_inss: Number(formData.valor_inss) || 0,
      valor_ir: Number(formData.valor_ir) || 0,
      valor_csll: Number(formData.valor_csll) || 0,
      valor_liquido: numberValue(formData.valor_liquido, formData.valor_servicos) ?? 0,
      forma_pagamento: formData.forma_pagamento,
      condicao_pagamento: formData.condicao_pagamento,
      itens: formData.itens,
    };

    if (mode === "create") addInvoice.mutate(data, { onSuccess: onClose });
    else updateInvoice.mutate(
      { id: invoice.id, ...data, expectedUpdatedAt: getExpectedUpdatedAt(invoice) },
      {
        onSuccess: onClose,
        onError: (err) => { handleConcurrencyConflict(err, "nota fiscal"); },
      },
    );
  }, [formData, mode, operationType, invoice, onClose, addInvoice, updateInvoice]);

  return {
    formData,
    operationType,
    rules,
    validationErrors,
    isViewMode,
    isSubmitting,
    setOperationType,
    updateField,
    handleClientChange,
    updateItem,
    addItem,
    removeItem,
    recalculateTaxes,
    handleSubmit,
    companySettings,
  };
}
