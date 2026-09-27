import { useMemo } from "react";
import { BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { AiGeneratedResult, AiSuggestion, AnalyticsOverview, MarketingCampaign, MarketingContent } from "../../types/marketing.types";
import type { GenerateAiHandler } from "./aiCreative.types";
import { copyResult, ResultActions, ResultList, StructuredResult, WorkflowSection } from "./Shared";
import { getLatestResult } from "./aiCreative.utils";

export function AnalyticsTab({
  companyName,
  analytics,
  contents,
  campaigns,
  suggestions,
  onGenerate,
  isGenerating,
}: {
  companyName: string;
  analytics?: AnalyticsOverview;
  contents: MarketingContent[];
  campaigns: MarketingCampaign[];
  suggestions: AiSuggestion[];
  onGenerate: GenerateAiHandler;
  isGenerating: boolean;
}) {
  const result = useMemo<AiGeneratedResult | null>(() => getLatestResult(suggestions, ["analise_marca", "planejamento_campanha"]), [suggestions]);
  const topContents = useMemo(() => contents.filter((item) => item.title).slice(0, 5), [contents]);
  const topCampaigns = useMemo(() => campaigns.filter((item) => item.name).slice(0, 5), [campaigns]);
  const hasSignals = Boolean(analytics?.totals?.engagement || topContents.length || topCampaigns.length);

  const generate = () => {
    onGenerate({
      kind: "analise_marca",
      targetType: "empresa",
      targetName: companyName,
      prompt: "Analisar performance de marketing: melhores conteúdos, melhores campanhas, plataformas com melhor resultado e recomendações de otimização.",
    });
  };

  return (
    <WorkflowSection
      question="O que performou melhor?"
      result={
        <>
          {hasSignals ? (
            <div className="space-y-4">
              <SignalGrid analytics={analytics} />
              <Ranking title="Conteúdos com melhor resultado" items={topContents.map((item) => `${item.title} · ${item.channel}`)} />
              <Ranking title="Campanhas com melhor resultado" items={topCampaigns.map((item) => `${item.name} · ${item.platforms.join(", ")}`)} />
              <Ranking title="Plataformas com melhor resultado" items={analytics?.breakdownByDimension?.canal?.map((item) => item.label) ?? []} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">Ainda não há sinais suficientes de performance.</p>
              <p className="mt-1 text-xs text-muted-foreground">Publique conteúdos, vincule campanhas ou conecte plataformas para alimentar esta leitura.</p>
            </div>
          )}
          <div className="mt-5 border-t border-border pt-5">
            <StructuredResult result={result} compact />
            <ResultActions result={result} onCopy={() => copyResult(result)} onRegenerate={generate} canRegenerate={!isGenerating} isGenerating={isGenerating} />
          </div>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        Esta aba consolida os sinais disponíveis no módulo para identificar o que merece reforço, corte ou nova iteração criativa.
      </p>
      <Button onClick={generate} disabled={isGenerating} size="sm" className="w-full gap-2 sm:w-auto">
        <Sparkles className="h-4 w-4" />
        {isGenerating ? "Analisando..." : "Gerar recomendações"}
      </Button>
    </WorkflowSection>
  );
}

function SignalGrid({ analytics }: { analytics?: AnalyticsOverview }) {
  const metrics: Array<[string, string] | null> = [
    analytics?.totals?.reach ? ["Alcance", analytics.totals.reach.toLocaleString("pt-BR")] : null,
    analytics?.totals?.engagement ? ["Engajamento", analytics.totals.engagement.toLocaleString("pt-BR")] : null,
    analytics?.totals?.conversions ? ["Conversões", analytics.totals.conversions.toLocaleString("pt-BR")] : null,
    analytics?.totals?.publishedContents ? ["Conteúdos publicados", analytics.totals.publishedContents.toLocaleString("pt-BR")] : null,
  ];
  const visibleMetrics = metrics.filter((item): item is [string, string] => Boolean(item));

  if (!visibleMetrics.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visibleMetrics.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Ranking({ title, items }: { title: string; items: string[] }) {
  return <ResultList title={title} items={items.length ? items : ["Aguardando sinais publicados para compor este ranking."]} />;
}

