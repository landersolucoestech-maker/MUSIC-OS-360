import React, { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Play, User, Music2, Clock, Globe, Mic, ExternalLink, FileText } from "lucide-react";
import { parseMusicasFromProjeto, getMusicaInfo } from "@/modules/projects/lib/musica-helpers";
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
  function ProjectViewModal({ open, onOpenChange, projeto }, ref) {
    const { transition: workflowTransition, isPending: isTransitionPending } = useWorkflowTransition({
      table:    'projects',
      id:       projeto?.id ?? '',
      queryKey: ['projects'],
    });

    const { data: detail } = useEntityDetail<typeof projeto & { allowed_transitions?: WorkflowTransition[] }>(
      'projects', projeto?.id, open,
    );

    if (!projeto) return null;

    const allowedTransitions = resolveAllowedTransitions(
      'project',
      detail?.status ?? projeto.status,
      detail?.allowed_transitions,
    );
    const musicas = parseMusicasFromProjeto(projeto);

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
                  <h2 className="text-lg font-bold">{projeto.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(projeto.status)}
                    <Badge variant="outline">{capitalize(projeto.type) || "Single"}</Badge>
                  </div>
                  {allowedTransitions.length > 0 && (
                    <WorkflowTransitionPanel
                      currentStatus={projeto.status ?? ""}
                      allowedTransitions={allowedTransitions}
                      onTransition={workflowTransition}
                      isLoading={isTransitionPending}
                      className="mt-1.5"
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    📅 Cadastrado em: {projeto.created_at ? new Date(projeto.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Músicas */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Music2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">
                    {musicas.length > 1 ? `Músicas (${musicas.length})` : "Música"}
                  </h3>
                </div>

                {musicas.length > 0 ? (
                  <div className="space-y-4">
                    {musicas.map((musica, idx) => {
                      const info = getMusicaInfo(musica);
                      return (
                        <Card key={idx} className="bg-muted/30">
                          <CardContent className="p-4 space-y-4">
                            {/* Título e Badges */}
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium" data-testid={`text-view-musica-nome-${idx}`}>
                                {musicas.length > 1 ? `${idx + 1}. ` : ""}{info.nome || projeto.title}
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

                            {/* Duração, Gênero, Idioma */}
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                  <span className="text-muted-foreground text-xs block">Duração</span>
                                  <span className="font-medium" data-testid={`text-view-duracao-${idx}`}>{info.duracao || "—"}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                  <span className="text-muted-foreground text-xs block">Gênero</span>
                                  <span className="font-medium" data-testid={`text-view-genero-${idx}`}>{info.genero ? capitalize(info.genero) : "—"}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                  <span className="text-muted-foreground text-xs block">Idioma</span>
                                  <span className="font-medium" data-testid={`text-view-idioma-${idx}`}>{info.idioma ? capitalize(info.idioma) : "—"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Compositores, Intérpretes, Produtores */}
                            <div className="grid grid-cols-3 gap-3" data-testid="grid-credits">
                              <Card className="bg-background/50">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Music2 className="h-3.5 w-3.5 text-warning" />
                                    <span className="text-xs font-medium">Compositores</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-view-compositores-${idx}`}>
                                    {info.compositores || "—"}
                                  </p>
                                </CardContent>
                              </Card>
                              <Card className="bg-background/50">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Mic className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-xs font-medium">Intérpretes</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-view-interpretes-${idx}`}>
                                    {info.interpretes || "—"}
                                  </p>
                                </CardContent>
                              </Card>
                              <Card className="bg-background/50">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <User className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="text-xs font-medium">Produtores</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground" data-testid={`text-view-produtores-${idx}`}>
                                    {info.produtores || "—"}
                                  </p>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Letra — exibida apenas quando preenchida */}
                            {info.letra && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground block mb-1">Letra</span>
                                <div className="bg-background/50 rounded-md p-3 max-h-40 overflow-y-auto">
                                  <p className="text-sm whitespace-pre-wrap" data-testid={`text-view-letra-${idx}`}>{info.letra}</p>
                                </div>
                              </div>
                            )}

                            {/* Áudio — exibido apenas quando há link cadastrado */}
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
                      {/* Fallback para projetos sem descricao JSON */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium">{projeto.title}</h4>
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

              {/* Observações — exibidas apenas quando preenchidas */}
              {projeto.observacoes && (
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
                          {projeto.observacoes}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              <Separator />

              {/* Obras Vinculadas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Obras Vinculadas</h3>
                    <Badge variant="secondary" data-testid="badge-obras-total">
                      {Array.isArray(projeto.obras) ? projeto.obras.length : 0}
                    </Badge>
                  </div>
                  {Array.isArray(projeto.obras) && projeto.obras.length > 0 && (
                    <Link
                      to={`/registro-musicas?projeto=${projeto.id}`}
                      className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                      onClick={() => onOpenChange(false)}
                      data-testid="link-ver-todas-obras"
                    >
                      Ver todas <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                {Array.isArray(projeto.obras) && projeto.obras.length > 0 ? (
                  <Card className="bg-muted/30">
                    <CardContent className="p-2">
                      <ul className="divide-y divide-border">
                        {projeto.obras.map((obra: any) => (
                          <li
                            key={obra.id}
                            className="flex items-center justify-between gap-2 px-2 py-2"
                            data-testid={`row-obra-${obra.id}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Music2 className="h-4 w-4 text-warning shrink-0" />
                              <span className="text-sm font-medium truncate" data-testid={`text-obra-title-${obra.id}`}>
                                {obra.title}
                              </span>
                              {obra.status && (
                                <Badge variant="outline" className="text-[10px] ">
                                  {obra.status}
                                </Badge>
                              )}
                            </div>
                            <Link
                              to={`/registro-musicas?projeto=${projeto.id}&obra=${obra.id}`}
                              className="text-xs text-destructive hover:underline inline-flex items-center gap-1 shrink-0"
                              onClick={() => onOpenChange(false)}
                              data-testid={`link-obra-${obra.id}`}
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

