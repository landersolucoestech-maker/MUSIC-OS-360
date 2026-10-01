import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { AiGeneratedResult, AiSuggestion } from "../../types/marketing.types";
import type { GenerateAiHandler } from "./aiCreative.types";
import { copyResult, ResultActions, ResultList, StructuredResult, WorkflowSection } from "../ai-creative/Shared";
import { getLatestResult } from "./aiCreative.utils";

export function TrendsTab({
  companyName,
  suggestions,
  onGenerate,
  isGenerating,
}: {
  companyName: string;
  suggestions: AiSuggestion[];
  onGenerate: GenerateAiHandler;
  isGenerating: boolean;
}) {
  const result = useMemo<AiGeneratedResult | null>(() => getLatestResult(suggestions, ["positioning", "brand_analysis"]), [suggestions]);

  const generate = () => {
    onGenerate({
      kind: "positioning",
      targetType: "company",
      targetName: companyName,
      prompt: "Gerar inteligência de mercado para marketing musical: gêneros em alta, conteúdos em alta, artistas em crescimento, oportunidades e recomendações da IA.",
    });
  };

  return (
    <WorkflowSection
      question="O que esta acontecendo no mercado agora?"
      result={
        <>
          <StructuredResult result={result} compact />
          {result && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ResultList title="Gêneros em alta" items={result.audience} />
              <ResultList title="Conteúdos em alta" items={result.contentIdeas} />
              <ResultList title="Artistas em crescimento" items={result.positioning} />
              <ResultList title="Oportunidades de mercado" items={result.campaignIdeas.length ? result.campaignIdeas : result.strengths} />
              <ResultList title="Recomendações da IA" items={result.nextActions} />
            </div>
          )}
          <ResultActions result={result} onCopy={() => copyResult(result)} onRegenerate={generate} canRegenerate={!isGenerating} isGenerating={isGenerating} />
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        A leitura usa o contexto da empresa e o motor atual de IA do módulo. Quando as integrações de dados externos forem conectadas, esta aba passa a consumir sinais reais de mercado.
      </p>
      <Button onClick={generate} disabled={isGenerating} size="sm" className="w-full gap-2 sm:w-auto">
        <TrendingUp className="h-4 w-4" />
        {isGenerating ? "Atualizando..." : "Atualizar inteligência"}
      </Button>
    </WorkflowSection>
  );
}

