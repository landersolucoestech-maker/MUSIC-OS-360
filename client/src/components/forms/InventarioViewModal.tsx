import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, User, DollarSign } from "lucide-react";

interface InventarioViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
}

export function InventarioViewModal({ open, onOpenChange, item }: InventarioViewModalProps) {
  if (!item) return null;

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "em uso":
        return <Badge className="bg-status-active text-primary-foreground">{status}</Badge>;
      case "disponível":
        return <Badge className="bg-status-confirmed text-primary-foreground">{status}</Badge>;
      case "manutenção":
        return <Badge className="bg-status-pending text-primary-foreground">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Package className="h-5 w-5" />
            Detalhes do Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Nome do Item */}
          <div>
            <h2 className="text-xl font-bold text-foreground">{item.nome}</h2>
            <p className="text-muted-foreground">{item.categoria}</p>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            <Badge className="bg-blue-500 hover:bg-blue-500 text-white">
              {item.categoria || "Equipamento"}
            </Badge>
            {getStatusBadge(item.status)}
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{item.status || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quantidade</p>
              <p className="font-medium text-foreground">{item.qtd || item.quantidade || "1 un"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Localização</p>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{item.local || item.localizacao || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Unitário</p>
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{item.valorUnit || item.valorUnitario || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="font-medium text-green-500">{item.valorTotal || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Setor</p>
              <p className="font-medium text-foreground">{item.setor || "-"}</p>
            </div>
          </div>

          {/* Responsável */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">Responsável</p>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{item.responsavel || "Não atribuído"}</p>
                <p className="text-sm text-muted-foreground">Responsável pelo item</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
