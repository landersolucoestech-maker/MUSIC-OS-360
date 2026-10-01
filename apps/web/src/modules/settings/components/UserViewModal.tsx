import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { User, Mail, Phone, Building2, Calendar, Shield } from "lucide-react";
import { formatPersonName } from "@/shared/lib/format-name";
import { normalizeUserStatus, userStatusLabel } from "@/modules/settings/lib/user-status";

interface UserViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
}

export function UserViewModal({ open, onOpenChange, user: member }: UserViewModalProps) {
  if (!member) return null;

  const getStatusBadge = (status: string) => {
    const canonical = normalizeUserStatus(status, "inactive");
    return <Badge variant={canonical === "active" ? "success" : "neutral"}>{userStatusLabel(status)}</Badge>;
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
          {/* Avatar and name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xl font-semibold">
                {member.initials || member.fullName?.charAt(0) || "U"}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{formatPersonName(member.fullName, member.fullName)}</h2>
              <p className="text-muted-foreground">{member.cargo}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            <Badge variant="neutral">
              {member.cargo || "Usuário"}
            </Badge>
            {getStatusBadge(member.status)}
          </div>

          {/* Information grid */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{member.status || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Setor</p>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{member.setor || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cargo</p>
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{member.cargo || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{member.email || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <div className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{member.phone || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Criado em</p>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{member.createdAtLabel || "-"}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
