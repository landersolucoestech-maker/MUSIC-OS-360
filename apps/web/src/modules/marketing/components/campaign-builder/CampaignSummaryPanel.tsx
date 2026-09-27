import { formatCurrency } from "../../utils/marketing-format";
import { estimateCampaignResults, EXPECTED_OUTCOME_LABEL, OBJECTIVE_LABEL, PLACEMENT_LABEL, PLATFORM_LABEL, PROMOTED_ENTITY_LABEL, validateCampaignStep } from "./campaign-builder.helpers";
import type { CampaignBuilderState } from "./campaign-builder.types";

export function CampaignSummaryPanel({ state, step, compact = false }: { state: CampaignBuilderState; step: number; compact?: boolean }) {
  const issues = validateCampaignStep(state, step);
  const estimates = estimateCampaignResults(state);
  return (
    <aside className={compact ? "space-y-3 border-t border-border p-4" : "space-y-4 border-l border-border bg-muted/20 p-4"}>
      <div>
        <h3 className="font-semibold">Resumo</h3>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
        <Summary label="Objetivo" value={OBJECTIVE_LABEL[state.objective]} />
        <Summary label="Resultado" value={state.expectedOutcome ? EXPECTED_OUTCOME_LABEL[state.expectedOutcome] : "Pendente"} />
        <Summary label="Campanha" value={state.name || "Pendente"} />
        <Summary label="Entidade" value={`${PROMOTED_ENTITY_LABEL[state.promotedEntityType]}: ${state.promotedEntityName || "Pendente"}`} />
        <Summary label="Plataformas" value={state.platforms.map((item) => PLATFORM_LABEL[item]).join(", ") || "Pendente"} />
        <Summary label="Posicionamentos" value={state.placements.map((item) => PLACEMENT_LABEL[item]).join(", ") || "Pendente"} />
        <Summary label="Criativos" value={`${state.creatives.length} cadastrados`} />
        <Summary label="Orçamento" value={formatCurrency(state.budget.totalBudget)} />
        <Summary label="Status" value="Rascunho" />
      </div>
      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-semibold">Estimativa calculada</p>
        <p className="mt-1 text-muted-foreground">Alcance: {estimates.reach.toLocaleString("pt-BR")}</p>
        <p className="text-muted-foreground">Cliques: {estimates.clicks.toLocaleString("pt-BR")}</p>
        <p className="text-muted-foreground">Conversoes: {estimates.conversions.toLocaleString("pt-BR")}</p>
      </div>
      {issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-destructive">Pendencias</p>
          {issues.slice(0, 5).map((issue) => (
            <p key={issue.id} className="text-xs text-muted-foreground">{issue.message}</p>
          ))}
        </div>
      )}
    </aside>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
