import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Switch } from "@/shared/ui/switch";
import { Music } from "lucide-react";
import { WorkOriginBadge } from "@/modules/catalog/components/WorkOriginBadge";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import type { Work, WorkWithRelations } from "@/modules/catalog/types/catalog.types";
import {
  WORK_AI_USAGE_LEVEL_LABELS,
  workLanguageLabel,
  workParticipantRoleLabel,
} from "@/modules/catalog/constants/work-options";
import { statusLabelPtBr } from "@music-os-360/types";
import {
  workAlternativeTitles,
  workRelatedReferences,
  workLyrics,
  workAiUsed,
  workAiUsageLevel,
  workAiHarmony,
  workAiMelody,
  workAiLyrics,
  workToParticipants,
  workIsInstrumental,
  parseDurationText,
} from "@/modules/catalog/mappers";
import { safeHref } from "@/shared/lib/safe-url";

interface WorkViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  work?: Partial<Work> | null;
}

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase() ?? "";
  if (s === "registered")
    return <Badge variant="success">Registrado</Badge>;
  if (s === "under_review" || s === "in_review")
    return <Badge variant="warning">Em Análise</Badge>;
  if (s === "pending")
    return <Badge variant="warning">Pendente</Badge>;
  if (s === "rejected")
    return <Badge variant="danger">Rejeitado</Badge>;
  return <Badge variant="secondary">{statusLabelPtBr("work", s) ?? "Status não reconhecido"}</Badge>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-3">
      {children}
    </p>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function MonoField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-sans text-sm font-medium text-primary">
        {value || "—"}
      </p>
    </div>
  );
}

function SwitchField({ label, value }: { label: string; value: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center h-9">
        <Switch checked={value} disabled />
      </div>
    </div>
  );
}

export function WorkViewModal({
  open,
  onOpenChange,
  work: workProp,
}: WorkViewModalProps) {
  // Fetches DIRECTLY by ID (GET /works/:id) — does not depend on the work being among
  // the first loaded records (Task J: it used to use an unfiltered useWorks(),
  // which truncated at 50 works per tenant).
  const { entity: fresh } = useEntityById<WorkWithRelations>("works", open ? workProp?.id : undefined);
  // GET /works/:id returns only artist_id/project_id (no embedded relations):
  // the linked artist and project are resolved by id.
  const linkedArtistId = open ? (fresh?.artist_id ?? workProp?.artist_id ?? undefined) : undefined;
  const linkedProjectId = open ? (fresh?.project_id ?? workProp?.project_id ?? undefined) : undefined;
  const { entity: linkedArtist } = useEntityById<{ stage_name?: string | null }>("artists", linkedArtistId);
  const { entity: linkedProject } = useEntityById<{ title?: string | null }>("projects", linkedProjectId);
  if (!workProp) return null;

  const work: Partial<WorkWithRelations> = fresh ? { ...workProp, ...fresh } : workProp;

  const alternativeTitles = workAlternativeTitles(work);
  const relatedReferences = workRelatedReferences(work);
  const lyrics            = workLyrics(work);
  const aiUsed            = workAiUsed(work);
  const aiUsageLevel      = workAiUsageLevel(work);
  const aiHarmony         = workAiHarmony(work);
  const aiMelody          = workAiMelody(work);
  const aiLyrics          = workAiLyrics(work);
  const participants      = workToParticipants(work);
  const isInstrumental    = workIsInstrumental(work);

  const dur = parseDurationText(work.duration_text);
  const durationDisplay =
    dur.minutes || dur.seconds
      ? `${dur.minutes || "0"}min ${dur.seconds || "0"}seg`
      : work.duration_text || null;

  const artistName   = linkedArtist?.stage_name || null;
  const projectTitle = linkedProject?.title || null;

  const aiElementLabels = [
    aiHarmony.tool || aiHarmony.prompt ? "Harmonia" : null,
    aiMelody.tool  || aiMelody.prompt  ? "Melodia"  : null,
    aiLyrics.tool  || aiLyrics.prompt  ? "Letra"    : null,
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Detalhes da Obra</DialogTitle>
          <DialogDescription>Informações completas da obra musical</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 pb-6 space-y-6">

            {/* Work header */}
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Music className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{work.title || "—"}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={work.status ?? undefined} />
                  <WorkOriginBadge origin={work.work_origin} />
                </div>
                {work.created_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📅 Cadastrado em: {new Date(work.created_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>

            {/* Linked project — shown only when there is a link */}
            {(artistName || projectTitle) && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Projeto Vinculado</SectionTitle>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {projectTitle && <InfoField label="Projeto" value={projectTitle} />}
                    {artistName && <InfoField label="Artista do Projeto" value={artistName} />}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* General information */}
            <div>
              <SectionTitle>Informações Gerais</SectionTitle>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoField label="Gênero"  value={work.music_genre} />
                <InfoField label="Idioma"  value={workLanguageLabel(work.language)} />
                <InfoField label="Duração" value={durationDisplay} />
                <SwitchField label="Instrumental" value={isInstrumental} />
              </div>
            </div>

            {/* Registration codes — shown only when there is some code */}
            {(work.society_code || work.ecad_code || work.isrc || work.iswc) && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Códigos de Registro</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    {work.society_code && <MonoField label="Código de Cadastro da Sociedade" value={work.society_code} />}
                    {work.ecad_code && <MonoField label="Código ECAD" value={work.ecad_code} />}
                    {work.isrc && <MonoField label="ISRC" value={work.isrc} />}
                    {work.iswc && <MonoField label="ISWC" value={work.iswc} />}
                  </div>
                </div>
              </>
            )}

            {/* Participants (name, role, %, link) */}
            {participants.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>
                    Participantes (Nome, Função, %, Link)
                  </SectionTitle>
                  <div className="space-y-1">
                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-b-0 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground block">
                            {p.name || "—"}
                          </span>
                          {p.link && (safeHref(p.link) ? (
                            <a
                              href={safeHref(p.link)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate block"
                            >
                              {p.link}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground truncate block">{p.link}</span>
                          ))}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs font-normal shrink-0"
                          data-testid={`badge-participant-role-${p.id}`}
                        >
                          {workParticipantRoleLabel(p.role)}
                        </Badge>
                        {p.percentage && (
                          <span className="text-muted-foreground w-12 text-right shrink-0">
                            {p.percentage}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Artificial intelligence */}
            {aiUsed && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Inteligência Artificial</SectionTitle>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-3">
                    <SwitchField label="Criada por IA"    value={aiUsed} />
                    <InfoField   label="Tipo de Geração IA" value={aiUsageLevel ? WORK_AI_USAGE_LEVEL_LABELS[aiUsageLevel] : null} />
                  </div>
                  {aiElementLabels.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">
                        Elementos IA: {aiElementLabels.join(", ")}
                      </p>
                      {(aiHarmony.tool || aiHarmony.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Harmonia
                          </p>
                          {aiHarmony.tool && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {aiHarmony.tool}
                            </p>
                          )}
                          {aiHarmony.prompt && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {aiHarmony.prompt}
                            </p>
                          )}
                        </div>
                      )}
                      {(aiMelody.tool || aiMelody.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Melodia
                          </p>
                          {aiMelody.tool && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {aiMelody.tool}
                            </p>
                          )}
                          {aiMelody.prompt && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {aiMelody.prompt}
                            </p>
                          )}
                        </div>
                      )}
                      {(aiLyrics.tool || aiLyrics.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Letra (IA)
                          </p>
                          {aiLyrics.tool && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {aiLyrics.tool}
                            </p>
                          )}
                          {aiLyrics.prompt && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {aiLyrics.prompt}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Other titles */}
            {alternativeTitles.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Outros Títulos</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {alternativeTitles.map((t, i) => (
                      <Badge key={i} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Connected references */}
            {relatedReferences.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Referências Conectadas</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {relatedReferences.map((r, i) => (
                      <Badge key={i} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Lyrics */}
            {lyrics && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Letra</SectionTitle>
                  <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                    {lyrics}
                  </pre>
                </div>
              </>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

