import React, { forwardRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useContratos } from "@/hooks/useContratos";
import { useArtistas } from "@/hooks/useArtistas";
import { ContratoStatusBadge, getContratoSituacao } from "@/components/shared/ContratoStatusBadge";
import { formatCurrency, formatDate, getInitials } from "@/lib/format-utils";
import { Mail, Phone, Building, MapPin, FileText, DollarSign, Music, User } from "lucide-react";

interface CRMViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: any;
}

export const CRMViewModal = forwardRef<HTMLDivElement, CRMViewModalProps>(
  function CRMViewModal({ open, onOpenChange, cliente }, ref) {
    const { contratos } = useContratos();
    const { artistas } = useArtistas();

    const clienteMetrics = useMemo(() => {
      if (!cliente?.id) {
        return { clienteContratos: [], totalContratos: 0, artistasEnvolvidos: [] };
      }

      const clienteContratos = contratos.filter((c: any) => c.cliente_id === cliente.id);
      const totalContratos = clienteContratos.reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
      
      const artistaIds = new Set<string>();
      clienteContratos.forEach((c: any) => {
        if (c.artista_id) artistaIds.add(c.artista_id);
      });
      const artistasEnvolvidos = artistas.filter((a: any) => artistaIds.has(a.id));

      return { clienteContratos, totalContratos, artistasEnvolvidos };
    }, [cliente, contratos, artistas]);

    if (!cliente) return null;

    const getStatusBadge = (status: string) => {
      switch (status) {
        case "cliente_ativo": return <Badge className="bg-green-600">Cliente Ativo</Badge>;
        case "lead": return <Badge className="bg-blue-600">Lead</Badge>;
        case "inativo": return <Badge className="bg-slate-500">Inativo</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>;
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref} className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(cliente.nome)}
                </AvatarFallback>
              </Avatar>
              <div>
                <span>{cliente.nome}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {cliente.tipo_pessoa === "pessoa_fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </Badge>
                  {getStatusBadge(cliente.status)}
                  <ContratoStatusBadge
                    situacao={getContratoSituacao(clienteMetrics.clienteContratos)}
                    data-testid={`badge-contrato-cliente-${cliente.id}`}
                  />
                </div>
              </div>
            </DialogTitle>
            <DialogDescription>
              Cliente desde {formatDate(cliente.created_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <FileText className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">{clienteMetrics.clienteContratos.length}</p>
                <p className="text-sm text-muted-foreground">Contratos</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-green-500">{formatCurrency(clienteMetrics.totalContratos)}</p>
                <p className="text-sm text-muted-foreground">Total Contratado</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <Music className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{clienteMetrics.artistasEnvolvidos.length}</p>
                <p className="text-sm text-muted-foreground">Artistas</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold">Informações de Contato</h4>
              <div className="grid grid-cols-2 gap-4 pl-4">
                {cliente.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{cliente.email}</span>
                  </div>
                )}
                {cliente.telefone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{cliente.telefone}</span>
                  </div>
                )}
                {cliente.responsavel && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Responsável: {cliente.responsavel}</span>
                  </div>
                )}
                {cliente.cpf_cnpj && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{cliente.tipo_pessoa === "pessoa_fisica" ? "CPF" : "CNPJ"}: {cliente.cpf_cnpj}</span>
                  </div>
                )}
                {cliente.cidade && (
                  <div className="flex items-center gap-2 text-sm col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {cliente.endereco && `${cliente.endereco}, `}
                      {cliente.cidade}/{cliente.estado}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {clienteMetrics.artistasEnvolvidos.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold">Artistas Envolvidos</h4>
                  <div className="flex flex-wrap gap-2 pl-4">
                    {clienteMetrics.artistasEnvolvidos.map((artista: any) => (
                      <Badge key={artista.id} className="bg-purple-600">
                        {artista.nome_artistico}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {clienteMetrics.clienteContratos.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold">Contratos</h4>
                  <div className="space-y-2 pl-4">
                    {clienteMetrics.clienteContratos.map((contrato: any) => (
                      <div 
                        key={contrato.id} 
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{contrato.titulo || "Contrato"}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {contrato.data_inicio && <span>{formatDate(contrato.data_inicio)}</span>}
                            {contrato.artistas && <span>• {contrato.artistas.nome_artistico}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-500">{formatCurrency(contrato.valor)}</p>
                          <Badge 
                            variant="outline" 
                            className={
                              contrato.status === "ativo" ? "border-green-500 text-green-500" :
                              contrato.status === "pendente" ? "border-amber-500 text-amber-500" :
                              "border-slate-500 text-slate-500"
                            }
                          >
                            {contrato.status === "ativo" ? "Ativo" :
                             contrato.status === "pendente" ? "Pendente" : contrato.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {cliente.observacoes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold">Observações</h4>
                  <p className="text-muted-foreground pl-4">{cliente.observacoes}</p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
