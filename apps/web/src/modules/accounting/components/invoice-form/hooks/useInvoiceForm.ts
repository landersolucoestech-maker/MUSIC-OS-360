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

/** Raw shape returned by GET /clients (ClientsService.mapClient) —
 * enough for the service taker autofill; it does not need the `Cliente` view model. */
export interface InvoiceClientLookup {
  id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
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
      const { type, observacoesLimpas } = parseOperationType(invoice.notes);
      const valorServicos = numberValue(invoice.service_amount, invoice.legacy_amount, invoice.total_amount) ?? 0;
      const valorLiquido = numberValue(invoice.net_amount, invoice.service_amount, invoice.legacy_amount, invoice.total_amount) ?? 0;
      const descricaoServicos = invoice.service_description ?? "";
      const tomadorRazaoSocial = invoice.tomador_razao_social ?? invoice.tomador_nome ?? invoice.clientes?.nome ?? "";
      setOperationType(type);
      setFormData({
        ...INITIAL_FORM_DATA,
        ...invoice,
        observacoes: observacoesLimpas,
        tomador_razao_social: tomadorRazaoSocial,
        service_description: descricaoServicos,
        service_amount: valorServicos,
        net_amount: valorLiquido,
        data_emissao: invoice.data_emissao ? new Date(invoice.data_emissao) : undefined,
        vencimento: invoice.vencimento
          ? new Date(invoice.vencimento)
          : invoice.data_vencimento
            ? new Date(invoice.data_vencimento)
            : undefined,
        itens: Array.isArray(invoice.itens) && invoice.itens.length > 0
          ? invoice.itens
          : [{ ...INITIAL_ITEM, description: descricaoServicos, unit_price: valorServicos, total_amount: valorServicos }],
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
    const valor = Number(formData.service_amount) || 0;
    if (valor === 0) return;
    const deducoes = Number(formData.deductions_amount) || 0;
    const baseCalculo = +(valor - deducoes).toFixed(2);
    const aliquotaIss = Number(formData.aliquota_iss) || 0;
    const valorIss = +(baseCalculo * (aliquotaIss / 100)).toFixed(2);
    const valorPis = +(valor * 0.0065).toFixed(2);
    const valorCofins = +(valor * 0.03).toFixed(2);
    const valorIr = +(valor * 0.015).toFixed(2);
    const valorCsll = +(valor * 0.01).toFixed(2);
    const valorInss = Number(formData.inss_amount) || 0;
    const valorLiquido = +(valor - (formData.iss_retido ? valorIss : 0) - valorPis - valorCofins - valorIr - valorCsll - valorInss).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      base_calculo: baseCalculo,
      iss_amount: valorIss,
      pis_amount: valorPis,
      cofins_amount: valorCofins,
      ir_amount: valorIr,
      csll_amount: valorCsll,
      net_amount: valorLiquido,
    }));
  }, [formData.service_amount, formData.deductions_amount, formData.aliquota_iss, formData.iss_retido, formData.inss_amount, isViewMode]);

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
      tomador_razao_social: client.name || "",
      tomador_email: client.email || "",
      tomador_address: client.address || "",
      tomador_city: client.city || "",
      tomador_uf: client.state || "SP",
      tomador_cep: client.cep || "",
    }) : ({ ...prev, client_id: clientId }));
  }, []);

  const updateItem = useCallback((index: number, field: keyof InvoiceLineItem, value: any) => {
    setFormData((prev) => {
      const itens = [...prev.itens];
      itens[index] = { ...itens[index], [field]: value };
      if (field === "quantidade" || field === "unit_price") {
        itens[index].total_amount = +((itens[index].quantidade || 0) * (itens[index].unit_price || 0)).toFixed(2);
      }
      return { ...prev, itens, service_amount: itens.reduce((sum, item) => sum + (item.total_amount || 0), 0) };
    });
  }, []);

  const addItem = useCallback(() => setFormData((prev) => ({ ...prev, itens: [...prev.itens, { ...INITIAL_ITEM }] })), []);
  const removeItem = useCallback((index: number) => setFormData((prev) => {
    if (prev.itens.length === 1) return prev;
    const itens = prev.itens.filter((_, itemIndex) => itemIndex !== index);
    return { ...prev, itens, service_amount: itens.reduce((sum, item) => sum + (item.total_amount || 0), 0) };
  }), []);

  const recalculateTaxes = useCallback(() => {
    const valor = Number(formData.service_amount) || 0;
    const deducoes = Number(formData.deductions_amount) || 0;
    const baseCalculo = valor - deducoes;
    const valorIss = +(baseCalculo * ((Number(formData.aliquota_iss) || 0) / 100)).toFixed(2);
    const valorPis = +(valor * 0.0065).toFixed(2);
    const valorCofins = +(valor * 0.03).toFixed(2);
    const valorIr = +(valor * 0.015).toFixed(2);
    const valorCsll = +(valor * 0.01).toFixed(2);
    const valorInss = Number(formData.inss_amount) || 0;
    const valorLiquido = +(valor - (formData.iss_retido ? valorIss : 0) - valorPis - valorCofins - valorIr - valorCsll - valorInss).toFixed(2);
    setFormData((prev) => ({ ...prev, base_calculo: baseCalculo, iss_amount: valorIss, pis_amount: valorPis, cofins_amount: valorCofins, ir_amount: valorIr, csll_amount: valorCsll, net_amount: valorLiquido }));
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
      service_amount: Number(formData.service_amount) || 0,
      deductions_amount: Number(formData.deductions_amount) || 0,
      base_calculo: Number(formData.base_calculo) || 0,
      aliquota_iss: Number(formData.aliquota_iss) || 0,
      iss_amount: Number(formData.iss_amount) || 0,
      pis_amount: Number(formData.pis_amount) || 0,
      cofins_amount: Number(formData.cofins_amount) || 0,
      inss_amount: Number(formData.inss_amount) || 0,
      ir_amount: Number(formData.ir_amount) || 0,
      csll_amount: Number(formData.csll_amount) || 0,
      net_amount: Number(formData.net_amount) || 0,
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

    const valorServicos = Number(formData.service_amount) || 0;
    const data = {
      numero: formData.numero.trim(),
      serie: formData.serie?.trim() || null,
      tipo_nota: formData.tipo_nota,
      client_id: formData.client_id || null,
      venda_id: null,
      legacy_amount: valorServicos,
      data_emissao: formData.data_emissao ? format(formData.data_emissao, "yyyy-MM-dd") : null,
      vencimento: formData.vencimento ? format(formData.vencimento, "yyyy-MM-dd") : null,
      status: formData.status,
      url_pdf: formData.url_pdf || null,
      notes: serializeOperationType(operationType, formData.observacoes?.trim() || "") || null,
      natureza_operacao: formData.natureza_operacao,
      codigo_servico_municipal: formData.codigo_servico_municipal,
      codigo_municipio: formData.codigo_municipio,
      cfop: formData.cfop,
      service_description: formData.service_description,
      tomador_cnpj: formData.tomador_cnpj,
      tomador_razao_social: formData.tomador_razao_social,
      tomador_inscricao_estadual: formData.tomador_inscricao_estadual,
      tomador_inscricao_municipal: formData.tomador_inscricao_municipal || null,
      tomador_email: formData.tomador_email,
      tomador_address: formData.tomador_address,
      tomador_city: formData.tomador_city,
      tomador_uf: formData.tomador_uf,
      tomador_cep: formData.tomador_cep,
      service_amount: valorServicos,
      deductions_amount: Number(formData.deductions_amount) || 0,
      base_calculo: Number(formData.base_calculo) || 0,
      aliquota_iss: Number(formData.aliquota_iss) || 0,
      iss_amount: Number(formData.iss_amount) || 0,
      iss_retido: Boolean(formData.iss_retido),
      pis_amount: Number(formData.pis_amount) || 0,
      cofins_amount: Number(formData.cofins_amount) || 0,
      inss_amount: Number(formData.inss_amount) || 0,
      ir_amount: Number(formData.ir_amount) || 0,
      csll_amount: Number(formData.csll_amount) || 0,
      net_amount: numberValue(formData.net_amount, formData.service_amount) ?? 0,
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
