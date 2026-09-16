/**
 * settings/pages/Billing.tsx
 *
 * Página de Billing — plano actual, upgrade e portal de gestão Stripe.
 * Subscreve ao WebSocket 'billing:plan_upgraded' para atualizar UI em tempo real.
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Zap, Shield, Star, ArrowRight, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { Button }   from "@/shared/ui/button";
import { Badge }    from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { PageHeader } from "@/shared/components/PageHeader";
import { toast } from "sonner";
import { stripeClient, type BillingSubscription } from "@/modules/integrations/clients/stripe.client";
import { useWsEvent } from "@/shared/hooks/useWsEvent";

// ── Planos ────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id:          "starter" as const,
    name:        "Starter",
    price:       "R$ 299",
    period:      "/mês",
    description: "Para labels e publishers independentes",
    icon:        <Star className="h-5 w-5" />,
    features: [
      "Artistas ilimitados",
      "Catálogo musical completo",
      "Contratos e CRM",
      "Suporte por e-mail",
    ],
    color: "border-blue-200",
  },
  {
    id:          "professional" as const,
    name:        "Professional",
    price:       "R$ 799",
    period:      "/mês",
    description: "Para distribuidoras e selos em crescimento",
    icon:        <Zap className="h-5 w-5" />,
    features: [
      "Tudo do Starter",
      "Marketing e campanhas",
      "Contabilidade e P&L",
      "Monitoramento ECAD",
      "RH, Eventos e Estoque",
      "Suporte prioritário",
    ],
    color:     "border-primary/30",
    highlight: true,
  },
  {
    id:          "enterprise" as const,
    name:        "Enterprise",
    price:       "Consultar",
    period:      "",
    description: "Para grandes grupos fonográficos",
    icon:        <Shield className="h-5 w-5" />,
    features: [
      "Tudo do Professional",
      "IA Criativa e análise avançada",
      "Multi-tenant admin",
      "Licenciamento musical",
      "Analytics avançado",
      "SLA dedicado",
    ],
    color: "border-gold-200",
  },
];

const PLAN_LABEL: Record<string, string> = {
  starter:      "Starter",
  professional: "Professional",
  enterprise:   "Enterprise",
  trial:        "Trial",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:    { label: "Ativo",      variant: "default" },
  trial:     { label: "Trial",      variant: "secondary" },
  past_due:  { label: "Em atraso",  variant: "destructive" },
  payment_grace: { label: "Prazo de regularizacao", variant: "destructive" },
  read_only: { label: "Somente leitura", variant: "outline" },
  suspended: { label: "Suspenso", variant: "destructive" },
  unpaid:    { label: "Em atraso", variant: "destructive" },
  cancelled: { label: "Cancelado",  variant: "destructive" },
  paused:    { label: "Pausado",    variant: "outline" },
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function Billing() {
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery<BillingSubscription | null>({
    queryKey: ["billing", "subscription"],
    queryFn:  stripeClient.getSubscription,
    retry:    false,
  });

  // WebSocket: atualiza plano em tempo real após upgrade
  useWsEvent("billing:plan_upgraded", () => {
    queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
    toast.success("Plano atualizado!", { description: "O seu plano foi atualizado com sucesso." });
  });

  useWsEvent("billing:cancelled", () => {
    queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
    toast.error("Assinatura cancelada", { description: "A sua assinatura foi cancelada." });
  });

  // Checkout
  const checkoutMutation = useMutation({
    mutationFn: (plan: "starter" | "professional" | "enterprise") => {
      const base = window.location.origin;
      return stripeClient.createCheckout(
        plan,
        `${base}/configuracoes/billing?success=1`,
        `${base}/configuracoes/billing?canceled=1`,
      );
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: () => toast.error("Erro ao iniciar checkout"),
  });

  // Portal
  const portalMutation = useMutation({
    mutationFn: () => stripeClient.openPortal(`${window.location.origin}/configuracoes/billing`),
    onSuccess:  (data) => { if (data?.url) window.open(data.url, "_blank"); },
    onError:    () => toast.error("Erro ao abrir portal"),
  });

  // Parâmetros de URL após redirect do Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      toast.success("Pagamento realizado!", { description: "O seu plano será activado em instantes." });
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("canceled") === "1") {
      toast.error("Checkout cancelado");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [queryClient]);

  const currentPlan   = subscription?.plan ?? "trial";
  const currentStatus = subscription?.billing_state?.status ?? subscription?.status ?? "trial";
  const statusInfo    = STATUS_BADGE[currentStatus] ?? STATUS_BADGE["trial"];

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Billing"
        description="Gerencie o seu plano e assinatura"
      />

      {/* Plano actual */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Plano actual</CardTitle>
              <CardDescription>Detalhes da sua assinatura</CardDescription>
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">A carregar...</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{PLAN_LABEL[currentPlan] ?? currentPlan}</p>
                {subscription?.current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    Renovação em{" "}
                    {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                  </p>
                )}
                {subscription?.trial_ends_at && currentStatus === "trial" && (
                  <p className="text-sm text-muted-foreground">
                    Trial até{" "}
                    {new Date(subscription.trial_ends_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              {subscription?.stripe_customer_id && !subscription.stripe_customer_id.startsWith("pending_") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                >
                  {portalMutation.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-3 w-3" />
                  )}
                  Gerir assinatura
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planos disponíveis */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-4  tracking-wide">
          Planos disponíveis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const isPending     = checkoutMutation.isPending && checkoutMutation.variables === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative border-2 transition-colors ${plan.color} ${
                  isCurrentPlan ? "bg-accent/20" : ""
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="text-xs px-2">Mais popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-primary">{plan.icon}</div>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>
                  <div className="flex items-baseline gap-1 pt-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-xs text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <ul className="space-y-1.5">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {isCurrentPlan ? (
                    <Button variant="secondary" className="w-full" disabled>
                      Plano actual
                    </Button>
                  ) : plan.id === "enterprise" ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open("mailto:comercial@musicos360.com?subject=Enterprise", "_blank")}
                    >
                      Falar com comercial
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => checkoutMutation.mutate(plan.id)}
                      disabled={checkoutMutation.isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-3.5 w-3.5" />
                      )}
                      {currentPlan === "trial" ? "Assinar" : "Fazer upgrade"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}


