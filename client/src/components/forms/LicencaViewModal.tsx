import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Music, Building, DollarSign, Calendar, MapPin, Tv } from "lucide-react";

interface LicencaViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenca?: any;
}

export function LicencaViewModal({ open, onOpenChange, licenca }: LicencaViewModalProps) {
  if (!licenca) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Ativa": return <Badge className="bg-green-600">{status}</Badge>;
      case "Em Negociação": return <Badge className="bg-amber-500">{status}</Badge>;
      case "Proposta Enviada": return <Badge className="bg-blue-500">{status}</Badge>;
      case "Expirada": return <Badge className="bg-red-600">{status}</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detalhes da Licença
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações da Licença */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Music className="h-4 w-4" /> Informações da Licença
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Título</span>
                <p className="font-medium">{licenca.titulo || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Status</span>
                <div className="mt-1">{getStatusBadge(licenca.status)}</div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Obra Musical</span>
                <p className="font-medium">{licenca.obra || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Artista</span>
                <p className="font-medium">{licenca.artista || "—"}</p>
              </div>
            </div>
          </div>

          {/* Cliente e Projeto */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" /> Cliente e Projeto
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Cliente</span>
                <p className="font-medium">{licenca.cliente || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Projeto</span>
                <p className="font-medium">{licenca.projeto || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground flex items-center gap-1"><Tv className="h-3 w-3" /> Mídia de Destino</span>
                <p className="font-medium">{licenca.midia || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Território</span>
                <p className="font-medium">{licenca.territorio || "Brasil"}</p>
              </div>
            </div>
          </div>

          {/* Período e Valor */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Período e Valor
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Vigência</span>
                <p className="font-medium">{licenca.vigencia || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Valor</span>
                <p className="font-medium text-green-500">{licenca.valor || "—"}</p>
              </div>
            </div>
          </div>

          {/* Observações */}
          {licenca.observacoes && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Observações</span>
              <p className="text-sm bg-muted/30 p-3 rounded-lg">{licenca.observacoes}</p>
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
