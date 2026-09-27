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
import { WorkTypeBadge } from "@/modules/catalog/components/ObraFormModal";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import type { ObraWithRelations } from "@/modules/catalog/hooks/useObras";
import {
  workOtherTitles,
  workRelatedReferences,
  workFullLyrics,
  workCreatedByAi,
  workTypeAiValue,
  workAiHarmony,
  workAiMelody,
  workAiLyrics,
  workToParticipants,
  exportInstrumental,
  parseDurationText,
} from "@/modules/catalog/mappers";

interface WorkViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: any;
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
  return <Badge variant="secondary">{status ?? "—"}</Badge>;
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
  obra: workProp,
}: WorkViewModalProps) {
  // Fetches DIRECTLY by ID (GET /works/:id) — does not depend on the work being among
  // the first loaded records (Task J: it used to use an unfiltered useObras(),
  // which truncated at 50 works per tenant).
  const { entity: fresh } = useEntityById<ObraWithRelations>("obras", open ? workProp?.id : undefined);
  if (!workProp) return null;

  const work: any = fresh ? { ...workProp, ...fresh } : workProp;

  const outrosTitulos    = workOtherTitles(work);
  const referenciasConexas = workRelatedReferences(work);
  const fullLyrics    = workFullLyrics(work);
  const criadaPorIA      = workCreatedByAi(work) === "sim";
  const aiType           = workTypeAiValue(work);
  const iaHarmonia       = workAiHarmony(work);
  const iaMelodia        = workAiMelody(work);
  const aiLyrics          = workAiLyrics(work);
  const participantes    = workToParticipants(work);
  const instrumental     =
    exportInstrumental(work as Record<string, unknown>) === "Sim";

  const dur = parseDurationText(work.duration_text);
  const durationDisplay =
    dur.min || dur.seg
      ? `${dur.min || "0"}min ${dur.seg || "0"}seg`
      : work.duration_text || null;

  const artistName   = work.artistas?.nome_artistico ?? null;
  const projectTitle = work.projetos?.title ?? null;

  const iaElementos = [
    iaHarmonia.ferramenta || iaHarmonia.prompt ? "Harmonia" : null,
    iaMelodia.ferramenta  || iaMelodia.prompt  ? "Melodia"  : null,
    aiLyrics.ferramenta    || aiLyrics.prompt     ? "Letra"    : null,
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
                  <StatusBadge status={work.status} />
                  <WorkTypeBadge type={work.tipo_obra} />
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
                <InfoField label="Idioma"  value={work.idioma} />
                <InfoField label="Duração" value={durationDisplay} />
                <SwitchField label="Instrumental" value={instrumental} />
              </div>
            </div>

            {/* Registration codes — shown only when there is some code */}
            {(work.cod_entidade || work.cod_ecad || work.isrc || work.iswc) && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Códigos de Registro</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    {work.cod_entidade && <MonoField label="Código de Cadastro da Sociedade" value={work.cod_entidade} />}
                    {work.cod_ecad && <MonoField label="Código ECAD" value={work.cod_ecad} />}
                    {work.isrc && <MonoField label="ISRC" value={work.isrc} />}
                    {work.iswc && <MonoField label="ISWC" value={work.iswc} />}
                  </div>
                </div>
              </>
            )}

            {/* Participants (name, role, %, link) */}
            {participantes.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>
                    Participantes (Nome, Função, %, Link)
                  </SectionTitle>
                  <div className="space-y-1">
                    {participantes.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-b-0 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-foreground block">
                            {p.name || "—"}
                          </span>
                          {p.link && (
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate block"
                            >
                              {p.link}
                            </a>
                          )}
                        </div>
                        {p.classeFuncao && (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal shrink-0"
                          >
                            {p.classeFuncao}
                          </Badge>
                        )}
                        {p.percentual && (
                          <span className="text-muted-foreground w-12 text-right shrink-0">
                            {p.percentual}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Artificial intelligence */}
            {criadaPorIA && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Inteligência Artificial</SectionTitle>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-3">
                    <SwitchField label="Criada por IA"    value={criadaPorIA} />
                    <InfoField   label="Tipo de Geração IA" value={aiType || null} />
                  </div>
                  {iaElementos.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">
                        Elementos IA: {iaElementos.join(", ")}
                      </p>
                      {(iaHarmonia.ferramenta || iaHarmonia.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Harmonia
                          </p>
                          {iaHarmonia.ferramenta && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {iaHarmonia.ferramenta}
                            </p>
                          )}
                          {iaHarmonia.prompt && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {iaHarmonia.prompt}
                            </p>
                          )}
                        </div>
                      )}
                      {(iaMelodia.ferramenta || iaMelodia.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Melodia
                          </p>
                          {iaMelodia.ferramenta && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {iaMelodia.ferramenta}
                            </p>
                          )}
                          {iaMelodia.prompt && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {iaMelodia.prompt}
                            </p>
                          )}
                        </div>
                      )}
                      {(aiLyrics.ferramenta || aiLyrics.prompt) && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Letra (IA)
                          </p>
                          {aiLyrics.ferramenta && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">
                                Ferramenta:{" "}
                              </span>
                              {aiLyrics.ferramenta}
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
            {outrosTitulos.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Outros Títulos</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {outrosTitulos.map((t, i) => (
                      <Badge key={i} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Connected references */}
            {referenciasConexas.length > 0 && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Referências Conectadas</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {referenciasConexas.map((r, i) => (
                      <Badge key={i} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Lyrics */}
            {fullLyrics && (
              <>
                <Separator />
                <div>
                  <SectionTitle>Letra</SectionTitle>
                  <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                    {fullLyrics}
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

