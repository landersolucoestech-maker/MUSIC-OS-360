import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { CampaignBuilderStepper } from "./CampaignBuilderStepper";
import { CampaignSummaryPanel } from "./CampaignSummaryPanel";
import {
  createDefaultCampaignState,
  expectedRatio,
  PLACEMENT_LABEL,
  toMarketingCampaignInput,
  validateCampaignStep,
} from "./campaign-builder.helpers";
import type { CampaignBuilderState } from "./campaign-builder.types";
import type { CreateInput, MarketingCampaign } from "../../types/marketing.types";
import {
  CampaignAudienceStep,
  CampaignBasicInfoStep,
  CampaignBudgetStep,
  CampaignCreativesStep,
  CampaignObjectiveStep,
  CampaignOutcomeStep,
  CampaignPlacementsStep,
  CampaignPlatformsStep,
  CampaignReviewStep,
} from "./steps";
import { useCampaignBuilderConfig } from "../../hooks/useMarketingCampaigns";

const LAST_STEP = 9;
const MS_PER_DAY = 86_400_000;

export function CampaignBuilderModal({
  open,
  campaign,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  campaign: MarketingCampaign | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateInput<MarketingCampaign>) => void;
}) {
  const [step, setStep] = useState(1);
  const [state, setStateValue] = useState<CampaignBuilderState>(() => createDefaultCampaignState(campaign));
  const { data: builderConfig } = useCampaignBuilderConfig();

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setStateValue(createDefaultCampaignState(campaign));
  }, [campaign, open]);

  const setState = (updater: (current: CampaignBuilderState) => CampaignBuilderState) => setStateValue(updater);
  const issues = useMemo(() => validateCampaignStep(state, step), [state, step]);
  const hasBlockingIssue = issues.some((issue) => issue.severity === "error" && issue.step === step);
  const hasFinalBlockingIssue = validateCampaignStep(state, LAST_STEP).some((issue) => issue.severity === "error");
  const bodyProps = { state, setState };
  const durationDays = getDurationDays(state.budget.startDate, state.budget.endDate);

  const updateBudget = (patch: Partial<CampaignBuilderState["budget"]>) => {
    setState((current) => ({ ...current, budget: { ...current.budget, ...patch } }));
  };

  const updateTotalBudget = (totalBudget: number) => {
    const safeTotal = Number.isFinite(totalBudget) ? Math.max(0, totalBudget) : 0;
    updateBudget({
      totalBudget: safeTotal,
      dailyBudget: Math.round(safeTotal / Math.max(1, durationDays)),
    });
  };

  const updateDurationDays = (days: number) => {
    const safeDays = Number.isFinite(days) ? Math.max(1, Math.round(days)) : 1;
    const start = parseDate(state.budget.startDate) ?? new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + safeDays - 1);
    updateBudget({
      endDate: end.toISOString().slice(0, 10),
      dailyBudget: Math.round(state.budget.totalBudget / safeDays),
    });
  };

  const submit = () => {
    onSubmit(toMarketingCampaignInput(state));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-5xl grid-rows-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <div className="pr-8">
            <DialogTitle>{campaign ? "Editar campanha" : "Nova campanha"}</DialogTitle>
            <DialogDescription>
              {builderConfig ? "Configure a campanha em etapas com regras do Campaign Builder." : "Carregando configuração do Campaign Builder..."}
            </DialogDescription>
          </div>
          <div className="pt-3">
            <CampaignBuilderStepper step={step} />
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              <main className="rounded-lg border border-border bg-card p-4">
                {step === 1 && <CampaignObjectiveStep {...bodyProps} />}
                {step === 2 && <CampaignOutcomeStep {...bodyProps} />}
                {step === 3 && <CampaignBasicInfoStep {...bodyProps} />}
                {step === 4 && <CampaignAudienceStep {...bodyProps} />}
                {step === 5 && <CampaignPlatformsStep {...bodyProps} />}
                {step === 6 && <CampaignPlacementsStep {...bodyProps} />}
                {step === 7 && <CampaignCreativesStep {...bodyProps} />}
                {step === 8 && <CampaignBudgetStep {...bodyProps} />}
                {step === 9 && <CampaignReviewStep {...bodyProps} />}

                {issues.length > 0 && (
                  <div className="mt-5 rounded-lg border border-border bg-muted/30 p-3">
                    {issues.slice(0, 4).map((issue) => (
                      <p key={issue.id} className={issue.severity === "error" ? "text-sm text-destructive" : "text-sm text-amber-600"}>
                        {issue.message}
                      </p>
                    ))}
                  </div>
                )}
              </main>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-0 lg:max-h-[calc(90vh-190px)] lg:self-start lg:overflow-y-auto lg:pr-2">
              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">Investimento</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor total</Label>
                    <Input
                      type="number"
                      min={0}
                      value={state.budget.totalBudget}
                      onChange={(event) => updateTotalBudget(Number(event.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dias</Label>
                    <Input
                      type="number"
                      min={1}
                      value={durationDays}
                      onChange={(event) => updateDurationDays(Number(event.target.value))}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Diário estimado: {state.budget.currency} {state.budget.dailyBudget.toLocaleString("pt-BR")}
                </p>
              </section>

              <section className="overflow-hidden rounded-lg border border-border bg-card">
                <CampaignSummaryPanel state={state} step={step} compact />
              </section>

              <CampaignSidePreview state={state} />
            </aside>
          </div>
        </ScrollArea>

        <footer className="flex flex-col gap-2 border-t border-border bg-background px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1}>
            Voltar
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={submit} disabled={submitting}>
              <Save className="mr-1.5 h-4 w-4" />
              Salvar rascunho
            </Button>
            {step < LAST_STEP ? (
              <Button onClick={() => setStep((current) => Math.min(LAST_STEP, current + 1))} disabled={hasBlockingIssue}>
                Próximo
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting || hasFinalBlockingIssue}>
                {submitting ? "Salvando..." : "Finalizar campanha"}
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDurationDays(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return 1;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1);
}

function CampaignSidePreview({ state }: { state: CampaignBuilderState }) {
  const creative = state.creatives[0] ?? null;
  const placementLabel = creative ? PLACEMENT_LABEL[creative.placement] : "Pré-visualização do criativo";
  const ratio = creative ? expectedRatio(creative.placement) : "9:16";

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Pré-visualização</h3>
        <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{ratio}</span>
      </div>

      <div className="mx-auto mt-4 aspect-[9/16] max-h-[300px] w-36 rounded-[22px] border-4 border-foreground/20 bg-background p-2">
        <div className="flex h-full flex-col justify-between rounded-xl border border-dashed border-border bg-muted/20 p-3">
          <div>
            <p className="text-[11px] font-semibold">{placementLabel}</p>
            <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{state.name || "Nova campanha"}</p>
          </div>
          <div className="rounded-md bg-background/80 p-3 text-center text-[10px] text-muted-foreground">
            {creative?.fileName || "Mídia / arquivo"}
          </div>
          <div>
            <p className="line-clamp-3 text-[10px]">{creative?.primaryCopy || state.internalDescription || "Copy principal da campanha"}</p>
            <p className="mt-1 line-clamp-2 text-xs font-semibold">{creative?.headline || state.release || "Headline"}</p>
            <p className="mt-2 rounded bg-primary px-2 py-1 text-center text-[10px] text-primary-foreground">
              {creative?.cta || "Ouvir agora"}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        A pré-visualização usa o primeiro criativo cadastrado. A etapa de pré-visualização continua com a lista completa.
      </p>
    </section>
  );
}

