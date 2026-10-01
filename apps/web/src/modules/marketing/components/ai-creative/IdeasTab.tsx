import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { AiGeneratedResult, AiSuggestion, AiTaskKind } from "../../types/marketing.types";
import type { GenerateAiHandler, TargetOption } from "./aiCreative.types";
import { AsyncEntitySelect, BriefingTextarea, copyResult, EntitySelect, Field, ResultActions, StructuredResult, WorkflowSection } from "./Shared";
import { getLatestResult } from "./aiCreative.utils";

const OBJECTIVES: Array<{ value: AiTaskKind; label: string }> = [
  { value: "content_suggestion", label: "Post" },
  { value: "caption", label: "Legenda" },
  { value: "script", label: "Roteiro" },
  { value: "press_pitch", label: "Press Release" },
  { value: "campaign_planning", label: "Campanha" },
  { value: "editorial_calendar", label: "Calendário Editorial" },
  { value: "corporate_content", label: "E-mail Marketing" },
];

function isIdeaObjective(value: string): value is AiTaskKind {
  return OBJECTIVES.some((option) => option.value === value);
}

export function IdeasTab({
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
  const [context, setContext] = useState<"artist" | "music_project">("artist");
  const [target, setTarget] = useState<TargetOption | null>(null);
  const [campaign, setCampaign] = useState<TargetOption | null>(null);
  const [objective, setObjective] = useState<AiTaskKind>("content_suggestion");
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
              if (value === "artist" || value === "music_project") {
                setContext(value);
                setTarget(null);
              }
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="artist">Artista</SelectItem>
              <SelectItem value="music_project">Projeto</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <AsyncEntitySelect
          label={context === "artist" ? "Artista" : "Projeto"}
          value={target?.id ?? ""}
          table={context === "artist" ? "artists" : "projects"}
          placeholder={context === "artist" ? "Selecione o artista" : "Selecione o projeto"}
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

