import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { AiGeneratedResult, AiSuggestion, AiTaskKind } from "../../types/marketing.types";
import type { GenerateAiHandler, TargetOption } from "./iaCriativa.types";
import { AsyncEntitySelect, BriefingTextarea, copyResult, EntitySelect, Field, ResultActions, StructuredResult, WorkflowSection } from "./Shared";
import { getLatestResult } from "./iaCriativa.utils";

const OBJECTIVES: Array<{ value: AiTaskKind; label: string }> = [
  { value: "sugestao_conteudo", label: "Post" },
  { value: "legenda", label: "Legenda" },
  { value: "roteiro", label: "Roteiro" },
  { value: "pitch_imprensa", label: "Press Release" },
  { value: "planejamento_campanha", label: "Campanha" },
  { value: "calendario_editorial", label: "Calendário Editorial" },
  { value: "conteudo_corporativo", label: "E-mail Marketing" },
];

function isIdeaObjective(value: string): value is AiTaskKind {
  return OBJECTIVES.some((option) => option.value === value);
}

export function IdeiasTab({
  campaignOptions,
  suggestions,
  onGenerate,
  isGenerating,
}: {
  campaignOptions: TargetOption[];
  suggestions: AiSuggestion[];
  onGenerate: GenerateAiHandler;
  isGenerating: boolean;
}) {
  const [context, setContext] = useState<"artista" | "projeto_musical">("artista");
  const [target, setTarget] = useState<TargetOption | null>(null);
  const [campaign, setCampaign] = useState<TargetOption | null>(null);
  const [objective, setObjective] = useState<AiTaskKind>("sugestao_conteudo");
  const [briefing, setBriefing] = useState("");
  const [customCampaign, setCustomCampaign] = useState("");

  const result = useMemo<AiGeneratedResult | null>(() => getLatestResult(suggestions, OBJECTIVES.map((item) => item.value)), [suggestions]);
  const canGenerate = Boolean(target && objective && briefing.trim()) && !isGenerating;

  const generate = () => {
    if (!target) return;
    onGenerate({
      kind: objective,
      targetType: context,
      targetId: target.id,
      targetName: target.label,
      prompt: briefing.trim(),
      campaignObjective: customCampaign || campaign?.label || undefined,
    });
  };

  return (
    <WorkflowSection
      question="O que você deseja criar?"
      result={
        <>
          <StructuredResult result={result} />
          <ResultActions result={result} onCopy={() => copyResult(result)} onRegenerate={generate} canRegenerate={canGenerate} isGenerating={isGenerating} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Contexto">
          <Select
            value={context}
            onValueChange={(value) => {
              if (value === "artista" || value === "projeto_musical") {
                setContext(value);
                setTarget(null);
              }
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="artista">Artista</SelectItem>
              <SelectItem value="projeto_musical">Projeto</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <AsyncEntitySelect
          label={context === "artista" ? "Artista" : "Projeto"}
          value={target?.id ?? ""}
          table={context === "artista" ? "artistas" : "projects"}
          placeholder={context === "artista" ? "Selecione o artista" : "Selecione o projeto"}
          onChange={setTarget}
        />
        <EntitySelect
          label="Campanha opcional"
          value={campaign?.id ?? ""}
          options={campaignOptions}
          placeholder="Vincular campanha"
          onChange={setCampaign}
        />
        <Field label="Campanha livre opcional">
          <Input value={customCampaign} onChange={(event) => setCustomCampaign(event.target.value)} placeholder="Nome da campanha, se ainda não cadastrada" />
        </Field>
        <Field label="Objetivo">
          <Select value={objective} onValueChange={(value) => {
            if (isIdeaObjective(value)) setObjective(value);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <BriefingTextarea value={briefing} onChange={setBriefing} />
      <Button onClick={generate} disabled={!canGenerate} size="sm" className="w-full gap-2 sm:w-auto">
        <Sparkles className="h-4 w-4" />
        {isGenerating ? "Gerando..." : "Gerar conteúdo"}
      </Button>
    </WorkflowSection>
  );
}

