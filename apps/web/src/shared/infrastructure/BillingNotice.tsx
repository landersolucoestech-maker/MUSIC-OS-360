import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Lock } from "lucide-react";
import { useBilling } from "@/app/providers/BillingContext";

function formatAmount(amount?: number): string | null {
  if (typeof amount !== "number") return null;
  return (amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BillingNotice() {
  const billing = useBilling();
  const location = useLocation();
  if (location.pathname.startsWith("/billing") || location.pathname.startsWith("/settings/billing")) return null;

  if (billing.isSuspended) return null;

  if (billing.isReadOnly) {
    return (
      <div className="sticky top-0 z-50 border-b border-amber-300/40 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <span className="flex items-center gap-2"><Lock className="h-4 w-4" />Workspace em modo somente leitura</span>
          <Link to="/billing/blocked" className="underline underline-offset-4">Regularizar</Link>
        </div>
      </div>
    );
  }

  if (billing.isPaymentGrace) {
    const amount = formatAmount(billing.amountDue);
    return (
      <div className="sticky top-0 z-50 border-b border-red-300/40 bg-red-600 px-4 py-2 text-sm font-medium text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pagamento pendente
            {typeof billing.daysRemaining === "number" && ` - ${billing.daysRemaining} dia(s) restantes`}
            {amount && ` - ${amount}`}
          </span>
          <Link to="/settings/billing" className="underline underline-offset-4">Regularizar</Link>
        </div>
      </div>
    );
  }

  return null;
}
