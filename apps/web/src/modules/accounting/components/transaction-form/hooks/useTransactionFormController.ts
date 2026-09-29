import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { IntegrationError } from "@/shared/lib/errors";
import {
  initialFormData,
  type TransactionFormData,
} from "@/modules/accounting/constants/transaction-constants";
import {
  formToTransactionPayload,
  transactionToFormFields,
  type TransactionFormEntity,
  type TransactionFormPayload,
} from "@/modules/accounting/mappers";
import { useTransactions } from "@/modules/accounting/hooks/useTransactions";
import type { TransactionEntityLink } from "@/modules/accounting/types/accounting.types";
import { useFinancialCategoryRulesStore } from "@/modules/accounting/hooks/useFinancialCategoryRulesStore";
import { getFinalRule, getLinksFromRule, toRuleLink } from "@/modules/accounting/utils/financialRules.utils";
import { useFinancialRules, type FinancialRulesResult } from "./useFinancialRules";
import { useArtistEvents } from "@/modules/events/hooks/useArtistEvents";
import { useFinancialValidation } from "./useFinancialValidation";
import type { ValidationErrors } from "@/modules/accounting/components/transaction-form/validation/financial-form-validation";
import {
  applyResets,
  getHiddenFieldResets,
} from "@/modules/accounting/components/transaction-form/rules/financial-reset-rules";

export interface UseTransactionFormControllerOptions {
  open: boolean;
  mode: "create" | "edit" | "view";
  transaction?: TransactionFormEntity;
  onClose: () => void;
}

export interface UseTransactionFormControllerReturn {
  formData: TransactionFormData;
  visibleRules: FinancialRulesResult;
  errors: ValidationErrors;
  isSubmitting: boolean;
  isViewMode: boolean;
  title: string;
  updateField: (field: keyof TransactionFormData, value: string) => void;
  setEntityLinks: (links: TransactionEntityLink[]) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleClose: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveAttachment: () => void;
  /** State of the selected artist's events sweep (the event picker's source). */
  eventsStatus: { isLoading: boolean; error: Error | null; truncated: boolean; refetch: () => void };
}

// useDataQuery (shared/hooks) types its mutation input as the RESPONSE row
// (snake_case columns), while the API request body is the camelCase CZ-041
// contract (TransactionFormPayload). The two shapes are intentionally
// different, so the request body is bridged to the hook's input type here —
// the only place the form hands a body to the mutation. Tracked as a finding:
// useDataQuery needs a separate request-body type parameter.
type AddTransactionInput = Parameters<ReturnType<typeof useTransactions>["addTransaction"]["mutateAsync"]>[0];
type UpdateTransactionInput = Parameters<ReturnType<typeof useTransactions>["updateTransaction"]["mutateAsync"]>[0];

function isLocalObjectUrl(url: string): boolean {
  return url.startsWith("blob:");
}

function hasFormChanges(values: Partial<TransactionFormData>): boolean {
  return Object.keys(values).length > 0;
}

function hasSelectedLinkValue(formData: TransactionFormData): boolean {
  switch (formData.linkType) {
    case "artist":
      return Boolean(formData.artistId);
    case "project":
      return Boolean(formData.projectId);
    case "contract":
      return Boolean(formData.contractId);
    case "event":
      return Boolean(formData.eventId);
    case "cost_center":
      return Boolean(formData.costCenter);
    case "reference_month":
      return Boolean(formData.referenceMonth);
    case "source_bank_account":
      return Boolean(formData.sourceBankAccount);
    case "destination_bank_account":
      return Boolean(formData.destinationBankAccount);
    default:
      return true;
  }
}

export function useTransactionFormController({
  open,
  mode,
  transaction,
  onClose,
}: UseTransactionFormControllerOptions): UseTransactionFormControllerReturn {
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData);
  // The event picker lists the selected artist's events: sweep all of them (the
  // unfiltered events list is capped at the 50 oldest of the tenant).
  const {
    events,
    isLoading: eventsLoading,
    error: eventsError,
    truncated: eventsTruncated,
    refetch: refetchEvents,
  } = useArtistEvents(formData.artistId || undefined, open);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const { addTransaction, updateTransaction } = useTransactions();
  const { rules: categoryRules } = useFinancialCategoryRulesStore();
  const {
    errors,
    validate,
    clearFieldError,
    clearFieldErrors,
    clearAllErrors,
  } = useFinancialValidation();

  const visibleRules = useFinancialRules({
    formData,
    events,
  });

  const isViewMode = mode === "view";
  const title = useMemo(() => {
    if (mode === "create") return "Nova Transação Financeira";
    if (mode === "edit") return "Editar Transação";
    return "Visualizar Transação";
  }, [mode]);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const clearTemporaryAttachment = useCallback(() => {
    setFormData(prev => {
      if (!isLocalObjectUrl(prev.attachmentUrl)) return prev;
      return { ...prev, attachmentUrl: "", attachmentName: "" };
    });
    revokeObjectUrl();
  }, [revokeObjectUrl]);

  const handleClose = useCallback(() => {
    revokeObjectUrl();
    clearAllErrors();
    setIsSubmitting(false);
    setFormData(initialFormData);
    onClose();
  }, [clearAllErrors, onClose, revokeObjectUrl]);

  useEffect(() => {
    if (!open) {
      clearTemporaryAttachment();
      clearAllErrors();
      return;
    }

    revokeObjectUrl();
    setFormData(mode === "create" ? { ...initialFormData } : transactionToFormFields(transaction));
    setIsSubmitting(false);
    clearAllErrors();
  }, [clearAllErrors, clearTemporaryAttachment, mode, open, revokeObjectUrl, transaction]);

  useEffect(() => {
    if (!open) return;

    const cleanup = getHiddenFieldResets(formData, visibleRules);
    if (!hasFormChanges(cleanup.values)) return;

    setFormData(prev => ({ ...prev, ...cleanup.values }));
    clearFieldErrors(cleanup.fields);
  }, [clearFieldErrors, formData, open, visibleRules]);

  useEffect(() => {
    return () => {
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  const updateField = useCallback((
    field: keyof TransactionFormData,
    value: string,
  ) => {
    if (isViewMode || isSubmitting) return;

    const resets = applyResets(field, value);
    const resetFields = Object.keys(resets) as (keyof TransactionFormData)[];

    setFormData(prev => ({ ...prev, [field]: value, ...resets }));
    clearFieldErrors([field, ...resetFields]);
  }, [clearFieldErrors, isSubmitting, isViewMode]);

  const setEntityLinks = useCallback((links: TransactionEntityLink[]) => {
    if (isViewMode || isSubmitting) return;
    setFormData(prev => ({ ...prev, entityLinks: links }));
  }, [isSubmitting, isViewMode]);

  const handleSubmit = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isViewMode || isSubmitting) return;

    const finalRule = getFinalRule(
      categoryRules,
      formData.transactionType,
      formData.counterpartyType,
      formData.category,
      formData.subcategory,
    );
    if (!finalRule) {
      toast.error("Selecione uma combinação financeira válida");
      return;
    }

    const links = getLinksFromRule(finalRule);
    if (links.length > 0 && !toRuleLink(formData.linkType ?? "")) {
      toast.error("Selecione uma vinculação válida para esta categoria");
      return;
    }
    if (links.length > 0 && !hasSelectedLinkValue(formData)) {
      toast.error("Preencha o campo da vinculação selecionada");
      return;
    }

    const isValid = validate(formData, visibleRules);
    if (!isValid) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TransactionFormPayload = formToTransactionPayload(formData);
      const transactionId = transaction?.id;

      if (mode === "edit" && transactionId) {
        const expectedUpdatedAt = typeof transaction?.updated_at === "string" ? transaction.updated_at : undefined;
        const updatePayload = {
          id: transactionId,
          ...payload,
          ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
        };
        await updateTransaction.mutateAsync(updatePayload as unknown as UpdateTransactionInput);
      } else {
        await addTransaction.mutateAsync(payload as unknown as AddTransactionInput);
      }

      handleClose();
    } catch (err) {
      if (err instanceof IntegrationError && err.statusCode === 409) {
        toast.error("Esta transação foi alterada por outra pessoa. Feche e reabra o formulário para ver a versão mais recente.");
      } else {
        toast.error("Erro ao salvar transação. Tente novamente.");
      }
      setIsSubmitting(false);
    }
  }, [
    addTransaction,
    categoryRules,
    formData,
    handleClose,
    isSubmitting,
    isViewMode,
    mode,
    transaction?.id,
    transaction?.updated_at,
    updateTransaction,
    validate,
    visibleRules,
  ]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewMode || isSubmitting) return;

    const file = e.target.files?.[0];
    if (!file) return;

    revokeObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    setFormData(prev => ({
      ...prev,
      attachmentUrl: objectUrl,
      attachmentName: file.name,
    }));
    clearFieldError("attachmentUrl");
    toast.success("Arquivo anexado localmente. Upload real será processado futuramente.");
  }, [clearFieldError, isSubmitting, isViewMode, revokeObjectUrl]);

  const handleRemoveAttachment = useCallback(() => {
    if (isViewMode || isSubmitting) return;

    revokeObjectUrl();
    setFormData(prev => ({ ...prev, attachmentUrl: "", attachmentName: "" }));
    clearFieldError("attachmentUrl");
  }, [clearFieldError, isSubmitting, isViewMode, revokeObjectUrl]);

  return {
    eventsStatus: {
      isLoading: eventsLoading,
      error: eventsError,
      truncated: eventsTruncated,
      refetch: () => void refetchEvents(),
    },
    formData,
    visibleRules,
    errors,
    isSubmitting,
    isViewMode,
    title,
    updateField,
    setEntityLinks,
    handleSubmit,
    handleClose,
    handleFileUpload,
    handleRemoveAttachment,
  };
}

