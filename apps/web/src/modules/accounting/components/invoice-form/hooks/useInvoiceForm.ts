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
import { canonicalInvoicePaymentMethod } from "@/modules/accounting/constants/invoice-payment-methods";
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
/** `/clients` row used as the invoice recipient lookup (CZ-043 canonical keys). */
export interface InvoiceClientLookup {
  id: string;
  name: string;
  cpf_cnpj?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
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

  const [operationType, setOperationType] = useState<InvoiceOperationType>(defaultOperationType ?? "outflow");
  const [formData, setFormData] = useState<InvoiceFormData>({ ...INITIAL_FORM_DATA });
  const [validationErrors, setValidationErrors] = useState<InvoiceValidationErrors>({});

  const isViewMode = mode === "view";
  const isSubmitting = addInvoice.isPending || updateInvoice.isPending;
  const rules = useInvoiceRules(operationType);

  useEffect(() => {
    if (invoice && (mode === "edit" || mode === "view")) {
      const { type, cleanedNotes: cleanNotes } = parseOperationType(invoice.notes);
      const servicesAmount = numberValue(invoice.service_amount, invoice.legacy_amount, invoice.total_amount) ?? 0;
      const netAmount = numberValue(invoice.net_amount, invoice.service_amount, invoice.legacy_amount, invoice.total_amount) ?? 0;
      const servicesDescription = invoice.service_description ?? "";
      const recipientLegalName = invoice.tomador_legal_name ?? invoice.tomador_name ?? "";
      setOperationType(type);
      setFormData({
        ...INITIAL_FORM_DATA,
        ...invoice,
        notes: cleanNotes,
        payment_method: invoice.payment_method ? canonicalInvoicePaymentMethod(invoice.payment_method) : invoice.payment_method,
        tomador_legal_name: recipientLegalName,
        service_description: servicesDescription,
        service_amount: servicesAmount,
        net_amount: netAmount,
        issued_at: invoice.issued_at ? new Date(invoice.issued_at) : undefined,
        due_at: invoice.due_at
          ? new Date(invoice.due_at)
          : invoice.due_at
            ? new Date(invoice.due_at)
            : undefined,
        items: Array.isArray(invoice.items) && invoice.items.length > 0
          ? invoice.items
          : [{ ...INITIAL_ITEM, description: servicesDescription, unit_price: servicesAmount, total_amount: servicesAmount }],
      });
    } else if (!invoice && open) {
      setOperationType(defaultOperationType ?? "outflow");
      setFormData({ ...INITIAL_FORM_DATA, issued_at: new Date(), items: [{ ...INITIAL_ITEM }] });
    }
    setValidationErrors({});
  }, [invoice, mode, open, defaultOperationType]);

  useEffect(() => {
    if (mode !== "create" || !open || !companySettings) return;
    setFormData((prev) => {
      const isDefault = !prev.codigo_municipio || prev.codigo_municipio === "3550308";
      if (!isDefault) return prev;
      const city = (companySettings.city || "").toLowerCase();
      return { ...prev, codigo_municipio: city.includes("são paulo") ? "3550308" : prev.codigo_municipio };
    });
  }, [companySettings, mode, open]);

  useEffect(() => {
    if (isViewMode) return;
    const amount = Number(formData.service_amount) || 0;
    if (amount === 0) return;
    const deductions = Number(formData.deductions_amount) || 0;
    const calculationBase = +(amount - deductions).toFixed(2);
    const aliquotaIss = Number(formData.aliquota_iss) || 0;
    const issAmount = +(calculationBase * (aliquotaIss / 100)).toFixed(2);
    const pisAmount = +(amount * 0.0065).toFixed(2);
    const cofinsAmount = +(amount * 0.03).toFixed(2);
    const irAmount = +(amount * 0.015).toFixed(2);
    const csllAmount = +(amount * 0.01).toFixed(2);
    const inssAmount = Number(formData.inss_amount) || 0;
    const netAmount = +(amount - (formData.iss_retido ? issAmount : 0) - pisAmount - cofinsAmount - irAmount - csllAmount - inssAmount).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      base_calculo: calculationBase,
      iss_amount: issAmount,
      pis_amount: pisAmount,
      cofins_amount: cofinsAmount,
      ir_amount: irAmount,
      csll_amount: csllAmount,
      net_amount: netAmount,
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
      tomador_cnpj: client.cpf_cnpj || "",
      tomador_legal_name: client.name || "",
      tomador_email: client.email || "",
      tomador_address: client.address || "",
      tomador_city: client.city || "",
      tomador_uf: client.state || "SP",
      tomador_cep: client.zip_code || "",
    }) : ({ ...prev, client_id: clientId }));
  }, []);

  const updateItem = useCallback((index: number, field: keyof InvoiceLineItem, value: any) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        items[index].total_amount = +((items[index].quantity || 0) * (items[index].unit_price || 0)).toFixed(2);
      }
      return { ...prev, items, service_amount: items.reduce((sum, item) => sum + (item.total_amount || 0), 0) };
    });
  }, []);

  const addItem = useCallback(() => setFormData((prev) => ({ ...prev, items: [...prev.items, { ...INITIAL_ITEM }] })), []);
  const removeItem = useCallback((index: number) => setFormData((prev) => {
    if (prev.items.length === 1) return prev;
    const items = prev.items.filter((_, itemIndex) => itemIndex !== index);
    return { ...prev, items, service_amount: items.reduce((sum, item) => sum + (item.total_amount || 0), 0) };
  }), []);

  const recalculateTaxes = useCallback(() => {
    const amount = Number(formData.service_amount) || 0;
    const deductions = Number(formData.deductions_amount) || 0;
    const calculationBase = amount - deductions;
    const issAmount = +(calculationBase * ((Number(formData.aliquota_iss) || 0) / 100)).toFixed(2);
    const pisAmount = +(amount * 0.0065).toFixed(2);
    const cofinsAmount = +(amount * 0.03).toFixed(2);
    const irAmount = +(amount * 0.015).toFixed(2);
    const csllAmount = +(amount * 0.01).toFixed(2);
    const inssAmount = Number(formData.inss_amount) || 0;
    const netAmount = +(amount - (formData.iss_retido ? issAmount : 0) - pisAmount - cofinsAmount - irAmount - csllAmount - inssAmount).toFixed(2);
    setFormData((prev) => ({ ...prev, base_calculo: calculationBase, iss_amount: issAmount, pis_amount: pisAmount, cofins_amount: cofinsAmount, ir_amount: irAmount, csll_amount: csllAmount, net_amount: netAmount }));
    toast.success("Tributos recalculados");
  }, [formData]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "view") return;

    const schemaValidation = invoiceSchema.safeParse({
      ...formData,
      invoice_number: formData.invoice_number || "",
      serie: formData.serie || "",
      client_id: formData.client_id || "",
      issued_at: formData.issued_at,
      due_at: formData.due_at,
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

    const servicesAmount = Number(formData.service_amount) || 0;
    const data = {
      invoice_number: formData.invoice_number.trim(),
      serie: formData.serie?.trim() || null,
      tipo_nota: formData.tipo_nota,
      client_id: formData.client_id || null,
      sale_id: null,
      issued_at: formData.issued_at ? format(formData.issued_at, "yyyy-MM-dd") : null,
      due_at: formData.due_at ? format(formData.due_at, "yyyy-MM-dd") : null,
      status: formData.status,
      url_pdf: formData.url_pdf || null,
      notes: serializeOperationType(operationType, formData.notes?.trim() || "") || null,
      natureza_operacao: formData.natureza_operacao,
      codigo_servico_municipal: formData.codigo_servico_municipal,
      codigo_municipio: formData.codigo_municipio,
      cfop: formData.cfop,
      service_description: formData.service_description,
      tomador_cnpj: formData.tomador_cnpj,
      tomador_legal_name: formData.tomador_legal_name,
      tomador_inscricao_estadual: formData.tomador_inscricao_estadual,
      tomador_inscricao_municipal: formData.tomador_inscricao_municipal || null,
      tomador_email: formData.tomador_email,
      tomador_address: formData.tomador_address,
      tomador_city: formData.tomador_city,
      tomador_uf: formData.tomador_uf,
      tomador_cep: formData.tomador_cep,
      service_amount: servicesAmount,
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
      payment_method: formData.payment_method,
      payment_terms: formData.payment_terms,
      items: formData.items,
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
