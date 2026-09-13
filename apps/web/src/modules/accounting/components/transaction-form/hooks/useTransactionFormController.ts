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
import { useFinancialValidation } from "./useFinancialValidation";
import type { ValidationErrors } from "@/modules/accounting/components/transaction-form/validation/financial-form-validation";
import {
  applyResets,
  getHiddenFieldResets,
} from "@/modules/accounting/components/transaction-form/rules/financial-reset-rules";

interface Event {
  id: string;
  artist_id?: string | null;
  title: string;
  start_date?: string | null;
}

export interface UseTransactionFormControllerOptions {
  open: boolean;
  mode: "create" | "edit" | "view";
  transaction?: TransactionFormEntity;
  onClose: () => void;
  events: Event[];
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
  handleRemoveAnexo: () => void;
}

type AddTransactionInput = Parameters<ReturnType<typeof useTransactions>["addTransaction"]["mutateAsync"]>[0];
type UpdateTransactionInput = Parameters<ReturnType<typeof useTransactions>["updateTransaction"]["mutateAsync"]>[0];

function isLocalObjectUrl(url: string): boolean {
  return url.startsWith("blob:");
}

function hasFormChanges(values: Partial<TransactionFormData>): boolean {
  return Object.keys(values).length > 0;
}

function hasSelectedLinkValue(formData: TransactionFormData): boolean {
  switch (formData.tipoVinculacao) {
    case "artista":
      return Boolean(formData.artistaVinculado);
    case "projeto":
      return Boolean(formData.projetoVinculado);
    case "contrato":
      return Boolean(formData.contratoVinculado);
    case "evento":
      return Boolean(formData.eventoVinculado);
    case "centro-custo":
      return Boolean(formData.centroCusto);
    case "competencia":
      return Boolean(formData.competencia);
    case "conta-origem":
      return Boolean(formData.contaOrigem);
    case "conta-destino":
      return Boolean(formData.contaDestino);
    default:
      return true;
  }
}

export function useTransactionFormController({
  open,
  mode,
  transaction,
  onClose,
  events,
}: UseTransactionFormControllerOptions): UseTransactionFormControllerReturn {
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData);
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
      if (!isLocalObjectUrl(prev.anexoUrl)) return prev;
      return { ...prev, anexoUrl: "", anexoNome: "" };
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
      formData.tipoTransacao,
      formData.tipoCliente,
      formData.categoria,
      formData.subcategoria,
    );
    if (!finalRule) {
      toast.error("Selecione uma combinação financeira válida");
      return;
    }

    const links = getLinksFromRule(finalRule);
    if (links.length > 0 && !toRuleLink(formData.tipoVinculacao ?? "")) {
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

    const entityLinks = formData.entityLinks ?? [];

    setIsSubmitting(true);
    try {
      const payload: TransactionFormPayload = formToTransactionPayload(formData);
      const transactionId = transaction?.id;

      if (mode === "edit" && transactionId) {
        const expectedUpdatedAt = (transaction?.updated_at ?? transaction?.updatedAt) as string | undefined;
        const updatePayload = {
          id: transactionId,
          ...payload,
          entityLinks,
          ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
        } as UpdateTransactionInput;
        await updateTransaction.mutateAsync(updatePayload);
      } else {
        await addTransaction.mutateAsync({ ...payload, entityLinks } as AddTransactionInput);
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
      anexoUrl: objectUrl,
      anexoNome: file.name,
    }));
    clearFieldError("anexoUrl");
    toast.success("Arquivo anexado localmente. Upload real será processado futuramente.");
  }, [clearFieldError, isSubmitting, isViewMode, revokeObjectUrl]);

  const handleRemoveAnexo = useCallback(() => {
    if (isViewMode || isSubmitting) return;

    revokeObjectUrl();
    setFormData(prev => ({ ...prev, anexoUrl: "", anexoNome: "" }));
    clearFieldError("anexoUrl");
  }, [clearFieldError, isSubmitting, isViewMode, revokeObjectUrl]);

  return {
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
    handleRemoveAnexo,
  };
}

