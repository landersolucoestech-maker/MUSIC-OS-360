import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Building2, Calendar, Shield } from "lucide-react";

interface UsuarioViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario?: any;
}

export function UsuarioViewModal({ open, onOpenChange, usuario }: UsuarioViewModalProps) {
  if (!usuario) return null;

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ativo":
        return <Badge className="bg-green-600 hover:bg-green-600 text-white">{status}</Badge>;
      case "inativo":
        return <Badge className="bg-red-600 hover:bg-red-600 text-white">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <User className="h-5 w-5" />
            Detalhes do Usuário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar e Nome */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xl font-semibold">
                {usuario.iniciais || usuario.nome?.charAt(0) || "U"}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{usuario.nome}</h2>
              <p className="text-muted-foreground">{usuario.cargo}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            <Badge className="bg-blue-500 hover:bg-blue-500 text-white">
              {usuario.cargo || "Usuário"}
            </Badge>
            {getStatusBadge(usuario.status)}
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{usuario.status || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Setor</p>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{usuario.setor || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cargo</p>
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{usuario.cargo || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{usuario.email || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <div className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{usuario.telefone || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Criado em</p>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{usuario.criadoEm || "-"}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
