import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Loader2 } from "lucide-react";
import { useEvents } from "@/modules/events/hooks/useEvents";
import { useFinancialCategoryRulesStore } from "@/modules/accounting/hooks/useFinancialCategoryRulesStore";
import type { TransactionFormEntity } from "@/modules/accounting/mappers";
import { useTransactionFormController } from "./hooks/useTransactionFormController";
import { TransactionTypeSection } from "./sections/TransactionTypeSection";
import { PaymentSection } from "./sections/PaymentSection";
import { DetailsSection } from "./sections/DetailsSection";

interface TransactionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionFormEntity;
  mode: "create" | "edit" | "view";
}

export function TransactionFormModal({
  open,
  onOpenChange,
  transaction,
  mode,
}: TransactionFormModalProps) {
  const { events } = useEvents();
  const { rules: categoryRules } = useFinancialCategoryRulesStore();

  const form = useTransactionFormController({
    open,
    mode,
    transaction,
    onClose: () => onOpenChange(false),
    events,
  });
  const rules = form.visibleRules;
  const disabled = form.isViewMode || form.isSubmitting;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.handleClose();
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{form.title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit} className="space-y-5">
          <TransactionTypeSection
            formData={form.formData}
            rules={rules}
            categoryRules={categoryRules}
            errors={form.errors}
            disabled={disabled}
            updateField={form.updateField}
            filteredEvents={rules.filteredEvents}
          />

          <PaymentSection
            formData={form.formData}
            rules={rules}
            errors={form.errors}
            disabled={disabled}
            updateField={form.updateField}
          />

          <DetailsSection
            formData={form.formData}
            errors={form.errors}
            disabled={disabled}
            updateField={form.updateField}
            handleFileUpload={form.handleFileUpload}
            handleRemoveAnexo={form.handleRemoveAnexo}
          />

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={form.handleClose}
              disabled={form.isSubmitting}
            >
              {form.isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!form.isViewMode && (
              <Button
                type="submit"
                disabled={form.isSubmitting}
              >
                {form.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  mode === "create" ? "Salvar Transação" : "Salvar Alterações"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

