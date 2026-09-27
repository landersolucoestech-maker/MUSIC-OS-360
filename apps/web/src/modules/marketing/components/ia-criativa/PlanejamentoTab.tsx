import { useMemo, useState } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { GenerateAiHandler, TargetOption } from "./iaCriativa.types";
import type { PlanningContext } from "../../services/musicIntelligenceEngine";
import { generatePlanningDraft } from "../../services/musicIntelligenceEngine";
import { AsyncEntitySelect, EntitySelect, Field, ResultList, WorkflowSection } from "./Shared";

export function PlanejamentoTab({
  releaseOptions,
  onGenerate,
  isGenerating,
}: {
  releaseOptions: TargetOption[];
  onGenerate: GenerateAiHandler;
  isGenerating: boolean;
}) {
  const [artist, setArtist] = useState<TargetOption | null>(null);
  const [release, setRelease] = useState<TargetOption | null>(null);
  const [objective, setObjective] = useState("crescimento e descoberta");
  const [platform, setPlatform] = useState("multicanal");
  const [period, setPeriod] = useState<"7" | "30" | "60" | "90">("30");

  const plan = useMemo<PlanningContext>(() => generatePlanningDraft({ artist: artist ?? undefined, release: release ?? undefined, objective, platform, period }), [artist, release, objective, platform, period]);

  const generate = () => {
    onGenerate({
      kind: "planejamento_campanha",
      targetType: artist ? "artista" : "empresa",
      targetId: artist?.id,
      targetName: artist?.label || "Empresa",
      prompt: `Gerar plano executavel de ${period} dias para ${artist?.label || "empresa"}${release ? ` / ${release.label}` : ""}. Objetivo: ${objective}. Plataforma: ${platform}. Itens sugeridos: ${plan.items.map((item) => item.title).join(", ")}.`,
      campaignObjective: objective,
      releasePhase: `${period} dias`,
      references: JSON.stringify(plan),
    });
  };

  return (
    <WorkflowSection
      question="O que deve ser feito nos proximos 30/60/90 dias?"
      result={
        <div className="space-y-4">
          <ResultList title={`Plano de ${period} dias`} items={plan.items.map((item) => `${item.title} · D+${item.dueInDays} · ${item.channel} · ${item.priority}`)} />
          <p className="text-xs text-muted-foreground">Cada item planejado esta pronto para virar tarefa no modulo Tarefas quando a integração de criação operacional estiver conectada.</p>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <AsyncEntitySelect label="Artista opcional" value={artist?.id ?? ""} table="artistas" placeholder="Selecionar artista" onChange={setArtist} />
        <EntitySelect label="Lançamento opcional" value={release?.id ?? ""} options={releaseOptions} placeholder="Selecionar lançamento" onChange={setRelease} />
        <Field label="Objetivo">
          <Input value={objective} onChange={(event) => setObjective(event.target.value)} />
        </Field>
        <Field label="Plataforma">
          <Input value={platform} onChange={(event) => setPlatform(event.target.value)} />
        </Field>
        <Field label="Período">
          <Select value={period} onValueChange={(value) => {
            if (value === "7" || value === "30" || value === "60" || value === "90") setPeriod(value);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Button onClick={generate} disabled={isGenerating} size="sm" className="w-full gap-2 sm:w-auto">
        <CalendarDays className="h-4 w-4" />
        {isGenerating ? "Gerando..." : "Gerar planejamento"}
      </Button>
    </WorkflowSection>
  );
}

