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
import type { Share, ShareHistoricoEntry } from "../types";
import { formatDate, formatCurrency } from "@/shared/lib/format-utils";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { useLancamentos } from "@/modules/releases/hooks/useLancamentos";
import type { ObraWithRelations } from "@/modules/catalog/hooks/useObras";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import {
  resolveShareType,
  shareTypeLabel,
  shareStatusBadge,
  funcaoLabel,
} from "@/modules/releases/lib/share-format";

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
  const { lancamentos } = useLancamentos();

  const s = (share ?? {}) as Share & Record<string, unknown>;
  const str = (k: string): string => (typeof s[k] === "string" ? (s[k] as string) : "");

  // Resolução DIRETA por ID (GET /works/:id, GET /artists/:id) — não depende
  // de obra/artista estarem entre os primeiros 50 carregados por
  // useObras()/useArtistas() sem filtro (Task J).
  const { entity: obraVinculada } = useEntityById<ObraWithRelations>("obras", open ? str("work_id") || undefined : undefined);
  const { entity: artistaResolvedWire } = useEntityById<ArtistWireRecord>("artistas", open ? share?.artist_id ?? undefined : undefined);
  const artistaResolved: Artist | undefined = artistaResolvedWire ? wireToArtist(artistaResolvedWire) : undefined;
  const vinculoArtistaId = str("artista_project_id") || share?.artist_id || undefined;
  const { entity: vinculoArtistaResolvedWire } = useEntityById<ArtistWireRecord>("artistas", open ? vinculoArtistaId : undefined);
  const vinculoArtistaResolved: Artist | undefined = vinculoArtistaResolvedWire ? wireToArtist(vinculoArtistaResolvedWire) : undefined;

  if (!share) return null;

  const historico: ShareHistoricoEntry[] = Array.isArray(share.historico) ? share.historico : [];
  const shareType = resolveShareType(s);
  const isInternal = shareType === "internal_release";

  /**
   * Título da obra/lançamento/música — replica EXATAMENTE a origem da tabela
   * (work_id → lançamento_id → nome_musica), com fallbacks seguros adicionais.
   */
  const pickShareTitle = (): string | null => {
    const obraTitle = obraVinculada?.title;
    const lancTitle = lancamentos.find((l) => l.id === str("release_id"))?.title;
    return (
      obraTitle ||
      lancTitle ||
      str("music_title") ||
      str("titulo_obra") ||
      str("trackTitle") ||
      str("musicTitle") ||
      str("songTitle") ||
      str("title") ||
      null
    );
  };
  const releaseTitle = pickShareTitle();

  // Participante: artista vinculado (artist_id) → holder (igual à coluna Detentor da tabela)
  const participanteNome = artistaResolved?.stageName ?? str("holder") ?? null;
  const artistaNome = artistaResolved?.stageName ?? null;
  const vinculoNome = vinculoArtistaResolved?.stageName ?? null;

  const directionLabel = str("direction") === "a_receber" ? "A Receber" : str("direction") === "a_enviar" ? "A Enviar" : null;
  const registradoEm = str("created_at") ? formatDate(str("created_at")) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-share-view">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="h-5 w-5 text-primary" />
            Detalhe do Share
            {share.versao && (
              <Badge variant="outline" className="text-[10px] font-sans ml-1">v{share.versao}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          {/* ── Tipo ─────────────────────────────────────────────────────────── */}
          <div>
            <Badge variant={isInternal ? "info" : "success"}>{shareTypeLabel(shareType)}</Badge>
          </div>

          {/* ── Dados principais ────────────────────────────────────────────── */}
          <Card className="bg-muted/30">
            <CardContent className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {isInternal ? (
                <>
                  <Field label="Lançamento / Música" value={releaseTitle} icon={Disc3} />
                  {artistaNome && <Field label="Artista" value={artistaNome} icon={User} />}
                  <Field label="Participante" value={participanteNome} icon={User} />
                  <Field label="Destinatário" value={str("recipient") || null} icon={User} />
                  <Field label="Função" value={s["type"] ? funcaoLabel(String(s["type"])) : null} icon={Share2} />
                  <Field label="Direção" value={directionLabel} />
                </>
              ) : (
                <>
                  <Field label="Música externa" value={str("music_title") || null} icon={FileText} />
                  <Field label="Artista externo" value={str("artista_externo") || null} icon={User} />
                  <Field label="Vínculo (empresa)" value={vinculoNome} icon={Building} />
                  <Field label="Pagador" value={str("pagador") || null} icon={User} />
                  <Field label="Contato do pagador" value={str("pagador_contato") || null} />
                  <Field label="Origem do acordo" value={str("origem_acordo") || null} />
                  <Field label="Data prevista" value={str("data_prevista") ? formatDate(str("data_prevista")) : null} icon={Calendar} />
                  {str("documents") && (
                    <Field
                      label="Documentos"
                      value={
                        <a href={str("documents")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
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
              {share.valor_total != null && <Field label="Valor combinado" value={formatCurrency(share.valor_total)} />}
              {share.valor_liquidado != null && <Field label="Valor liquidado" value={formatCurrency(share.valor_liquidado)} />}
              {registradoEm && <Field label="Registrado em" value={registradoEm} icon={Calendar} />}
            </CardContent>
          </Card>

          {/* ── Acordo / Documento ──────────────────────────────────────────── */}
          {(share.acordo_notas || share.acordo_url) && (
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold  tracking-wider text-muted-foreground">
                  Notas do Acordo
                </p>
                {share.acordo_notas && (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {share.acordo_notas}
                  </p>
                )}
                {share.acordo_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => window.open(share.acordo_url as string, "_blank")}
                    data-testid="btn-acordo-url"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver Documento
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Observações ─────────────────────────────────────────────────── */}
          {share.observacoes && (
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold  tracking-wider text-muted-foreground">
                  Observações adicionais
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {share.observacoes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Histórico de versões ─────────────────────────────────────────── */}
          {historico.length > 0 && (
            <div>
              <p className="text-xs font-semibold  tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico de Versões
              </p>
              <div className="space-y-2">
                {historico.slice().reverse().map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20"
                    data-testid={`historico-v${h.versao}`}
                  >
                    <div className="shrink-0">
                      <Badge variant="outline" className="font-sans text-[10px]">v{h.versao}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(h.percentage ?? h.percentual) != null && (
                          <span className="text-sm font-sans font-semibold text-primary">{h.percentage ?? h.percentual}%</span>
                        )}
                        {h.descricao && (
                          <span className="text-xs text-muted-foreground">{h.descricao}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        {h.autor && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />{h.autor}
                          </span>
                        )}
                        {h.data && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />{formatDate(h.data)}
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
