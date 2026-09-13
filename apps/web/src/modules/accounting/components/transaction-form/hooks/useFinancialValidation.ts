import { useState, useCallback } from "react";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import type { FinancialFormRules } from "@/modules/accounting/components/transaction-form/rules/financial-form-rules";
import {
  validateTransactionForm,
  type ValidationErrors,
} from "@/modules/accounting/components/transaction-form/validation/financial-form-validation";

export interface UseFinancialValidationReturn {
  errors:          ValidationErrors;
  setErrors:       React.Dispatch<React.SetStateAction<ValidationErrors>>;
  validate:        (formData: TransactionFormData, rules: FinancialFormRules) => boolean;
  clearFieldError: (field: keyof TransactionFormData) => void;
  clearFieldErrors: (fields: (keyof TransactionFormData)[]) => void;
  clearAllErrors:  () => void;
}

export function useFinancialValidation(): UseFinancialValidationReturn {
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validate = useCallback((
    formData: TransactionFormData,
    rules: FinancialFormRules,
  ): boolean => {
    const newErrors = validateTransactionForm(formData, rules);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, []);

  const clearFieldError = useCallback((field: keyof TransactionFormData) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearFieldErrors = useCallback((fields: (keyof TransactionFormData)[]) => {
    if (fields.length === 0) return;

    setErrors(prev => {
      let changed = false;
      const next = { ...prev };

      for (const field of fields) {
        if (next[field]) {
          delete next[field];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, []);

  const clearAllErrors = useCallback(() => setErrors({}), []);

  return { errors, setErrors, validate, clearFieldError, clearFieldErrors, clearAllErrors };
}
