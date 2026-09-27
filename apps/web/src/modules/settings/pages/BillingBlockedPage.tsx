import { CreditCard, LifeBuoy, Lock } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { MainLayout } from "@/shared/components/MainLayout";
import { useBilling } from "@/app/providers/BillingContext";

function formatAmount(amount?: number): string {
  if (typeof amount !== "number") return "Valor pendente indisponível";
  return (amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BillingBlockedPage() {
  const billing = useBilling();
  return (
    <MainLayout title="Workspace bloqueado" description="Regularize a assinatura para retomar o acesso completo">
      <div className="mx-auto max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              Pagamento da assinatura em atraso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
              O workspace está com pagamento em atraso. Enquanto a pendência existir, o acesso aos módulos operacionais permanece bloqueado ou em modo somente leitura.
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Valor pendente</p>
                <p className="font-semibold">{formatAmount(billing.amountDue)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Prazo de regularização</p>
                <p className="font-semibold">{billing.graceUntil ? new Date(billing.graceUntil).toLocaleDateString("pt-BR") : "Indisponivel"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild disabled={!billing.invoiceUrl}>
                <a href={billing.invoiceUrl ?? "/configuracoes/billing"} target={billing.invoiceUrl ? "_blank" : undefined} rel="noreferrer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pagar agora
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/support">
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Falar com suporte
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
