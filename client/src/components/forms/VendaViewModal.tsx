import React, { forwardRef } from "react";
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
import { useTransacoes } from "@/hooks/useTransacoes";
import { useEventos } from "@/hooks/useEventos";
import { formatCurrency, formatDate } from "@/lib/format-utils";
import { Music, Package, ShoppingCart, Calendar, MapPin, User, Building, FileText, DollarSign } from "lucide-react";

interface VendaViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda?: any;
}

export const VendaViewModal = forwardRef<HTMLDivElement, VendaViewModalProps>(
  function VendaViewModal({ open, onOpenChange, venda }, ref) {
    const { transacoes } = useTransacoes();
    const { eventos } = useEventos();

    if (!venda) return null;

    // Get related data from joined tables
    const item = venda.catalogo;
    const cliente = venda.clientes;
    const artista = venda.artistas;
    
    // Find related transaction and event
    const transacao = transacoes.find((t: any) => t.venda_id === venda.id);
    const evento = eventos.find((e: any) => e.venda_id === venda.id);

    const isShow = item?.categoria === "show";

    const getStatusBadge = (status: string) => {
      switch (status) {
        case "executada": return <Badge className="bg-status-executed text-primary-foreground">Executada</Badge>;
        case "confirmada": return <Badge className="bg-status-confirmed text-primary-foreground">Confirmada</Badge>;
        case "pendente": return <Badge className="bg-status-pending text-primary-foreground">Pendente</Badge>;
        case "cancelada": return <Badge className="bg-status-cancelled text-primary-foreground">Cancelada</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>;
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isShow ? "bg-accent" : 
                venda.tipo === "produto" ? "bg-status-pending" : "bg-status-confirmed"
              }`}>
                {isShow ? (
                  <Music className="h-5 w-5 text-white" />
                ) : venda.tipo === "produto" ? (
                  <Package className="h-5 w-5 text-white" />
                ) : (
                  <ShoppingCart className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <span>{item?.nome || "Venda"}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {venda.tipo === "servico" ? "Serviço" : "Produto"}
                  </Badge>
                  {getStatusBadge(venda.status)}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription>
              Detalhes da venda registrada em {formatDate(venda.created_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Valor */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Negociado</p>
                  <p className="text-3xl font-bold text-status-active">{formatCurrency(venda.valor_negociado)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valor de Referência</p>
                  <p className="text-lg">{formatCurrency(venda.valor_referencia)}</p>
                  {venda.valor_negociado !== venda.valor_referencia && (
                    <p className={`text-sm ${venda.valor_negociado > venda.valor_referencia ? "text-status-active" : "text-destructive"}`}>
                      {venda.valor_negociado > venda.valor_referencia ? "+" : ""}
                      {formatCurrency(venda.valor_negociado - venda.valor_referencia)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Contratante */}
            {cliente && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Contratante
                </h4>
                <div className="pl-6 space-y-1">
                  <p className="font-medium">{cliente.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {cliente.tipo_pessoa === "pessoa_fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
                    {cliente.cpf_cnpj && ` • ${cliente.cpf_cnpj}`}
                  </p>
                  {cliente.email && <p className="text-sm text-muted-foreground">{cliente.email}</p>}
                  {cliente.telefone && <p className="text-sm text-muted-foreground">{cliente.telefone}</p>}
                </div>
              </div>
            )}

            {/* Artista (se houver) */}
            {artista && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Artista
                  </h4>
                  <div className="pl-6 space-y-1">
                    <p className="font-medium">{artista.nome_artistico}</p>
                    <p className="text-sm text-muted-foreground">
                      {artista.genero_musical} • {artista.status === "contratado" ? "Contratado" : artista.status === "parceiro" ? "Parceiro" : "Independente"}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Data e Local (para shows) */}
            {isShow && venda.data && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Data e Horário
                    </h4>
                    <div className="pl-6">
                      <p>{formatDate(venda.data)}</p>
                      {venda.horario && <p className="text-muted-foreground">{venda.horario}</p>}
                    </div>
                  </div>
                  {venda.local && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Local
                      </h4>
                      <div className="pl-6">
                        <p>{venda.local}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Quantidade (para produtos) */}
            {venda.tipo === "produto" && venda.quantidade && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold">Quantidade</h4>
                  <p className="pl-6">{venda.quantidade} unidade(s)</p>
                </div>
              </>
            )}

            {/* Observações */}
            {venda.observacoes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Observações
                  </h4>
                  <p className="pl-6 text-muted-foreground">{venda.observacoes}</p>
                </div>
              </>
            )}

            {/* Registros Vinculados */}
            {(transacao || evento) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold">Registros Vinculados</h4>
                  <div className="pl-6 space-y-2">
                    {transacao && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-status-active" />
                        <span>Transação: {transacao.descricao}</span>
                        <Badge variant="outline" className={transacao.status === "pago" ? "border-status-active text-status-active" : "border-status-pending text-status-pending"}>
                          {transacao.status === "pago" ? "Pago" : "Pendente"}
                        </Badge>
                      </div>
                    )}
                    {evento && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-accent" />
                        <span>Evento: {evento.titulo}</span>
                        <Badge variant="outline" className={evento.status === "confirmado" ? "border-status-active text-status-active" : "border-status-pending text-status-pending"}>
                          {evento.status === "confirmado" ? "Confirmado" : evento.status === "realizado" ? "Realizado" : "Agendado"}
                        </Badge>
                      </div>
                    )}
                  </div>
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
