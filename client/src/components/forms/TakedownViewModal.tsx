import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Link2, Music, Calendar, FileText, ExternalLink } from "lucide-react";

interface TakedownViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  takedown?: any;
}

export function TakedownViewModal({ open, onOpenChange, takedown }: TakedownViewModalProps) {
  if (!takedown) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Resolvido": return <Badge className="bg-green-600">{status}</Badge>;
      case "Pendente": return <Badge className="bg-amber-500">{status}</Badge>;
      case "Em Análise": return <Badge className="bg-blue-500">{status}</Badge>;
      case "Rejeitado": return <Badge className="bg-red-600">{status}</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    return tipo === "Enviado" 
      ? <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">{tipo}</Badge>
      : <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">{tipo}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Detalhes do Takedown
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Takedown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Informações do Takedown
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Título/Identificação</span>
                <p className="font-medium">{takedown.titulo || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Status</span>
                <div className="mt-1">{getStatusBadge(takedown.status)}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Tipo</span>
                <div className="mt-1">{getTipoBadge(takedown.tipo)}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Prioridade</span>
                <p className="font-medium capitalize">{takedown.prioridade || "Média"}</p>
              </div>
            </div>
          </div>

          {/* Obra e Artista */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Music className="h-4 w-4" /> Obra Afetada
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Obra</span>
                <p className="font-medium">{takedown.obraAfetada || takedown.titulo || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Artista</span>
                <p className="font-medium">{takedown.artista || "—"}</p>
              </div>
            </div>
          </div>

          {/* Plataforma e URL */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Plataforma e Localização
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Plataforma</span>
                <div className="mt-1">
                  <Badge variant="outline">{takedown.plataforma}</Badge>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data de Identificação
                </span>
                <p className="font-medium">{takedown.data || takedown.dataIdentificacao || "—"}</p>
              </div>
            </div>
            {takedown.url && (
              <div>
                <span className="text-sm text-muted-foreground">URL do Conteúdo</span>
                <a 
                  href={takedown.url.startsWith("http") ? takedown.url : `https://${takedown.url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  {takedown.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Motivo */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Motivo e Descrição
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Motivo</span>
                <p className="font-medium">{takedown.motivo || "—"}</p>
              </div>
              {takedown.descricao && (
                <div>
                  <span className="text-sm text-muted-foreground">Descrição Detalhada</span>
                  <p className="text-sm bg-muted/30 p-3 rounded-lg mt-1">{takedown.descricao}</p>
                </div>
              )}
            </div>
          </div>

          {/* Evidências */}
          {takedown.evidencias && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Evidências/Links de Prova</span>
              <p className="text-sm bg-muted/30 p-3 rounded-lg">{takedown.evidencias}</p>
            </div>
          )}

          {/* Observações */}
          {takedown.observacoes && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Observações</span>
              <p className="text-sm bg-muted/30 p-3 rounded-lg">{takedown.observacoes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
