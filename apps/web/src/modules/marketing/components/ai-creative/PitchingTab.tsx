import { useEffect, useMemo, useState } from "react";
import { Disc3, FileAudio, ImageIcon, Send } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { statusLabelPtBr } from "@music-os-360/types";
import type { AiGeneratedResult } from "../../types/marketing.types";
import type { GenerateAiHandler, TargetOption } from "./aiCreative.types";
import type { IntelligenceSources, TrackDiagnosis } from "../../services/musicIntelligenceEngine";
import { buildPitchingPrompt, loadReleaseContext } from "../../services/musicIntelligenceEngine";
import { AsyncEntitySelect, copyResult, EntitySelect, Field, ResultActions, StructuredResult, WorkflowSection } from "./Shared";
import { getLatestResult } from "./aiCreative.utils";

export function PitchingTab({
  sources,
  onGenerate,
  isGenerating,
}: {
  sources: IntelligenceSources;
  onGenerate: GenerateAiHandler;
  isGenerating: boolean;
}) {
  const [artist, setArtist] = useState<TargetOption | null>(null);
  const [release, setRelease] = useState<TargetOption | null>(null);
  const [diagnosis, setDiagnosis] = useState<TrackDiagnosis | null>(null);
  const [lyric, setLyric] = useState("");
  const [references, setReferences] = useState("");
  const [differentials, setDifferentials] = useState("");

  const releaseOptions = useMemo<TargetOption[]>(() => (
    sources.releases
      .filter((item) => !artist || item.artist_id === artist.id || item.artist?.id === artist.id)
      .map((item) => ({
        id: item.id,
        label: item.title,
        helper: [
          item.artist?.stage_name,
          item.music_genre,
          item.status ? (statusLabelPtBr("release", item.status) ?? "Status não reconhecido") : undefined,
        ].filter(Boolean).join(" · ") || undefined,
      }))
      .filter((option) => option.id && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }))
  ), [artist, sources.releases]);

  const context = useMemo(
    () => artist && release ? loadReleaseContext(artist, release, sources) : null,
    [artist, release, sources],
  );
  const result = useMemo<AiGeneratedResult | null>(() => getLatestResult(sources.suggestions, ["pitch_playlist"]), [sources.suggestions]);
  const canGenerate = Boolean(context && diagnosis) && !isGenerating;

  useEffect(() => {
    setRelease(null);
    setDiagnosis(null);
    setLyric("");
    setReferences("");
    setDifferentials("");
  }, [artist?.id]);

  useEffect(() => {
    if (!context) {
      setDiagnosis(null);
      setLyric("");
      setReferences("");
      return;
    }
    setDiagnosis(context.diagnosis);
    setLyric(context.lyric);
    setReferences(context.references);
  }, [context]);

  const generate = () => {
    if (!context || !diagnosis) return;
    onGenerate({
      kind: "pitch_playlist",
      targetType: "projeto_musical",
      targetId: context.release.id,
      targetName: context.release.label,
      prompt: [buildPitchingPrompt(context, diagnosis), differentials ? `Diferenciais revisados: ${differentials}` : ""].filter(Boolean).join("\n\n"),
      lyricText: lyric,
      audioUrl: context.audioUrl || undefined,
      coverUrl: context.coverUrl || undefined,
      genre: diagnosis.genre,
      references,
      releasePhase: context.releaseDate,
      releaseMetadata: {
        subgenre: diagnosis.subgenre,
        mood: diagnosis.mood,
        bpm: diagnosis.bpm,
        key: diagnosis.key,
        isrc: context.isrc,
        upc: context.upc,
        releaseDate: context.releaseDate,
        credits: context.credits,
        missingData: diagnosis.missingData.join(", "),
      },
    });
  };

  return (
    <WorkflowSection
      question="Como apresentar este lançamento para plataformas, curadores e imprensa?"
      result={
        <>
          <StructuredResult result={result} compact />
          {result && <PitchPlatformList result={result} />}
          <ResultActions result={result} onCopy={() => copyResult(result)} onRegenerate={generate} canRegenerate={canGenerate} isGenerating={isGenerating} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <AsyncEntitySelect label="Artista" value={artist?.id ?? ""} table="artists" placeholder="Selecione o artista" onChange={setArtist} />
        <EntitySelect label="Lançamento" value={release?.id ?? ""} options={releaseOptions} placeholder={artist ? "Selecione o lançamento" : "Selecione um artista primeiro"} onChange={setRelease} disabled={!artist} />
      </div>

      {context && diagnosis ? (
        <>
          <ReleaseAssets context={context} />
          <DiagnosisReview diagnosis={diagnosis} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Letra carregada">
              <Textarea value={lyric} onChange={(event) => setLyric(event.target.value)} rows={8} placeholder="Letra pendente no cadastro. Revise apenas se necessário." />
              {!lyric && <PendingText>Letra ausente. A IA tentará inferir a narrativa pelo áudio/metadados disponíveis.</PendingText>}
            </Field>
            <Field label="Referências editoriais">
              <Textarea value={references} onChange={(event) => setReferences(event.target.value)} rows={8} placeholder="Referências pendentes no cadastro. Ajuste se necessário." />
            </Field>
          </div>
          <Field label="Diferenciais para o pitch">
            <Textarea value={differentials} onChange={(event) => setDifferentials(event.target.value)} rows={3} placeholder="Opcional: gancho editorial, contexto de carreira, feat, campanha, bastidores..." />
          </Field>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Selecione artista e lançamento para carregar áudio, letra, capa, metadados e exibir o Diagnóstico IA da Faixa antes do pitching.
        </div>
      )}

      <Button onClick={generate} disabled={!canGenerate} size="sm" className="w-full gap-2 sm:w-auto">
        <Send className="h-4 w-4" />
        {isGenerating ? "Gerando..." : "Gerar pitching"}
      </Button>
    </WorkflowSection>
  );
}

function ReleaseAssets({ context }: { context: NonNullable<ReturnType<typeof loadReleaseContext>> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
        {context.coverUrl ? (
          <img src={context.coverUrl} alt="Capa do lançamento" className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-square items-center justify-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>
        )}
      </div>
      <div className="space-y-3">
        <section className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><FileAudio className="h-4 w-4 text-primary" /> Áudio cadastrado</div>
          {context.audioUrl ? <audio controls src={context.audioUrl} className="mt-3 w-full" /> : <PendingText>Áudio ausente. Análise segue com letra/metadados e marca pendência.</PendingText>}
        </section>
        <section className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Disc3 className="h-4 w-4 text-primary" /> Dados carregados</div>
          <p className="mt-2 text-xs text-muted-foreground">Histórico: {context.artistHistory.length} lançamentos. Campanhas relacionadas: {context.relatedCampaigns.length}. Métricas: {context.relatedMetrics.length || "pendentes"}.</p>
        </section>
      </div>
    </div>
  );
}

function DiagnosisReview({ diagnosis }: { diagnosis: TrackDiagnosis }) {
  return (
    <section className="rounded-lg border border-border bg-muted/10 p-4">
      <h3 className="text-sm font-semibold">Diagnóstico IA da Faixa</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DiagnosisValue label="Gênero detectado" value={diagnosis.genre} />
        <DiagnosisValue label="Subgênero detectado" value={diagnosis.subgenre} />
        <DiagnosisValue label="BPM detectado" value={diagnosis.bpm} />
        <DiagnosisValue label="Tonalidade detectada" value={diagnosis.key} />
        <DiagnosisValue label="Clima detectado" value={diagnosis.mood} />
        <DiagnosisValue label="Energia" value={diagnosis.energy} />
        <DiagnosisValue label="Tema da letra" value={diagnosis.theme} />
        <DiagnosisValue label="Sentimento" value={diagnosis.sentiment} />
        <DiagnosisValue label="Público-alvo" value={diagnosis.targetAudience} />
        <ReadOnlyList label="Tags editoriais" items={diagnosis.editorialTags} />
        <ReadOnlyList label="Playlists sugeridas" items={diagnosis.playlistFit} />
        <ReadOnlyList label="Plataformas prioritárias" items={diagnosis.platformPriority} />
        <DiagnosisValue label="Potencial comercial" value={diagnosis.commercialPotential} />
        <DiagnosisValue label="Potencial viral" value={diagnosis.viralPotential} />
        <DiagnosisValue label="Potencial de sincronização" value={diagnosis.syncPotential} />
        <ReadOnlyList label="Dados ausentes" items={diagnosis.missingData.length ? diagnosis.missingData : ["Nenhuma pendência critica"]} />
      </div>
    </section>
  );
}

function DiagnosisValue({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <div className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground">
        {value || "Pendente"}
      </div>
      {!value || value === "pendente" ? <PendingText>Pendente para revisão manual ou inferência da IA.</PendingText> : null}
    </Field>
  );
}

function ReadOnlyList({ label, items }: { label: string; items: string[] }) {
  return (
    <Field label={label}>
      <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">{items.join(", ")}</div>
    </Field>
  );
}

function PendingText({ children }: { children: string }) {
  return <p className="mt-1 text-[11px] text-amber-600">{children}</p>;
}

function PitchPlatformList({ result }: { result: AiGeneratedResult }) {
  const base = result.pitchSuggestions.length ? result.pitchSuggestions : result.nextActions;
  const platforms = ["Pitch Universal", "Spotify", "Deezer", "Apple Music", "Amazon Music", "YouTube Music", "Curadores independentes", "Release imprensa", "Distribuidora"];
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {platforms.map((platform, index) => (
        <section key={platform} className="rounded-lg border border-border bg-muted/20 p-3">
          <h3 className="text-sm font-semibold">{platform}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{base[index % Math.max(base.length, 1)] || "Aguardando geração do pitch."}</p>
        </section>
      ))}
    </div>
  );
}

