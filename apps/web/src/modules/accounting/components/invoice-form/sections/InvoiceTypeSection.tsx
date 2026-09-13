import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { InvoiceOperationType } from "@/modules/accounting/components/invoice-form/rules/invoice-form-rules";

interface InvoiceTypeSectionProps {
  operationType: InvoiceOperationType;
  disabled: boolean;
  onChange: (t: InvoiceOperationType) => void;
}

export function InvoiceTypeSection({ operationType, disabled, onChange }: InvoiceTypeSectionProps) {
  return (
    <section className="space-y-3" data-testid="section-type-operacao">
      <h3 className="text-base font-semibold border-b pb-1">Tipo de Operação</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => !disabled && onChange("saida")}
          disabled={disabled}
          data-testid="button-type-saida"
          className={cn(
            "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors",
            operationType === "saida"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              operationType === "saida"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-sm">Saída</p>
            <p className="text-xs text-muted-foreground">Nota emitida para cliente / tomador</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => !disabled && onChange("entrada")}
          disabled={disabled}
          data-testid="button-type-entrada"
          className={cn(
            "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors",
            operationType === "entrada"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              operationType === "entrada"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-sm">Entrada</p>
            <p className="text-xs text-muted-foreground">Nota recebida de fornecedor / terceiro</p>
          </div>
        </button>
      </div>
    </section>
  );
}
