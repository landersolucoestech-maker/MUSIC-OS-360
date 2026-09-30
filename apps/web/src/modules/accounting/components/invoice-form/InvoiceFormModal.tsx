import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Loader2, FileText, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { InvoiceOperationType } from "@/modules/accounting/components/invoice-form/rules/invoice-form-rules";
import { useInvoiceForm } from "./hooks/useInvoiceForm";
import { InvoiceTypeSection } from "./sections/InvoiceTypeSection";
import { DetailsSection } from "./sections/DetailsSection";
import { InvoiceItemsSection } from "./sections/InvoiceItemsSection";
import { PaymentSection } from "./sections/PaymentSection";

interface InvoiceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: any;
  mode: "create" | "edit" | "view";
  defaultOperationType?: InvoiceOperationType;
}

export function InvoiceFormModal({
  open,
  onOpenChange,
  invoice,
  mode,
  defaultOperationType,
}: InvoiceFormModalProps) {
  const form = useInvoiceForm({
    open,
    mode,
    invoice,
    defaultOperationType,
    onClose: () => onOpenChange(false),
  });

  const { formData, operationType, rules, validationErrors, isViewMode, isSubmitting } = form;

  const title =
    mode === "create"
      ? rules.isInflow
        ? "Registrar Nota de Entrada"
        : "Emitir Nota Fiscal"
      : mode === "edit"
        ? rules.isInflow
          ? "Editar Nota de Entrada"
          : "Editar Nota Fiscal"
        : rules.isInflow
          ? "Visualizar Nota de Entrada"
          : "Visualizar Nota Fiscal";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[92vh] overflow-y-auto"
        data-testid="modal-invoice"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
            {formData.invoice_number && (
              <Badge variant="outline" className="ml-2">
                Nº {formData.invoice_number}/{formData.serie}
              </Badge>
            )}
            <Badge variant={rules.isInflow ? "secondary" : "default"} className="ml-1 gap-1">
              {rules.isInflow ? (
                <ArrowDownLeft className="h-3 w-3" />
              ) : (
                <ArrowUpRight className="h-3 w-3" />
              )}
              {rules.isInflow ? "Entrada" : "Saída"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit}>
          <div className="space-y-6 mt-2">
            <InvoiceTypeSection
              operationType={operationType}
              disabled={isViewMode}
              onChange={form.setOperationType}
            />

            <DetailsSection
              formData={formData}
              rules={rules}
              validationErrors={validationErrors}
              disabled={isViewMode}
              companySettings={form.companySettings}
              updateField={form.updateField}
              handleClientChange={form.handleClientChange}
            />

            <InvoiceItemsSection
              formData={formData}
              rules={rules}
              validationErrors={validationErrors}
              disabled={isViewMode}
              updateField={form.updateField}
              updateItem={form.updateItem}
              addItem={form.addItem}
              removeItem={form.removeItem}
              recalculateTaxes={form.recalculateTaxes}
            />

            <PaymentSection
              formData={formData}
              disabled={isViewMode}
              updateField={form.updateField}
            />
          </div>

          <DialogFooter className="pt-4 mt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-invoice"
            >
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-save-invoice"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create"
                  ? rules.isInflow
                    ? "Registrar Entrada"
                    : "Emitir Nota"
                  : "Salvar Alterações"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
