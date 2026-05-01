import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Share2, User, Calendar, Percent, Image } from "lucide-react";

interface ShareViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento?: any;
}

export function ShareViewModal({ open, onOpenChange, lancamento }: ShareViewModalProps) {
  if (!lancamento) return null;

  const getShareBadge = (share: string) => {
    if (share?.toLowerCase().includes("aplicado")) {
      return <Badge className="bg-status-active text-primary-foreground">{share}</Badge>;
    }
    if (share?.toLowerCase().includes("pendente")) {
      return <Badge className="bg-status-pending text-primary-foreground">{share}</Badge>;
    }
    return <Badge variant="secondary">{share}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="h-5 w-5" />
            Detalhes do Lançamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Capa e Título */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
              <Image className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{lancamento.title}</h2>
              <p className="text-muted-foreground">{lancamento.artist}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            <Badge className="bg-status-confirmed text-primary-foreground">
              {lancamento.type}
            </Badge>
            {getShareBadge(lancamento.share)}
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Data de Lançamento</p>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{lancamento.date || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Percentual</p>
              <div className="flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{lancamento.percentual || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Share Enviado</p>
              <p className="font-medium text-foreground">{lancamento.enviado || "-"}</p>
            </div>
          </div>

          {/* Status do Share */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status do Share</p>
              <p className="font-medium text-foreground">{lancamento.share || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo de Lançamento</p>
              <p className="font-medium text-foreground">{lancamento.type || "-"}</p>
            </div>
          </div>

          {/* Envolvido */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">Artista Principal</p>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-medium">
                    {lancamento.artist?.charAt(0) || "A"}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{lancamento.artist}</p>
                  <p className="text-sm text-muted-foreground">Artista Principal</p>
                </div>
              </div>
              <Badge variant="outline">100%</Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
