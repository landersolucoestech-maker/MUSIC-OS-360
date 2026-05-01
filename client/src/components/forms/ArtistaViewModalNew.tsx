import React, { forwardRef, useMemo } from "react";
import { Link } from "react-router-dom";
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
import { Card, CardContent } from "@/components/ui/card";
import { useEventos } from "@/hooks/useEventos";
import { useContratos, type ContratoWithRelations } from "@/hooks/useContratos";
import { ContratoStatusBadge, getContratoSituacao } from "@/components/shared/ContratoStatusBadge";
import { formatCurrency, formatDate, getInitials } from "@/lib/format-utils";
import {
  Mail, Phone, Music, Calendar, DollarSign, CheckCircle,
  MapPin, Shield, Handshake, FileText, ExternalLink,
} from "lucide-react";

interface ArtistaViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artista?: any;
  onEdit?: (artista: any) => void;
}

function derivarTagContratual(contratos: ContratoWithRelations[]): "exclusivo" | "parceiro" | "sem_contrato" {
  const hoje = new Date();
  const ativos = contratos.filter((c) => {
    if (c.status !== "assinado") return false;
    if (c.data_fim && new Date(c.data_fim) < hoje) return false;
    return true;
  });
  if (ativos.some((c) => c.exclusivo === true)) return "exclusivo";
  if (ativos.length > 0) return "parceiro";
  return "sem_contrato";
}

const tipoContratoLabel: Record<string, string> = {
  empresariamento: "Empresariamento",
  empresariamento_suporte: "Empresariamento c/ Suporte",
  gestao: "Gestão",
  agenciamento: "Agenciamento",
  edicao: "Edição",
  distribuicao: "Distribuição",
  marketing: "Marketing",
  producao_musical: "Produção Musical",
  producao_audiovisual: "Produção Audiovisual",
  licenciamento: "Licenciamento",
  publicidade: "Publicidade",
  parceria: "Parceria",
  shows: "Shows",
  artistico: "Artístico",
  outros: "Outros",
};

export const ArtistaViewModal = forwardRef<HTMLDivElement, ArtistaViewModalProps>(
  function ArtistaViewModal({ open, onOpenChange, artista, onEdit }, ref) {
    const { eventos } = useEventos();
    const { contratos } = useContratos();

    const artistaContratos = useMemo<ContratoWithRelations[]>(() => {
      if (!artista?.id) return [];
      return contratos.filter((c) => c.artista_id === artista.id);
    }, [artista, contratos]);

    const tagContratual = useMemo(() => {
      return derivarTagContratual(artistaContratos);
    }, [artistaContratos]);

    const artistaMetrics = useMemo(() => {
      if (!artista?.id) return { shows: [], showsAgendados: [], showsRealizados: [], receitaTotal: 0 };
      const eventosArtista = eventos.filter((e: any) => e.artista_id === artista.id);
      const shows = eventosArtista.filter((e: any) => e.tipo === "show" || e.tipo_evento === "Show");
      const showsAgendados = shows.filter((e: any) => e.status === "Confirmado" || e.status === "Pendente");
      const showsRealizados = shows.filter((e: any) => e.status === "Realizado");
      const receitaTotal = shows
        .filter((e: any) => e.status === "Confirmado" || e.status === "Realizado")
        .reduce((acc: number, e: any) => acc + (e.cache || e.valor_cache || 0), 0);
      return { shows, showsAgendados, showsRealizados, receitaTotal };
    }, [artista, eventos]);

    if (!artista) return null;

    const getStatusBadge = (status: string) => {
      switch (status) {
        case "contratado": return <Badge className="bg-green-600 hover:bg-green-600">Contratado</Badge>;
        case "parceiro": return <Badge className="bg-blue-600 hover:bg-blue-600">Parceiro</Badge>;
        case "independente": return <Badge className="bg-purple-600 hover:bg-purple-600">Independente</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>;
      }
    };

    const getTipoBadge = (tipo: string) => {
      const labels: Record<string, string> = {
        artista_solo: "Artista Solo", banda: "Banda",
        projeto_artistico: "Projeto Artístico", coletivo: "Coletivo", produtor: "Produtor",
      };
      return <Badge variant="outline">{labels[tipo] || tipo}</Badge>;
    };

    const TagContratualBadge = () => {
      switch (tagContratual) {
        case "exclusivo":
          return (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 px-3 py-1 text-sm">
              <Shield className="h-3.5 w-3.5" />
              Artista Exclusivo
            </Badge>
          );
        case "parceiro":
          return (
            <Badge className="bg-blue-600 hover:bg-blue-600 text-white gap-1 px-3 py-1 text-sm">
              <Handshake className="h-3.5 w-3.5" />
              Artista Parceiro
            </Badge>
          );
        default:
          return (
            <Badge variant="outline" className="gap-1 px-3 py-1 text-sm text-muted-foreground">
              Sem contrato ativo
            </Badge>
          );
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref} className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {getInitials(artista.nome_artistico)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="text-xl block">{artista.nome_artistico}</span>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <TagContratualBadge />
                  {getTipoBadge(artista.tipo || artista.status)}
                  {getStatusBadge(artista.status)}
                  {artista.genero_musical && <Badge variant="outline">{artista.genero_musical}</Badge>}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription>
              Perfil do artista · cadastrado em {formatDate(artista.created_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Métricas */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: Music, value: artistaMetrics.shows.length, label: "Total Shows", color: "text-purple-500" },
                { icon: Calendar, value: artistaMetrics.showsAgendados.length, label: "Agendados", color: "text-blue-500" },
                { icon: CheckCircle, value: artistaMetrics.showsRealizados.length, label: "Realizados", color: "text-green-500" },
                { icon: DollarSign, value: formatCurrency(artistaMetrics.receitaTotal), label: "Receita", color: "text-green-500", isText: true },
              ].map(({ icon: Icon, value, label, color, isText }) => (
                <div key={label} className="bg-muted/50 p-3 rounded-lg text-center">
                  <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
                  <p className={`${isText ? "text-base" : "text-xl"} font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <Separator />

            {/* Informações */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informações</h4>
              <div className="grid grid-cols-2 gap-3 pl-2">
                {artista.nome_civil && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Nome Civil:</span>
                    <span className="ml-2 font-medium">{artista.nome_civil}</span>
                  </div>
                )}
                {artista.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{artista.email}</span>
                  </div>
                )}
                {artista.telefone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{artista.telefone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Seção Contratos */}
            {artistaContratos.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Contratos Vinculados ({artistaContratos.length})
                  </h4>
                  <div className="space-y-2">
                    {artistaContratos.map((contrato) => {
                      const hoje = new Date();
                      const vencido = contrato.data_fim && new Date(contrato.data_fim) < hoje;
                      return (
                        <Card key={contrato.id} className="border-muted">
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{contrato.titulo}</span>
                                <ContratoStatusBadge situacao={getContratoSituacao([contrato])} />
                                {contrato.exclusivo && (
                                  <Badge className="bg-emerald-600 text-white text-xs gap-1">
                                    <Shield className="h-3 w-3" /> Exclusivo
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                <span>{tipoContratoLabel[contrato.tipo || ""] || contrato.tipo || "—"}</span>
                                {contrato.data_inicio && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(contrato.data_inicio)}
                                    {contrato.data_fim && ` → ${formatDate(contrato.data_fim)}`}
                                    {vencido && <span className="text-destructive ml-1">(Vencido)</span>}
                                  </span>
                                )}
                                {contrato.valor && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(contrato.valor)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Link
                              to={`/contratos`}
                              state={{ filtroArtistaId: artista.id, filtroContratoId: contrato.id }}
                              onClick={() => onOpenChange(false)}
                              className="inline-flex items-center justify-center rounded-md p-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                              title={`Abrir contrato "${contrato.titulo}" em Contratos`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Royalties & Financeiro */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Royalties & Financeiro
              </h4>
              <div className="grid grid-cols-2 gap-3 pl-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Receita de Shows</p>
                  <p className="text-lg font-bold text-green-500">
                    {formatCurrency(artistaMetrics.receitaTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">{artistaMetrics.showsRealizados} show{artistaMetrics.showsRealizados !== 1 ? "s" : ""} realizado{artistaMetrics.showsRealizados !== 1 ? "s" : ""}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Royalties Pendentes</p>
                  <p className="text-lg font-bold text-amber-500">—</p>
                  <p className="text-xs text-muted-foreground">Ver módulo Financeiro</p>
                </div>
              </div>
              <Link
                to="/financeiro"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline pl-2"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir módulo financeiro completo
              </Link>
            </div>

            {/* Histórico de Shows */}
            {artistaMetrics.shows.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Histórico de Shows</h4>
                  <div className="space-y-2 pl-2">
                    {artistaMetrics.shows.slice(0, 5).map((evento: any) => (
                      <div key={evento.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{evento.titulo || evento.nome || "Show"}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {(evento.data || evento.data_inicio) && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(evento.data || evento.data_inicio)}
                              </span>
                            )}
                            {evento.local && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {evento.local}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-green-500 text-sm">{formatCurrency(evento.cache || evento.valor_cache || 0)}</p>
                          <Badge
                            variant="outline"
                            className={
                              evento.status === "Realizado" ? "border-green-500 text-green-500 text-xs" :
                              evento.status === "Confirmado" ? "border-blue-500 text-blue-500 text-xs" :
                              "border-amber-500 text-amber-500 text-xs"
                            }
                          >
                            {evento.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {artistaMetrics.shows.length > 5 && (
                      <p className="text-xs text-muted-foreground pl-1">+ {artistaMetrics.shows.length - 5} shows anteriores</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {artista.observacoes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Observações</h4>
                  <p className="text-sm text-muted-foreground pl-2">{artista.observacoes}</p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onEdit(artista); }}>
                Editar Artista
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
