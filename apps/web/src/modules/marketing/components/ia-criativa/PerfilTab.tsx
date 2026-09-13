import { useMemo, useState } from "react";
import { BarChart3, Disc3, Radio, Search, Share2, Target, TrendingUp, UserRound } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { useObras } from "@/modules/catalog/hooks/useObras";
import { useFonogramas } from "@/modules/catalog/hooks/useFonogramas";
import type { AiGeneratedResult } from "../../types/marketing.types";
import type { ArtistProfileSources, GenerateAiHandler, TargetOption } from "./iaCriativa.types";
import { buildArtistProfilePrompt, loadArtistContext, type ArtistProfileContext } from "../../services/musicIntelligenceEngine";
import { AsyncEntitySelect, copyResult, ResultActions, ResultList, ResultText, StructuredResult, WorkflowSection } from "./Shared";
import { getLatestResult } from "./iaCriativa.utils";

type ArtistProfileBundle = ArtistProfileContext;

export function PerfilTab({
  sources,
  onGenerate,
  isGenerating,
}: {
  sources: ArtistProfileSources;
  onGenerate: GenerateAiHandler;
  isGenerating: boolean;
}) {
  const [artist, setArtist] = useState<TargetOption | null>(null);

  // Task J — catálogo do artista selecionado busca direto e escopado por
  // artist_id (server-side), nunca mais filtrando sources.obras/fonogramas
  // sem filtro (capadas aos primeiros 50 do tenant).
  const { entity: artistRecordWire } = useEntityById<ArtistWireRecord>("artistas", artist?.id);
  const artistRecord: Artist | undefined = artistRecordWire ? wireToArtist(artistRecordWire) : undefined;
  const { obras } = useObras(!!artist, artist?.id);
  const { fonogramas } = useFonogramas(!!artist, artist?.id);

  const bundle = useMemo<ArtistProfileBundle | null>(
    () => artist ? loadArtistContext(artist, sources, { artistRecord, obras, fonogramas }) : null,
    [artist, sources, artistRecord, obras, fonogramas],
  );
  const result = useMemo<AiGeneratedResult | null>(() => (
    artist ? getLatestResult(sources.suggestions.filter((item) => item.targetId === artist.id || item.targetName === artist.label), ["analise_artista"]) : null
  ), [artist, sources.suggestions]);
  const canGenerate = Boolean(artist && bundle) && !isGenerating;

  const generate = () => {
    if (!artist || !bundle) return;
    onGenerate({
      kind: "analise_artista",
      targetType: "artista",
      targetId: artist.id,
      targetName: artist.label,
      prompt: buildArtistProfilePrompt(bundle),
      profileData: bundle,
      audience: bundle.publicSignals.join(" | "),
      genre: bundle.predominantGenre,
      references: bundle.references.join(" | "),
    });
  };

  return (
    <WorkflowSection
      question="Quem vamos analisar?"
      result={
        <>
          {result ? <ExecutiveProfileResult result={result} bundle={bundle} /> : <ProfileWaitingState bundle={bundle} />}
          <ResultActions result={result} onCopy={() => copyResult(result)} onRegenerate={generate} canRegenerate={canGenerate} isGenerating={isGenerating} />
        </>
      }
    >
      <AsyncEntitySelect
        label="Artista"
        value={artist?.id ?? ""}
        table="artistas"
        placeholder="Selecione o artista"
        onChange={setArtist}
      />
      {bundle && <ProfileDataDashboard bundle={bundle} />}
      <Button onClick={generate} disabled={!canGenerate} size="sm" className="w-full gap-2 sm:w-auto">
        <Search className="h-4 w-4" />
        {isGenerating ? "Analisando..." : "Executar análise completa"}
      </Button>
    </WorkflowSection>
  );
}

function ProfileDataDashboard({ bundle }: { bundle: ArtistProfileBundle }) {
  const stats = [
    { label: "Lançamentos", value: bundle.catalog.totalReleases, icon: Disc3 },
    { label: "Faixas/Fonogramas", value: bundle.catalog.totalTracks, icon: Radio },
    { label: "Campanhas", value: bundle.operations.campaigns.length, icon: Target },
    { label: "Pitchings", value: bundle.operations.pitchings.length, icon: Share2 },
    { label: "Tarefas", value: bundle.operations.tasks.length, icon: BarChart3 },
    { label: "Estágio", value: bundle.careerStage, icon: TrendingUp },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <stat.icon className="h-3.5 w-3.5" />
              {stat.label}
            </div>
            <p className="mt-1 text-lg font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
        Dados carregados automaticamente do cadastro do artista, catálogo, lançamentos, fonogramas, campanhas, pitchings e histórico de tarefas.
      </div>
    </div>
  );
}

function ProfileWaitingState({ bundle }: { bundle: ArtistProfileBundle | null }) {
  if (!bundle) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <UserRound className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">Selecione um artista para carregar o dossie automaticamente.</p>
        <p className="mt-1 text-xs text-muted-foreground">A analise usa os dados ja cadastrados no sistema, nao um formulario manual.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <Search className="mx-auto h-8 w-8 text-muted-foreground/60" />
      <p className="mt-3 text-sm font-medium">Dossie carregado para {bundle.artist.label}.</p>
      <p className="mt-1 text-xs text-muted-foreground">Execute a analise para preencher o dashboard executivo com diagnostico estrategico.</p>
    </div>
  );
}

function ExecutiveProfileResult({ result, bundle }: { result: AiGeneratedResult; bundle: ArtistProfileBundle | null }) {
  return (
    <div className="space-y-4">
      <StructuredResult result={result} compact />
      <div className="grid gap-3 md:grid-cols-2">
        <ResultText title="Perfil Artistico" text={[
          bundle?.predominantGenre ? `Gênero predominante: ${bundle.predominantGenre}.` : "Gênero predominante a inferir pela IA.",
          bundle?.subgenres.length ? `Subgêneros: ${bundle.subgenres.join(", ")}.` : "Subgêneros pendentes para inferência.",
          bundle?.moods.length ? `Mood: ${bundle.moods.join(", ")}.` : "Mood pendente para inferência por áudio/letra.",
        ].join(" ")} />
        <ResultText title="Carreira" text={`Estágio atual: ${bundle?.careerStage ?? "Aguardando dados"}. Ritmo: ${bundle?.growthRhythm ?? "Aguardando dados"}. Consistência: ${bundle?.catalog.frequency ?? "Aguardando dados"}.`} />
        <ResultList title="Público" items={result.audience.length ? result.audience : bundle?.publicSignals ?? []} />
        <ResultList title="Catálogo" items={[
          `${bundle?.catalog.totalReleases ?? 0} lançamentos cadastrados.`,
          `${bundle?.catalog.totalTracks ?? 0} faixas/fonogramas cadastrados.`,
          `Frequência: ${bundle?.catalog.frequency ?? "pendente"}.`,
        ]} />
        <ResultList title="Mercado" items={result.positioning} />
        <ResultList title="Estratégia" items={[...result.campaignIdeas, ...result.pitchSuggestions]} />
        <ResultList title="Diagnóstico" items={[...result.strengths, ...result.risks, ...result.nextActions]} />
      </div>
    </div>
  );
}


