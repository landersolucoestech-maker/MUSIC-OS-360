import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Building2, MapPin, Calendar } from "lucide-react";

interface ContatoViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contato?: any;
}

export function ContatoViewModal({ open, onOpenChange, contato }: ContatoViewModalProps) {
  if (!contato) return null;

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ativo":
        return <Badge className="bg-green-600 hover:bg-green-600 text-white">{status}</Badge>;
      case "prospect":
        return <Badge className="bg-blue-500 hover:bg-blue-500 text-white">{status}</Badge>;
      case "lead":
        return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">{status}</Badge>;
      case "arquivado":
        return <Badge className="bg-gray-500 hover:bg-gray-500 text-white">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTemperaturaBadge = (temp: string) => {
    switch (temp?.toLowerCase()) {
      case "quente":
        return <Badge className="bg-red-500 hover:bg-red-500 text-white">🔥 Quente</Badge>;
      case "morno":
        return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Morno</Badge>;
      case "frio":
        return <Badge className="bg-blue-500 hover:bg-blue-500 text-white">Frio</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <User className="h-5 w-5" />
            Detalhes do Contato
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar e Nome */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xl font-semibold">
                {contato.nome?.charAt(0) || "C"}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{contato.nome}</h2>
              <p className="text-muted-foreground">{contato.empresa || contato.categoria}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            {getStatusBadge(contato.statusRelacionamento)}
            {contato.temperatura && getTemperaturaBadge(contato.temperatura)}
            {contato.categoria && <Badge variant="outline">{contato.categoria}</Badge>}
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{contato.email || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <div className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{contato.telefone || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Empresa</p>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{contato.empresa || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cidade</p>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{contato.cidade || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Responsável</p>
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{contato.responsavelNome || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Próxima Ação</p>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{contato.dataProximaAcao || "-"}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {contato.tags && contato.tags.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {contato.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
