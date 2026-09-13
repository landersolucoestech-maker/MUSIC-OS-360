import { useMemo } from "react";
import {
  computeInvoiceRules,
  type InvoiceFormRules,
  type InvoiceOperationType,
} from "@/modules/accounting/components/invoice-form/rules/invoice-form-rules";

export function useInvoiceRules(operationType: InvoiceOperationType): InvoiceFormRules {
  return useMemo(() => computeInvoiceRules(operationType), [operationType]);
}
