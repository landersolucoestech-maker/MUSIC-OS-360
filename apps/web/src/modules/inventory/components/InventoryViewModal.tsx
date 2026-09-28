import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { statusLabelPtBr } from "@music-os-360/types";
import type { InventoryItem } from "@/modules/inventory/types/inventory.types";
import { Package, MapPin, User, DollarSign } from "lucide-react";
import { formatCurrency, getMonetarySemanticClass } from "@/shared/lib/format-utils";

interface InventoryViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryItem | null;
}

export function InventoryViewModal({ open, onOpenChange, item }: InventoryViewModalProps) {
  if (!item) return null;

  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const quantity = toNumber(item.quantity) ?? 1;
  const unitValue = toNumber(item.unit_price);
  const totalValue = unitValue == null ? null : unitValue * quantity;
  const status = typeof item.status === "string" ? item.status : null;
  const statusLabel = status ? (statusLabelPtBr("inventory", status) ?? "Status não reconhecido") : "-";

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
            <h2 className="text-xl font-bold text-foreground">{item.name}</h2>
            <p className="text-muted-foreground">{item.category}</p>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            <Badge variant="neutral">
              {item.category || "Equipamento"}
            </Badge>
            {status && <StatusBadge status={status} domain="inventory" />}
          </div>

          {/* Information grid */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{statusLabel}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quantidade</p>
              <p className="font-medium text-foreground">{quantity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Localização</p>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{item.storage_location || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Unitário</p>
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className={`font-medium ${unitValue == null ? "text-foreground" : getMonetarySemanticClass("neutral")}`}>{unitValue == null ? "-" : formatCurrency(unitValue)}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className={`font-medium ${totalValue == null ? "text-foreground" : getMonetarySemanticClass("neutral")}`}>{totalValue == null ? "-" : formatCurrency(totalValue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Setor</p>
              <p className="font-medium text-foreground">{item.sector || "-"}</p>
            </div>
          </div>

          {/* Owner */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">Responsável</p>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{item.responsible_person || "Não atribuído"}</p>
                <p className="text-sm text-muted-foreground">Responsável pelo item</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
