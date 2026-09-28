import React, { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Play, User, Music2, Clock, Globe, Mic, ExternalLink, FileText } from "lucide-react";
import { parseTracksFromProject, getTrackInfo } from "@/modules/projects/lib/track-helpers";
import { WorkflowTransitionPanel } from "@/shared/components/WorkflowTransitionPanel";
import { useWorkflowTransition } from "@/shared/hooks/useWorkflowTransition";
import { useEntityDetail } from "@/shared/hooks/useEntityDetail";
import { resolveAllowedTransitions, WorkflowTransition } from "@/shared/lib/workflow-transitions";

interface ProjectViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto?: any;
}

const soloFeatLabel: Record<string, string> = { solo: "Solo", feat: "Feat" };
const originalRemixLabel: Record<string, string> = { original: "Original", remix: "Remix" };
const instrumentalLabel: Record<string, string> = { sim: "Instrumental", nao: "Com Letra" };

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ProjectViewModal = forwardRef<HTMLDivElement, ProjectViewModalProps>(
  function ProjectViewModal({ open, onOpenChange, projeto: project }, ref) {
    const { transition: workflowTransition, isPending: isTransitionPending } = useWorkflowTransition({
      table:    'projects',
      id:       project?.id ?? '',
      queryKey: ['projects'],
    });

    const { data: detail } = useEntityDetail<typeof project & { allowed_transitions?: WorkflowTransition[] }>(
      'projects', project?.id, open,
    );

    if (!project) return null;

    const allowedTransitions = resolveAllowedTransitions(
      'project',
      detail?.status ?? project.status,
      detail?.allowed_transitions,
    );
    const tracks = parseTracksFromProject(project);

    const getStatusBadge = (status: string) => {
      if (status?.toLowerCase().includes("pendente") || status === "planning") {
        return <Badge variant="warning">Registro Pendente</Badge>;
      }
      if (status === "completed" || status?.toLowerCase().includes("conclu")) {
        return <Badge variant="success">Concluído</Badge>;
      }
      if (status === "in_progress") {
        return <Badge variant="info">Em Andamento</Badge>;
      }
      if (status === "cancelled") {
        return <Badge variant="danger">Cancelado</Badge>;
      }
      return <Badge variant="neutral">{status}</Badge>;
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref} className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Detalhes do Projeto</DialogTitle>
            <DialogDescription>Informações completas do projeto musical</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="px-6 pb-6 space-y-6">
              {/* Header do Projeto */}
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Play className="h-5 w-5 text-foreground ml-0.5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">{project.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(project.status)}
                    <Badge variant="outline">{capitalize(project.type) || "Single"}</Badge>
                  </div>
                  {allowedTransitions.length > 0 && (
                    <WorkflowTransitionPanel
                      currentStatus={project.status ?? ""}
                      allowedTransitions={allowedTransitions}
                      onTransition={workflowTransition}
                      isLoading={isTransitionPending}
                      className="mt-1.5"
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    📅 Cadastrado em: {project.created_at ? new Date(project.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Songs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Music2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">
                    {tracks.length > 1 ? `Músicas (${tracks.length})` : "Música"}
                  </h3>
                </div>

                {tracks.length > 0 ? (
                  <div className="space-y-4">
                    {tracks.map((track, idx) => {
                      const info = getTrackInfo(track);
                      return (
                        <Card key={idx} className="bg-muted/30">
                          <CardContent className="p-4 space-y-4">
                            {/* Title and badges */}
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium" data-testid={`text-view-musica-nome-${idx}`}>
                                {tracks.length > 1 ? `${idx + 1}. ` : ""}{info.name || project.title}
                              </h4>
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                <Badge variant="outline" className="text-xs">
                                  {soloFeatLabel[info.soloFeat] || capitalize(info.soloFeat) || "Solo"}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {originalRemixLabel[info.originalRemix] || capitalize(info.originalRemix) || "Original"}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {instrumentalLabel[info.instrumental] || capitalize(info.instrumental) || "Com Letra"}
                                </Badge>
                              </div>
                            </div>

                            {/* Duration, genre, language */}
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                  <span className="text-muted-foreground text-xs block">Duração</span>
                                  <span className="font-medium" data-testid={`text-view-duration-${idx}`}>{info.duration || "—"}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                  <span className="text-muted-foreground text-xs block">Gênero</span>
                                  <span className="font-medium" data-testid={`text-view-genre-${idx}`}>{info.genre ? capitalize(info.genre) : "—"}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                  <span className="text-muted-foreground text-xs block">Idioma</span>
                                  <span className="font-medium" data-testid={`text-view-language-${idx}`}>{info.language ? capitalize(info.language) : "—"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Composers, performers, producers */}
                            <div className="grid grid-cols-3 gap-3" data-testid="grid-credits">
                              <Card className="bg-background/50">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Music2 className="h-3.5 w-3.5 text-warning" />
                                    <span className="text-xs font-medium">Compositores</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-view-composers-${idx}`}>
                                    {info.composers || "—"}
                                  </p>
                                </CardContent>
                              </Card>
                              <Card className="bg-background/50">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Mic className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-xs font-medium">Intérpretes</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-view-performers-${idx}`}>
                                    {info.performers || "—"}
                                  </p>
                                </CardContent>
                              </Card>
                              <Card className="bg-background/50">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <User className="h-3.5 w-3.5 text-info" />
                                    <span className="text-xs font-medium">Produtores</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-view-producers-${idx}`}>
                                    {info.producers || "—"}
                                  </p>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Lyrics — shown only when filled in */}
                            {info.lyrics && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground block mb-1">Letra</span>
                                <div className="bg-background/50 rounded-md p-3 max-h-40 overflow-y-auto">
                                  <p className="text-sm whitespace-pre-wrap" data-testid={`text-view-lyrics-${idx}`}>{info.lyrics}</p>
                                </div>
                              </div>
                            )}

                            {/* Audio — shown only when a link is registered */}
                            {info.audioUrl && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground block mb-1">Áudio</span>
                                <a
                                  href={info.audioUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                  data-testid={`link-view-audio-${idx}`}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Ouvir / baixar áudio
                                </a>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4 space-y-4">
                      {/* Fallback for projects without a JSON descricao */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium">{project.title}</h4>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">Solo</Badge>
                          <Badge variant="outline" className="text-xs">Original</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Detalhes da música não disponíveis.</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Notes — shown only when filled in */}
              {project.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">Observações</h3>
                    </div>
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <p className="text-sm whitespace-pre-wrap" data-testid="text-view-observacoes">
                          {project.notes}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              <Separator />

              {/* Linked works */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Obras Vinculadas</h3>
                    <Badge variant="secondary" data-testid="badge-obras-total">
                      {Array.isArray(project.obras) ? project.obras.length : 0}
                    </Badge>
                  </div>
                  {Array.isArray(project.obras) && project.obras.length > 0 && (
                    <Link
                      to={`/music-registration?project=${project.id}`}
                      className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                      onClick={() => onOpenChange(false)}
                      data-testid="link-ver-todas-obras"
                    >
                      Ver todas <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                {Array.isArray(project.obras) && project.obras.length > 0 ? (
                  <Card className="bg-muted/30">
                    <CardContent className="p-2">
                      <ul className="divide-y divide-border">
                        {project.obras.map((work: any) => (
                          <li
                            key={work.id}
                            className="flex items-center justify-between gap-2 px-2 py-2"
                            data-testid={`row-obra-${work.id}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Music2 className="h-4 w-4 text-warning shrink-0" />
                              <span className="text-sm font-medium truncate" data-testid={`text-obra-title-${work.id}`}>
                                {work.title}
                              </span>
                              {work.status && (
                                <Badge variant="outline" className="text-[10px] ">
                                  {work.status}
                                </Badge>
                              )}
                            </div>
                            <Link
                              to={`/music-registration?project=${project.id}&work=${work.id}`}
                              className="text-xs text-destructive hover:underline inline-flex items-center gap-1 shrink-0"
                              onClick={() => onOpenChange(false)}
                              data-testid={`link-obra-${work.id}`}
                            >
                              Abrir <ExternalLink className="h-3 w-3" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground" data-testid="text-no-obras">
                        Nenhuma obra vinculada a este projeto ainda.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }
);

