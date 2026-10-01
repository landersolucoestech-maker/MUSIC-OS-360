import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import {
  Share2, User, Percent, ExternalLink, FileText,
  Clock, History, Building, Calendar, Disc3,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { Share, ShareHistoryEntry } from "../types";
import { formatDate, formatCurrency } from "@/shared/lib/format-utils";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { useReleases } from "@/modules/releases/hooks/useReleases";
import type { ObraWithRelations } from "@/modules/catalog/hooks/useWorks";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import {
  resolveShareType,
  shareTypeLabel,
  shareStatusBadge,
  shareFunctionLabel,
  SHARE_DIRECTION_LABELS,
} from "@/modules/releases/lib/share-format";
import { StoredFileLink } from "@/shared/components/StoredFileLink";
import { openStoredFile } from "@/shared/lib/stored-file";
import { toast } from "sonner";

interface ShareViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share?: Share | null;
}

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <div className="text-sm font-medium text-foreground">
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );
}

export function ShareViewModal({ open, onOpenChange, share }: ShareViewModalProps) {
  const { releases } = useReleases();

  const s = (share ?? {}) as Share & Record<string, unknown>;
  const str = (k: string): string => (typeof s[k] === "string" ? (s[k] as string) : "");

  // DIRECT resolution by ID (GET /works/:id, GET /artists/:id) — does not depend
  // on the work/artist being among the first 50 loaded by
  // useWorks()/useArtistas() without a filter (Task J).
  const { entity: linkedWork } = useEntityById<ObraWithRelations>("works", open ? str("work_id") || undefined : undefined);
  const { entity: artistResolvedWire } = useEntityById<ArtistWireRecord>("artists", open ? share?.artist_id ?? undefined : undefined);
  const artistResolved: Artist | undefined = artistResolvedWire ? wireToArtist(artistResolvedWire) : undefined;
  const linkedArtistId = share?.artist_id || undefined;
  const { entity: linkedArtistResolvedWire } = useEntityById<ArtistWireRecord>("artists", open ? linkedArtistId : undefined);
  const linkedArtistResolved: Artist | undefined = linkedArtistResolvedWire ? wireToArtist(linkedArtistResolvedWire) : undefined;

  if (!share) return null;

  const history: ShareHistoryEntry[] = Array.isArray(share.history) ? share.history : [];
  const shareType = resolveShareType(s);
  const isInternal = shareType === "internal_release";

  /**
   * Work/release/song title — mirrors EXACTLY the table's source
   * (work_id → lançamento_id → nome_musica), with additional safe fallbacks.
   */
  const pickShareTitle = (): string | null => {
    const workTitle = linkedWork?.title;
    const releaseTitle = releases.find((l) => l.id === str("release_id"))?.title;
    return (
      workTitle ||
      releaseTitle ||
      str("music_title") ||
      str("trackTitle") ||
      str("musicTitle") ||
      str("songTitle") ||
      str("title") ||
      null
    );
  };
  const releaseTitle = pickShareTitle();

  // Participant: linked artist (artist_id) → holder (same as the table's Holder column)
  const participantName = artistResolved?.stageName ?? str("holder") ?? null;
  const artistName = artistResolved?.stageName ?? null;
  const linkedName = linkedArtistResolved?.stageName ?? null;

  const directionLabel = SHARE_DIRECTION_LABELS[str("direction") ?? ""] ?? null;
  const registeredAt = str("created_at") ? formatDate(str("created_at")) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-share-view">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="h-5 w-5 text-primary" />
            Detalhe do Share
            {share.version && (
              <Badge variant="outline" className="text-[10px] font-sans ml-1">v{share.version}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          {/* ── Type ─────────────────────────────────────────────────────────── */}
          <div>
            <Badge variant={isInternal ? "info" : "success"}>{shareTypeLabel(shareType)}</Badge>
          </div>

          {/* ── Main data ────────────────────────────────────────────── */}
          <Card className="bg-muted/30">
            <CardContent className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {isInternal ? (
                <>
                  <Field label="Lançamento / Música" value={releaseTitle} icon={Disc3} />
                  {artistName && <Field label="Artista" value={artistName} icon={User} />}
                  <Field label="Participante" value={participantName} icon={User} />
                  <Field label="Destinatário" value={str("recipient") || null} icon={User} />
                  <Field label="Função" value={s["type"] ? shareFunctionLabel(String(s["type"])) : null} icon={Share2} />
                  <Field label="Direção" value={directionLabel} />
                </>
              ) : (
                <>
                  <Field label="Música externa" value={str("music_title") || null} icon={FileText} />
                  <Field label="Artista externo" value={str("external_artist_name") || null} icon={User} />
                  <Field label="Vínculo (empresa)" value={linkedName} icon={Building} />
                  <Field label="Pagador" value={str("payer") || null} icon={User} />
                  <Field label="Contato do pagador" value={str("payer_contact") || null} />
                  <Field label="Origem do acordo" value={str("agreement_source") || null} />
                  <Field label="Data prevista" value={str("expected_at") ? formatDate(str("expected_at")) : null} icon={Calendar} />
                  {str("documents") && (
                    <Field
                      label="Documentos"
                      value={
                        <StoredFileLink url={str("documents")} className="inline-flex items-center gap-1 text-primary hover:underline">
                          Abrir <ExternalLink className="h-3 w-3" />
                        </StoredFileLink>
                      }
                    />
                  )}
                </>
              )}

              <Field
                label="% Share"
                value={
                  share.percentage != null ? (
                    <span className="font-sans text-primary font-semibold flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      {share.percentage}%
                    </span>
                  ) : null
                }
              />
              <Field label="Status" value={shareStatusBadge(share.status)} />
              <Field label="Tipo" value={shareTypeLabel(shareType)} />
              {share.total_amount != null && <Field label="Valor combinado" value={formatCurrency(share.total_amount)} />}
              {share.settled_amount != null && <Field label="Valor liquidado" value={formatCurrency(share.settled_amount)} />}
              {registeredAt && <Field label="Registrado em" value={registeredAt} icon={Calendar} />}
            </CardContent>
          </Card>

          {/* ── Agreement / Document ──────────────────────────────────────────── */}
          {(share.agreement_notes || share.agreement_url) && (
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold  tracking-wider text-muted-foreground">
                  Notas do Acordo
                </p>
                {share.agreement_notes && (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {share.agreement_notes}
                  </p>
                )}
                {share.agreement_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => { openStoredFile(share.agreement_url as string).catch(() => toast.error("Não foi possível abrir o arquivo.")); }}
                    data-testid="btn-agreement-url"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver Documento
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Notes ─────────────────────────────────────────────────── */}
          {share.notes && (
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold  tracking-wider text-muted-foreground">
                  Observações adicionais
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {share.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Version history ─────────────────────────────────────────── */}
          {history.length > 0 && (
            <div>
              <p className="text-xs font-semibold  tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico de Versões
              </p>
              <div className="space-y-2">
                {history.slice().reverse().map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20"
                    data-testid={`history-v${h.version}`}
                  >
                    <div className="shrink-0">
                      <Badge variant="outline" className="font-sans text-[10px]">v{h.version}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(h.percentage ?? h.percentual) != null && (
                          <span className="text-sm font-sans font-semibold text-primary">{h.percentage ?? h.percentual}%</span>
                        )}
                        {h.description && (
                          <span className="text-xs text-muted-foreground">{h.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        {h.author && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />{h.author}
                          </span>
                        )}
                        {h.date && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />{formatDate(h.date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
