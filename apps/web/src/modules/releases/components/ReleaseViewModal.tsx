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
import type { FonogramaWithRelations } from "@/modules/catalog/hooks/usePhonograms";
import { useShares } from "@/modules/releases/hooks/useShares";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { shareStatusBadge } from "@/modules/releases/lib/share-format";
import { WorkflowTransitionPanel } from "@/shared/components/WorkflowTransitionPanel";
import { useWorkflowTransition } from "@/shared/hooks/useWorkflowTransition";
import { useEntityDetail } from "@/shared/hooks/useEntityDetail";
import { resolveAllowedTransitions, WorkflowTransition } from "@/shared/lib/workflow-transitions";
import {
  resolvePlatformStatus,
  releaseStatusBadge,
  platformStatusBadge,
} from "@/modules/releases/lib/release-status";
import { formatReleaseDate, releaseLanguageLabel, releaseTypeLabel } from "@/modules/releases/lib/release-format";
import { findDistributionPlatform } from "@/modules/releases/services/distribution-platforms";
import type { Release, PlatformError } from "@/modules/releases/types";

interface ReleaseViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release?: Release;
}

const TYPE_COLOR: Record<string, string> = {
  single: "bg-primary text-foreground",
  ep: "bg-info text-info-foreground",
  album: "bg-primary text-foreground",
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

function aggregateField(tracks: any[], key: string): string {
  const values = tracks
    .flatMap((f) => {
      const value = f[key];
      if (Array.isArray(value)) return value;
      return String(value ?? "").split(",");
    })
    .map((value: unknown) => String(value).trim())
    .filter(Boolean);
  return [...new Set(values)].join(", ");
}

export function ReleaseViewModal({ open, onOpenChange, release }: ReleaseViewModalProps) {
  // Main artist of the release — looked up DIRECTLY by ID (GET /artists/:id),
  // does not depend on being among the first 50 loaded (Task J).
  const { entity: artistWire } = useEntityById<ArtistWireRecord>("artistas", open ? release?.artist_id ?? undefined : undefined);
  const artist: Artist | undefined = artistWire ? wireToArtist(artistWire) : undefined;
  const { shares } = useShares();
  const { transition: workflowTransition, isPending: isTransitionPending } = useWorkflowTransition({
    table: "lancamentos",
    id: release?.id ?? "",
    // The releases list/paginated caches live under QUERY_KEYS.RELEASES;
    // ["lancamentos"] matched no cache, so a transition left the list stale.
    queryKey: [...QUERY_KEYS.RELEASES],
  });

  const { data: detail } = useEntityDetail<typeof release & { allowed_transitions?: WorkflowTransition[] }>(
    "lancamentos",
    release?.id,
    open,
  );

  // Track fallback (only used when metadata.faixas is empty — old
  // releases) and artist names per linked share — resolved directly by ID
  // via storage.findById, never scanning usePhonograms()/
  // useArtistas() without a filter (Task J).
  const phonogramIds = useMemo(
    () => (Array.isArray(release?.fonograma_ids) ? (release!.fonograma_ids as string[]) : []),
    [release],
  );
  const [resolvedPhonograms, setResolvedPhonograms] = useState<Record<string, FonogramaWithRelations>>({});
  useEffect(() => {
    if (!open || phonogramIds.length === 0) return;
    let cancelled = false;
    Promise.all(phonogramIds.map((id) => storage.findById<FonogramaWithRelations & { id: string }>("fonogramas", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, FonogramaWithRelations> = {};
        results.forEach((f, i) => { if (f) map[phonogramIds[i]] = f; });
        setResolvedPhonograms(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, phonogramIds]);

  const shareArtistIds = useMemo(
    () => Array.from(new Set(shares.filter((s) => (s as Record<string, unknown>)["release_id"] === release?.id && s.artist_id).map((s) => s.artist_id as string))),
    [shares, release?.id],
  );
  const [resolvedShareArtists, setResolvedShareArtists] = useState<Record<string, Artist>>({});
  useEffect(() => {
    if (!open || shareArtistIds.length === 0) return;
    let cancelled = false;
    Promise.all(shareArtistIds.map((id) => storage.findById<ArtistWireRecord>("artistas", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, Artist> = {};
        results.forEach((a, i) => { if (a) map[shareArtistIds[i]] = wireToArtist(a); });
        setResolvedShareArtists(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, shareArtistIds]);

  if (!release) return null;

  const metadata = ((release as Record<string, unknown>)["metadata"] as Record<string, unknown> | null | undefined) ?? {};
  const assets = (release.assets ?? {}) as Record<string, unknown>;
  const schedule = (release.schedule ?? {}) as Record<string, unknown>;
  const trackMetadata = Array.isArray(metadata["faixas"]) ? (metadata["faixas"] as any[]) : [];

  const allowedTransitions = resolveAllowedTransitions(
    "release",
    detail?.status ?? release.status,
    detail?.allowed_transitions,
  );
  const type = String(release.type ?? "single").toLowerCase();
  const typeInfo = { label: releaseTypeLabel(type), color: TYPE_COLOR[type] ?? "bg-muted text-muted-foreground" };
  const coverUrl = textValue(release.cover_url) ?? textValue(assets["cover_url"]);
  const formattedReleaseDate = formatReleaseDate(release.release_date);
  const languageLabel = releaseLanguageLabel(release.language);

  const catalogTracks = phonogramIds
    .map((id) => resolvedPhonograms[id])
    .filter(Boolean);
  const tracks = trackMetadata.length > 0 ? trackMetadata : catalogTracks;
  const composers = aggregateField(tracks, "compositores");
  const performers = aggregateField(tracks, "interpretes");
  const producers = aggregateField(tracks, "produtores");
  const hasAssets = Object.values(assets).some(Boolean) || Boolean(coverUrl);
  const hasSchedule = Object.values(schedule).some(Boolean);
  const hasNotes = Boolean(release.notes || release.internal_notes);

  // Copyright (years + holder)
  const copyrightReleaseYear = textValue(metadata["copyrightDataLancamento"]);
  const copyrightRecordingYear = textValue(metadata["copyrightDataGravacao"]);

  // Subgenre + selected platforms
  const subgenero = textValue(metadata["generoSecundario"]) ?? textValue(metadata["genero_secundario"]);
  const platformsArr = Array.isArray(release.platforms) ? release.platforms.filter(Boolean) : [];
  const platformsLabel = platformsArr.length > 0 ? platformsArr.join(", ") : null;

  // Distribution: internal vs platform (platform_status is NEVER manual)
  const platformId = textValue(release.selected_platform_id) ?? textValue(release.distributor);
  const platformName = findDistributionPlatform(platformId)?.name ?? platformId;
  const platformStatus = resolvePlatformStatus(release);
  const distributionMode = platformStatus || platformId ? "Plataforma" : "Controle interno";
  const lastAttempt = formatReleaseDate(textValue(release.platform_last_attempt_at));
  const lastSync = formatReleaseDate(textValue(release.platform_last_sync_at));

  // Platform errors
  const platformErrors: PlatformError[] = Array.isArray(release.platform_errors)
    ? (release.platform_errors as PlatformError[])
    : [];

  // Shares linked to this release
  const linkedShares = shares.filter(
    (s) => (s as Record<string, unknown>)["release_id"] === release.id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <VisuallyHidden>
          <DialogTitle>{release.title}</DialogTitle>
        </VisuallyHidden>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-tight text-foreground">{release.title}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserRound className="h-4 w-4" />
                {artist?.stageName || "Artista não vinculado"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {releaseStatusBadge(release)}
              {formattedReleaseDate && (
                <Badge variant="outline">
                  <Calendar className="mr-1 h-3.5 w-3.5" />
                  {formattedReleaseDate}
                </Badge>
              )}
            </div>
          </div>

          {allowedTransitions.length > 0 && (
            <div className="mt-4">
              <WorkflowTransitionPanel
                currentStatus={release.status ?? ""}
                allowedTransitions={allowedTransitions}
                onTransition={workflowTransition}
                isLoading={isTransitionPending}
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tipo" value={typeInfo.label} />
            <Field label="Gênero" value={release.music_genre ?? textValue(metadata["genero"])} />
            <Field label="Subgênero" value={subgenero} />
            <Field label="Idioma" value={languageLabel} />
            <Field label="Gravadora / Selo" value={release.record_label} />
            <Field label="Plataformas selecionadas" value={platformsLabel} />
            <Field label="ISRC Global" value={release.isrc_global ?? textValue(metadata["isrc_global"])} />
            <Field label="UPC / EAN" value={release.upc ?? release.codigo_upc ?? textValue(metadata["upc"])} />
            <Field label="Titular do Copyright" value={release.copyright ?? textValue(metadata["copyright"])} />
            <Field label="© Ano (Lançamento)" value={copyrightReleaseYear} />
            <Field label="℗ Ano (Gravação)" value={copyrightRecordingYear} />
          </div>
        </div>

        {/* Internal control and Distribution */}
        <Separator />
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground">
            Controle interno e Distribuição
          </h3>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Status:</span>
              {releaseStatusBadge(release)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Distribuição:</span>
              <span className="text-foreground">{distributionMode}</span>
            </div>
            {platformStatus && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">Status da plataforma:</span>
                {platformStatusBadge(release)}
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
              {/* Provider field keys, codes and messages are technical diagnostics — never rendered raw. */}
              <div className="rounded-md border border-rose-300/50 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                A plataforma de distribuição rejeitou {platformErrors.length === 1 ? "1 campo" : `${platformErrors.length} campos`} deste lançamento.
                Revise os metadados e tente novamente.
              </div>
            </div>
          </>
        )}

        {(composers || performers || producers) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold  tracking-wider text-muted-foreground">
                Créditos
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Compositores" value={composers} />
                <Field label="Interpretes" value={performers} />
                <Field label="Produtores" value={producers} />
              </div>
            </div>
          </>
        )}

        {(hasAssets || hasSchedule) && (
          <>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              {hasAssets && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold  tracking-wider text-muted-foreground">
                    <LinkIcon className="h-3.5 w-3.5" />
                    Arquivos
                  </h3>
                  <LinkField label="Capa" value={coverUrl} />
                  <LinkField label="Áudio master" value={textValue(assets["audio_master_url"])} />
                  <LinkField label="Vídeo clipe" value={textValue(assets["music_video_url"])} />
                  <LinkField label="EPK" value={textValue(assets["epk_url"])} />
                  <Field label="Letra" value={textValue(assets["lyrics"])} />
                  <Field label="Ficha técnica" value={textValue(assets["credits"])} />
                  <Field label="Press release" value={textValue(assets["press_release"])} />
                </div>
              )}

              {hasSchedule && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold  tracking-wider text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Cronograma
                  </h3>
                  <Field label="Gravação" value={formatReleaseDate(textValue(schedule["recording_date"]))} />
                  <Field label="Mix / master" value={formatReleaseDate(textValue(schedule["mix_master_date"]))} />
                  <Field label="Entrega distribuidora" value={formatReleaseDate(textValue(schedule["distributor_delivery_date"]))} />
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
                Observações
              </h3>
              <Field label="Notas de distribuição" value={release.notes} />
              <Field label="Notas internas" value={release.internal_notes} />
            </div>
          </>
        )}

        {tracks.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold  tracking-wider text-muted-foreground">
                Faixas ({tracks.length})
              </h3>
              <div className="space-y-1">
                {tracks.map((f: any, idx) => (
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
                    {f.duration_text && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {f.duration_text}
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
                  const name =
                    (s.artist_id ? resolvedShareArtists[s.artist_id]?.stageName : undefined) ??
                    textValue(sr["holder"]) ??
                    textValue(sr["music_title"]) ??
                    "—";
                  const pct = s.percentage != null ? `${s.percentage}%` : "";
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                      <span className="truncate">{name}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">{pct}</span>
                        {shareStatusBadge(String(s.status ?? ""))}
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
