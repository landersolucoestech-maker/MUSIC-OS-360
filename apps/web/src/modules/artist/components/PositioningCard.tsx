import type { ReactNode } from "react";
import { Target, ArrowUpRight, ArrowDownRight, Info, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Progress } from "@/shared/ui/progress";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/shared/ui/sheet";
import { useCareerStage, type CareerStageDimensionKey } from "@/modules/artist/hooks/useCareerStage";
import { useMarketBenchmark } from "@/modules/artist/hooks/useMarketBenchmark";

const DIMENSION_LABELS: Record<CareerStageDimensionKey, string> = {
  AUDIENCE: "Audiência",
  STREAMING: "Streaming",
  SOCIAL: "Social",
  MARKET_PRESENCE: "Presença de Mercado",
  GROWTH: "Crescimento (30d)",
  MOMENTUM: "Momentum (90d)",
};

// Mesmos rótulos amigáveis já usados em ArtistPlatformMetrics.tsx para cada
// plataforma — reaproveitados aqui (item 61: nunca mostrar "spotify.monthly_listeners" na UI).
const METRIC_LABELS: Record<string, string> = {
  "spotify.monthly_listeners": "Spotify · Ouvintes mensais",
  "youtube.subscribers": "YouTube · Inscritos",
  "deezer.fans": "Deezer · Fãs",
  "soundcloud.followers": "SoundCloud · Seguidores",
  "instagram.followers": "Instagram · Seguidores",
  "tiktok.followers": "TikTok · Seguidores",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatRaw(value: number | null): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? numberFormatter.format(value) : `${value.toFixed(1)}%`;
}

function formatCount(value: number | null): string {
  return value == null ? "—" : numberFormatter.format(Math.round(value));
}

function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
      {icon}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70">{subtitle}</p>
    </div>
  );
}

/**
 * Fase 3.2 (Parte IV) — Posicionamento da Carreira: substitui os dois cards
 * independentes (Estágio da Carreira / Benchmark de Mercado) por UM
 * diagnóstico consolidado. Career Stage é o diagnóstico principal (nível 2-3);
 * Market Benchmark é contexto comparativo (nível 4-5), nunca um segundo
 * veredito concorrente — sem P77/"Forte" isolados na UI principal (item 60).
 *
 * As duas fontes são deliberadamente independentes (item 25, eventual
 * consistency): falha/staleness do benchmark nunca esconde o diagnóstico de
 * carreira já disponível, e vice-versa. Nenhum cálculo é duplicado aqui — o
 * componente só apresenta os contratos já calculados no backend.
 */
export function PositioningCard({ artistId }: { artistId: string }) {
  const careerStage = useCareerStage(artistId);
  const benchmark = useMarketBenchmark(artistId);

  const cs = careerStage.data;
  const mb = benchmark.data;

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-teal-500" />
          <h3 className="font-semibold">Posicionamento da Carreira</h3>
        </div>

        {careerStage.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : careerStage.isError ? (
          <EmptyState
            icon={<Target className="h-10 w-10 text-muted-foreground/30" />}
            title="Integração indisponível"
            subtitle="Não foi possível calcular o posicionamento agora. Tente novamente em instantes."
          />
        ) : !cs || cs.status === "INSUFFICIENT_DATA" ? (
          <EmptyState
            icon={<Target className="h-10 w-10 text-muted-foreground/30" />}
            title="Posicionamento não calculado"
            subtitle={
              cs
                ? `Cobertura de dados insuficiente ainda (${Math.round(cs.coverage * 100)}% dos sinais disponíveis). Sincronize mais plataformas para calcular.`
                : "Cálculo automático de posicionamento ainda não está disponível nesta versão."
            }
          />
        ) : (
          <>
            {/* Nível 2 — diagnóstico principal: nota do Career Stage */}
            <div className="flex items-start gap-4 mb-4">
              <div className="relative">
                <div className="h-14 w-14 rounded-full bg-teal-500/20 border-4 border-teal-500 flex items-center justify-center">
                  <span className="text-lg font-bold text-teal-400" data-testid={`positioning-score-${artistId}`}>
                    {cs.score?.toFixed(1)}
                  </span>
                </div>
                <span className="absolute -top-1 -right-1 text-[9px] bg-teal-500 text-foreground px-1.5 py-0.5 rounded-full">
                  /10
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-teal-400" data-testid={`positioning-classification-${artistId}`}>
                  {cs.classification}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Visão consolidada do desempenho e posicionamento atual do artista.
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Confiança {cs.confidence}% · Cobertura {Math.round(cs.coverage * 100)}%
                  {cs.freshness === "STALE" ? " · dado desatualizado" : ""}
                </p>
              </div>
            </div>

            {/* Nível 3 — dimensões */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
              {cs.dimensions.map((dim) => (
                <div key={dim.key} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 text-muted-foreground">{DIMENSION_LABELS[dim.key]}</span>
                  {dim.score != null ? (
                    <>
                      <Progress value={dim.score} className="h-1.5 flex-1" />
                      <span className="w-8 text-right text-muted-foreground">{Math.round(dim.score)}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/50 italic">sem dado</span>
                  )}
                </div>
              ))}
            </div>

            {(cs.positiveFactors.length > 0 || cs.bottlenecks.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {cs.positiveFactors.length > 0 && (
                  <div className="flex items-start gap-1">
                    <ArrowUpRight className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground">
                      {cs.positiveFactors.map((f) => DIMENSION_LABELS[f.dimension]).join(", ")}
                    </p>
                  </div>
                )}
                {cs.bottlenecks.length > 0 && (
                  <div className="flex items-start gap-1">
                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground">
                      {cs.bottlenecks.map((f) => DIMENSION_LABELS[f.dimension]).join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="h-px bg-border my-3" />

            {/* Nível 4 — comparação com o mercado (contexto, não segundo diagnóstico) */}
            <MarketComparisonSection artistId={artistId} isLoading={benchmark.isLoading} isError={benchmark.isError} data={mb} />

            {/* Nível 6 — fonte, cobertura, freshness */}
            <p className="text-[10px] text-muted-foreground/60 mt-3">
              Fonte: Soundcharts · Career Stage {cs.engineVersion} · atualizado em {new Date(cs.calculatedAt).toLocaleString("pt-BR")}
            </p>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" type="button" className="mt-1 h-6 gap-1 px-1 text-[10px] text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Como este posicionamento é calculado?
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Como este posicionamento é calculado?</SheetTitle>
                  <SheetDescription>
                    Career Stage {cs.engineVersion} · calculado em {new Date(cs.calculatedAt).toLocaleString("pt-BR")}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Dimensões do Career Stage</p>
                    {cs.dimensions.map((dim) => (
                      <div key={dim.key} className="border-b border-border pb-3 mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{DIMENSION_LABELS[dim.key]}</span>
                          <Badge variant={dim.status === "AVAILABLE" ? "secondary" : "outline"}>
                            {dim.score != null ? `${Math.round(dim.score)}/100` : "sem dado"} · peso {dim.weight}%
                          </Badge>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {dim.evidence.map((e) => (
                            <li key={e.metricKey}>
                              {e.metricKey}: {formatRaw(e.rawValue)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {[...cs.positiveFactors, ...cs.bottlenecks].map((item) => (
                      <p key={item.dimension} className="text-xs text-muted-foreground">
                        {item.reason}
                      </p>
                    ))}
                  </div>

                  {mb?.result && mb.result.status === "OK" && (
                    <div>
                      <p className="text-sm font-medium mb-2">Comparação de mercado</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Engine {mb.result.engineVersion} · coorte nível {mb.result.fallbackLevel} · {mb.result.sampleSize} artista(s) comparável(is) via Soundcharts · calculado em{" "}
                        {new Date(mb.result.calculatedAt).toLocaleString("pt-BR")}
                        {mb.readStatus === "STALE" ? " · atualizando em segundo plano" : ""}
                      </p>
                      {mb.result.metrics.map((m) => (
                        <div key={m.metricKey} className="border-b border-border pb-2 mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{METRIC_LABELS[m.metricKey] ?? m.metricKey}</span>
                            <Badge variant={m.status === "AVAILABLE" ? "secondary" : "outline"}>
                              {m.status === "AVAILABLE" ? `P${Math.round(m.percentile as number)}` : m.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Artista: {formatRaw(m.artistValue)} · referência de mercado: {formatRaw(m.cohortMedian)} · amostra: {m.sampleSize} ({m.sampleQuality})
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MarketComparisonSection({
  isLoading,
  isError,
  data,
}: {
  artistId: string;
  isLoading: boolean;
  isError: boolean;
  data: ReturnType<typeof useMarketBenchmark>["data"];
}) {
  const label = (
    <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
      <TrendingUp className="h-3.5 w-3.5" /> Comparação com o mercado
    </p>
  );

  if (isLoading) {
    return (
      <div>
        {label}
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (isError || data?.readStatus === "ERROR") {
    return (
      <div>
        {label}
        <p className="text-xs text-muted-foreground/70">A última tentativa de comparação falhou. Uma nova tentativa será feita automaticamente.</p>
      </div>
    );
  }
  if (data?.readStatus === "INTEGRATION_UNAVAILABLE") {
    return (
      <div>
        {label}
        <p className="text-xs text-muted-foreground/70">Integração indisponível para agendar a comparação agora.</p>
      </div>
    );
  }
  if (data?.readStatus === "REFRESHING" && !data.result) {
    return (
      <div>
        {label}
        <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Buscando artistas comparáveis reais via Soundcharts.
        </p>
      </div>
    );
  }
  if (!data?.result || data.result.status === "INSUFFICIENT_MARKET_DATA") {
    return (
      <div>
        {label}
        <p className="text-xs text-muted-foreground/70">
          {data?.result
            ? `Dados de mercado insuficientes: só ${data.result.sampleSize} artista(s) comparável(is) hoje (mínimo 10).`
            : "Sem dados de mercado suficientes para comparar."}
        </p>
      </div>
    );
  }

  const result = data.result;
  const availableMetrics = result.metrics.filter((m) => m.status === "AVAILABLE" && m.percentile != null);

  return (
    <div>
      {label}
      {data.readStatus === "STALE" && (
        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-muted-foreground/80">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Atualizando em segundo plano — mostrando a última comparação conhecida
          {data.staleSince ? ` (${new Date(data.staleSince).toLocaleDateString("pt-BR")})` : ""}.
        </div>
      )}
      <p className="text-sm text-foreground mb-2">
        {result.score != null ? (
          <>
            Melhor que <span className="font-semibold">{Math.round(result.score)}%</span> dos{" "}
            <span className="font-semibold">{result.sampleSize}</span> artistas comparáveis
            {result.cohortDefinition.countryFilter ? ` (país ${result.cohortDefinition.countryFilter})` : ""}.
          </>
        ) : (
          "Comparação de mercado sem posição consolidada no momento."
        )}
      </p>

      {availableMetrics.length > 0 && (
        <div className="space-y-1 mb-1">
          {availableMetrics.map((m) => (
            <div key={m.metricKey} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{METRIC_LABELS[m.metricKey] ?? m.metricKey}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground">{formatCount(m.artistValue)}</span>
                <span className="text-muted-foreground/50">vs</span>
                <span className="text-muted-foreground">{formatCount(m.cohortMedian)}</span>
                {m.sampleQuality !== "HIGH" && (
                  <span
                    className="text-[9px] text-muted-foreground/70"
                    title={`amostra ${m.sampleQuality === "MEDIUM" ? "moderada" : "insuficiente"} (n=${m.sampleSize})`}
                  >
                    {m.sampleQuality === "MEDIUM" ? "·" : "!"}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
