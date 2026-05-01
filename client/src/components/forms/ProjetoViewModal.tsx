import React, { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, User, Music2, Clock, Globe, Mic, ExternalLink, FileText } from "lucide-react";

interface ProjetoViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto?: any;
}

export const ProjetoViewModal = forwardRef<HTMLDivElement, ProjetoViewModalProps>(
  function ProjetoViewModal({ open, onOpenChange, projeto }, ref) {
    if (!projeto) return null;

    const getStatusBadge = (status: string) => {
      if (status?.toLowerCase().includes("pendente")) {
        return <Badge className="bg-amber-500">{status}</Badge>;
      }
      if (status?.toLowerCase().includes("conclu") || status?.toLowerCase().includes("aprovado")) {
        return <Badge className="bg-green-600">Concluído</Badge>;
      }
      return <Badge variant="secondary">{status}</Badge>;
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
                <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                  <Play className="h-5 w-5 text-white ml-0.5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">{projeto.titulo || projeto.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(projeto.status)}
                    <Badge variant="outline">{projeto.tipo || "Single"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    📅 Cadastrado em: {projeto.created_at ? new Date(projeto.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Artista Responsável */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Artista Responsável</h3>
                </div>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="font-medium">{projeto.artistas?.nome_artistico || projeto.artista || "Não informado"}</p>
                    <p className="text-sm text-muted-foreground">Gênero: {projeto.artistas?.genero_musical || projeto.genero || "Não informado"}</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Música */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Music2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Música</h3>
                </div>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-4">
                    {/* Título e Badges */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{projeto.titulo || projeto.name}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Solo</Badge>
                        <Badge variant="outline">Original</Badge>
                      </div>
                    </div>

                    {/* Detalhes */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Duração:</span>
                        <span className="font-medium">{projeto.duracao || "00:00"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Music2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Gênero:</span>
                        <span className="font-medium">{projeto.artistas?.genero_musical || projeto.genero || "Funk"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Idioma:</span>
                        <span className="font-medium">{projeto.idioma || "Português"}</span>
                      </div>
                    </div>

                    {/* Compositores, Intérpretes, Produtores */}
                    <div className="grid grid-cols-3 gap-4 pt-2" data-testid="grid-credits">
                      <Card className="bg-background/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Music2 className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium">Compositores</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{projeto.compositores || "Não informado"}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-background/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Mic className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium">Intérpretes</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{projeto.interpretes || "Não informado"}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-background/50">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">Produtores</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{Array.isArray(projeto.produtores) ? projeto.produtores.join(", ") : projeto.produtores || "Não informado"}</p>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>

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
                      className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
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
                              <Music2 className="h-4 w-4 text-amber-500 shrink-0" />
                              <span className="text-sm font-medium truncate" data-testid={`text-obra-titulo-${obra.id}`}>
                                {obra.titulo}
                              </span>
                              {obra.status && (
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {obra.status}
                                </Badge>
                              )}
                            </div>
                            <Link
                              to={`/registro-musicas?projeto=${projeto.id}&obra=${obra.id}`}
                              className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 shrink-0"
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
