import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { storage } from "@/shared/lib/storage";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import {
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Mic2,
  UserRound,
} from "lucide-react";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import type { FonogramaWithRelations } from "@/modules/catalog/hooks/useFonogramas";
import { useShares } from "@/modules/releases/hooks/useShares";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { WorkflowTransitionPanel } from "@/shared/components/WorkflowTransitionPanel";
import { useWorkflowTransition } from "@/shared/hooks/useWorkflowTransition";
import { useEntityDetail } from "@/shared/hooks/useEntityDetail";
import { resolveAllowedTransitions, WorkflowTransition } from "@/shared/lib/workflow-transitions";
import {
  resolvePlatformStatus,
  releaseStatusBadge,
  platformStatusBadge,
} from "@/modules/releases/lib/release-status";
import { formatReleaseDate } from "@/modules/releases/lib/release-format";
import { findDistributionPlatform } from "@/modules/releases/services/distribution-platforms";
import type { Lancamento, PlatformError } from "@/modules/releases/types";

interface LancamentoViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento?: Lancamento;
}

const TIPO_MAP: Record<string, { label: string; color: string }> = {
  single: { label: "Single", color: "bg-primary text-foreground" },
  ep: { label: "EP", color: "bg-blue-600 text-foreground" },
  album: { label: "Album", color: "bg-primary text-foreground" },
};

const IDIOMAS: Record<string, string> = {
  "pt-br": "Português (Brasil)",
  en: "English",
  es: "Espanol",
  fr: "Francais",
  de: "Deutsch",
  it: "Italiano",
  ja: "Japones",
  ko: "Coreano",
  zh: "Chines",
  ar: "Arabe",
};

function textValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-semibold  tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function LinkField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-semibold  tracking-wider text-muted-foreground">
        {label}
      </p>
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-1 text-sm text-primary hover:underline"
      >
        <span className="truncate">{value}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>
    </div>
  );
}

function aggregateField(faixas: any[], key: string): string {
  const values = faixas
    .flatMap((f) => {
      const value = f[key];
      if (Array.isArray(value)) return value;
      return String(value ?? "").split(",");
    })
    .map((value: unknown) => String(value).trim())
    .filter(Boolean);
  return [...new Set(values)].join(", ");
}

export function LancamentoViewModal({ open, onOpenChange, lancamento }: LancamentoViewModalProps) {
  // Artista principal do lançamento — busca DIRETO por ID (GET /artists/:id),
  // não depende de estar entre os primeiros 50 carregados (Task J).
  const { entity: artistaWire } = useEntityById<ArtistWireRecord>("artistas", open ? lancamento?.artist_id ?? undefined : undefined);
  const artista: Artist | undefined = artistaWire ? wireToArtist(artistaWire) : undefined;
  const { shares } = useShares();
  const { transition: workflowTransition, isPending: isTransitionPending } = useWorkflowTransition({
    table: "lancamentos",
    id: lancamento?.id ?? "",
    queryKey: ["lancamentos"],
  });

  const { data: detail } = useEntityDetail<typeof lancamento & { allowed_transitions?: WorkflowTransition[] }>(
    "lancamentos",
    lancamento?.id,
    open,
  );

  // Fallback de faixas (só usado quando metadata.faixas está vazio — releases
  // antigos) e nomes de artista por share vinculado — resolvidos por ID
  // direto via storage.findById, nunca escaneando useFonogramas()/
  // useArtistas() sem filtro (Task J).
  const fonogramaIds = useMemo(
    () => (Array.isArray(lancamento?.fonograma_ids) ? (lancamento!.fonograma_ids as string[]) : []),
    [lancamento],
  );
  const [resolvedFonogramas, setResolvedFonogramas] = useState<Record<string, FonogramaWithRelations>>({});
  useEffect(() => {
    if (!open || fonogramaIds.length === 0) return;
    let cancelled = false;
    Promise.all(fonogramaIds.map((id) => storage.findById<FonogramaWithRelations & { id: string }>("fonogramas", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, FonogramaWithRelations> = {};
        results.forEach((f, i) => { if (f) map[fonogramaIds[i]] = f; });
        setResolvedFonogramas(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, fonogramaIds]);

  const shareArtistaIds = useMemo(
    () => Array.from(new Set(shares.filter((s) => (s as Record<string, unknown>)["release_id"] === lancamento?.id && s.artist_id).map((s) => s.artist_id as string))),
    [shares, lancamento?.id],
  );
  const [resolvedShareArtistas, setResolvedShareArtistas] = useState<Record<string, Artist>>({});
  useEffect(() => {
    if (!open || shareArtistaIds.length === 0) return;
    let cancelled = false;
    Promise.all(shareArtistaIds.map((id) => storage.findById<ArtistWireRecord>("artistas", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, Artist> = {};
        results.forEach((a, i) => { if (a) map[shareArtistaIds[i]] = wireToArtist(a); });
        setResolvedShareArtistas(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, shareArtistaIds]);

  if (!lancamento) return null;

  const metadata = ((lancamento as Record<string, unknown>)["metadata"] as Record<string, unknown> | null | undefined) ?? {};
  const assets = (lancamento.assets ?? metadata["assets"] ?? {}) as Record<string, unknown>;
  const cronograma = (lancamento.cronograma ?? metadata["cronograma"] ?? {}) as Record<string, unknown>;
  const metadataFaixas = Array.isArray(metadata["faixas"]) ? (metadata["faixas"] as any[]) : [];

  const allowedTransitions = resolveAllowedTransitions(
    "release",
    detail?.status ?? lancamento.status,
    detail?.allowed_transitions,
  );
  const type = String(lancamento.type ?? "single").toLowerCase();
  const tipoInfo = TIPO_MAP[type] ?? { label: type.toUpperCase(), color: "bg-muted text-muted-foreground" };
  const capaUrl = (lancamento.capa_url as string | null | undefined) ?? textValue(assets["capa_url"]);
  const dataFormatada = formatReleaseDate(lancamento.data_lancamento);
  const idiomaRaw = lancamento.idioma ?? metadata["idioma"];
  const idioma = IDIOMAS[String(idiomaRaw ?? "")] ?? textValue(idiomaRaw);

  const faixasCatalogo = fonogramaIds
    .map((id) => resolvedFonogramas[id])
    .filter(Boolean);
  const faixas = metadataFaixas.length > 0 ? metadataFaixas : faixasCatalogo;
  const compositores = aggregateField(faixas, "compositores");
  const interpretes = aggregateField(faixas, "interpretes");
  const produtores = aggregateField(faixas, "produtores");
  const hasAssets = Object.values(assets).some(Boolean) || Boolean(capaUrl);
  const hasCronograma = Object.values(cronograma).some(Boolean);
  const hasNotes = Boolean(lancamento.observacoes || lancamento.notas_internas || metadata["observacoes"] || metadata["notas_internas"]);

  // Copyright (anos + titular)
  const copyrightAnoLancamento = textValue(metadata["copyrightDataLancamento"]);
  const copyrightAnoGravacao = textValue(metadata["copyrightDataGravacao"]);

  // Subgênero + plataformas selecionadas
  const subgenero = textValue(metadata["generoSecundario"]) ?? textValue(metadata["genero_secundario"]);
  const plataformasArr = Array.isArray(lancamento.plataformas) ? (lancamento.plataformas as string[]).filter(Boolean) : [];
  const plataformasLabel = plataformasArr.length > 0 ? plataformasArr.join(", ") : null;

  // Distribuição: interno vs plataforma (platform_status NUNCA é manual)
  const platformId = textValue(lancamento.selected_platform_id) ?? textValue(lancamento.distribuidora);
  const platformName = findDistributionPlatform(platformId)?.name ?? platformId;
  const platformStatus = resolvePlatformStatus(lancamento);
  const modoDistribuicao = platformStatus || platformId ? "Plataforma" : "Controle interno";
  const lastAttempt = formatReleaseDate(textValue(lancamento.platform_last_attempt_at));
  const lastSync = formatReleaseDate(textValue(lancamento.platform_last_sync_at));

  // Erros de plataforma
  const platformErrors: PlatformError[] = Array.isArray(lancamento.platform_errors)
    ? (lancamento.platform_errors as PlatformError[])
    : [];

  // Shares vinculados a este lançamento
  const linkedShares = shares.filter(
    (s) => (s as Record<string, unknown>)["release_id"] === lancamento.id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <VisuallyHidden>
          <DialogTitle>{lancamento.title}</DialogTitle>
        </VisuallyHidden>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-tight text-foreground">{lancamento.title}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserRound className="h-4 w-4" />
                {artista?.stageName || "Artista não vinculado"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {releaseStatusBadge(lancamento)}
              {dataFormatada && (
                <Badge variant="outline">
                  <Calendar className="mr-1 h-3.5 w-3.5" />
                  {dataFormatada}
                </Badge>
              )}
            </div>
          </div>

          {allowedTransitions.length > 0 && (
            <div className="mt-4">
              <WorkflowTransitionPanel
                currentStatus={lancamento.status ?? ""}
                allowedTransitions={allowedTransitions}
                onTransition={workflowTransition}
                isLoading={isTransitionPending}
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tipo" value={tipoInfo.label} />
            <Field label="Gênero" value={lancamento.genero ?? textValue(metadata["genero"])} />
            <Field label="Subgênero" value={subgenero} />
            <Field label="Idioma" value={idioma} />
            <Field label="Gravadora / Selo" value={lancamento.gravadora ?? textValue(metadata["gravadora"])} />
            <Field label="Plataformas selecionadas" value={plataformasLabel} />
            <Field label="ISRC Global" value={lancamento.isrc_global ?? textValue(metadata["isrc_global"])} />
            <Field label="UPC / EAN" value={lancamento.upc ?? lancamento.codigo_upc ?? textValue(metadata["upc"])} />
            <Field label="Titular do Copyright" value={lancamento.copyright ?? textValue(metadata["copyright"])} />
            <Field label="© Ano (Lançamento)" value={copyrightAnoLancamento} />
            <Field label="℗ Ano (Gravação)" value={copyrightAnoGravacao} />
          </div>
        </div>

        {/* Controle interno e Distribuição */}
        <Separator />
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground">
            Controle interno e Distribuição
          </h3>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Status:</span>
              {releaseStatusBadge(lancamento)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Distribuição:</span>
              <span className="text-foreground">{modoDistribuicao}</span>
            </div>
            {platformStatus && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Status da plataforma:</span>
                {platformStatusBadge(lancamento)}
              </div>
            )}
          </div>
          {(platformName || lastAttempt || lastSync) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Plataforma" value={platformName} />
              <Field label="Última tentativa" value={lastAttempt} />
              <Field label="Última sincronização" value={lastSync} />
            </div>
          )}
        </div>

        {platformErrors.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold tracking-wider text-rose-600">
                Erros de plataforma ({platformErrors.length})
              </h3>
              <div className="space-y-1.5">
                {platformErrors.map((err, i) => (
                  <div key={i} className="rounded-md border border-rose-300/50 bg-rose-50 px-3 py-2 text-sm">
                    <span className="font-sans text-xs text-rose-700">{err.fieldKey}</span>
                    <p className="text-rose-800">{err.message}{err.code ? ` (${err.code})` : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {(compositores || interpretes || produtores) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold  tracking-wider text-muted-foreground">
                Creditos
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Compositores" value={compositores} />
                <Field label="Interpretes" value={interpretes} />
                <Field label="Produtores" value={produtores} />
              </div>
            </div>
          </>
        )}

        {(hasAssets || hasCronograma) && (
          <>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              {hasAssets && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold  tracking-wider text-muted-foreground">
                    <LinkIcon className="h-3.5 w-3.5" />
                    Assets
                  </h3>
                  <LinkField label="Capa" value={capaUrl} />
                  <LinkField label="Áudio master" value={textValue(assets["audio_master_url"])} />
                  <LinkField label="Vídeo clipe" value={textValue(assets["video_clipe_url"])} />
                  <LinkField label="EPK" value={textValue(assets["epk_url"])} />
                  <Field label="Letra" value={textValue(assets["letra"])} />
                  <Field label="Ficha técnica" value={textValue(assets["ficha_tecnica"])} />
                  <Field label="Press release" value={textValue(assets["press_release"])} />
                </div>
              )}

              {hasCronograma && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold  tracking-wider text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Cronograma
                  </h3>
                  <Field label="Gravação" value={formatReleaseDate(textValue(cronograma["data_gravacao"]))} />
                  <Field label="Mix / master" value={formatReleaseDate(textValue(cronograma["data_mix_master"]))} />
                  <Field label="Entrega distribuidora" value={formatReleaseDate(textValue(cronograma["data_entrega_distribuidora"]))} />
                </div>
              )}
            </div>
          </>
        )}

        {hasNotes && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold  tracking-wider text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Observacoes
              </h3>
              <Field label="Notas de distribuição" value={lancamento.observacoes ?? textValue(metadata["observacoes"])} />
              <Field label="Notas internas" value={lancamento.notas_internas ?? textValue(metadata["notas_internas"])} />
            </div>
          </>
        )}

        {faixas.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold  tracking-wider text-muted-foreground">
                Faixas ({faixas.length})
              </h3>
              <div className="space-y-1">
                {faixas.map((f: any, idx) => (
                  <div
                    key={f.id ?? idx}
                    className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5"
                  >
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10">
                      <Mic2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.title || f.titulo || `Faixa ${idx + 1}`}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[f.artista, f.isrc].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                    {f.duracao && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {f.duracao}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {linkedShares.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground">
                Shares vinculados ({linkedShares.length})
              </h3>
              <div className="space-y-1">
                {linkedShares.map((s) => {
                  const sr = s as Record<string, unknown>;
                  const nome =
                    (s.artist_id ? resolvedShareArtistas[s.artist_id]?.stageName : undefined) ??
                    textValue(sr["holder"]) ??
                    textValue(sr["music_title"]) ??
                    "—";
                  const pct = s.percentage != null ? `${s.percentage}%` : "";
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                      <span className="truncate">{nome}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">{pct}</span>
                        <StatusBadge status={String(s.status ?? "")} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
