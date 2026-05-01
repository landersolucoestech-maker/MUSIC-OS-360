import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format-utils";
import { useLeadInteractions, TIPO_INTERACAO_OPTIONS, TIPO_INTERACAO_LABELS } from "@/hooks/useLeadInteractions";
import { STATUS_LABELS, ORIGEM_LABELS, useLeads } from "@/hooks/useLeads";
import {
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Target,
  Music,
  Users,
  Tag,
  MessageSquare,
  Plus,
  FileText,
  XCircle,
  Percent,
  Clock,
  Loader2,
} from "lucide-react";

interface LeadViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: any;
  onEdit?: (lead: any) => void;
}

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-600 text-white",
  qualificado: "bg-cyan-500 text-white",
  contato_realizado: "bg-sky-500 text-white",
  proposta_enviada: "bg-amber-500 text-white",
  negociacao: "bg-purple-500 text-white",
  followup: "bg-orange-500 text-white",
  confirmado: "bg-emerald-500 text-white",
  fechado: "bg-green-600 text-white",
  perdido: "bg-red-600 text-white",
  arquivado: "bg-slate-500 text-white",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "border-red-500 text-red-600",
  media: "border-amber-400 text-amber-500",
  baixa: "border-slate-400 text-slate-500",
};

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function LeadViewModal({ open, onOpenChange, lead, onEdit }: LeadViewModalProps) {
  const { updateLead } = useLeads();
  const { interactions, isLoading: interactionsLoading, addInteraction } = useLeadInteractions(lead?.id);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [tipoInteracao, setTipoInteracao] = useState("ligacao");
  const [descricaoInteracao, setDescricaoInteracao] = useState("");
  const [submittingInteraction, setSubmittingInteraction] = useState(false);

  if (!lead) return null;

  const handleAddInteraction = () => {
    if (!descricaoInteracao.trim()) return;
    setSubmittingInteraction(true);
    addInteraction.mutate({
      lead_id: lead.id,
      tipo_interacao: tipoInteracao,
      descricao: descricaoInteracao.trim(),
    } as any, {
      onSuccess: () => {
        setDescricaoInteracao("");
        setShowInteractionForm(false);
        setSubmittingInteraction(false);
      },
      onError: () => { setSubmittingInteraction(false); },
    });
  };

  const handleMarcarPerdido = () => {
    updateLead.mutate({
      id: lead.id,
      status_lead: "perdido",
      probabilidade_fechamento: 0,
    } as any, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const handleConverterContrato = () => {
    updateLead.mutate({
      id: lead.id,
      status_lead: "fechado",
      probabilidade_fechamento: 100,
    } as any, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const prob = lead.probabilidade_fechamento ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="modal-lead-view">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span data-testid="text-lead-name">{lead.nome_contratante}</span>
            <Badge className={STATUS_COLORS[lead.status_lead] || "bg-secondary"}>
              {STATUS_LABELS[lead.status_lead] || lead.status_lead}
            </Badge>
            <Badge variant="outline" className={PRIORIDADE_COLORS[lead.prioridade] || ""}>
              {lead.prioridade === "alta" ? "Alta" : lead.prioridade === "media" ? "Média" : "Baixa"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Lead criado em {formatDate(lead.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Probabilidade de Fechamento</span>
              <span className="font-semibold">{prob}%</span>
            </div>
            <Progress value={prob} className="h-2" data-testid="progress-probabilidade" />
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Contratante
            </h4>
            <div className="grid grid-cols-2 gap-3 pl-4">
              <InfoRow icon={User} label="Nome" value={lead.nome_contratante} />
              <InfoRow icon={Phone} label="Telefone" value={lead.telefone} />
              <InfoRow icon={Mail} label="Email" value={lead.email} />
              <InfoRow icon={Building} label="Empresa" value={lead.nome_empresa} />
              <InfoRow icon={FileText} label="Documento" value={lead.documento} />
              <InfoRow icon={User} label="Cargo" value={lead.cargo} />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Music className="h-4 w-4" />
              Dados do Evento
            </h4>
            <div className="grid grid-cols-2 gap-3 pl-4">
              <InfoRow icon={Music} label="Artista" value={lead.artista_interesse} />
              <InfoRow icon={Tag} label="Tipo" value={lead.tipo_evento} />
              <InfoRow icon={Calendar} label="Data" value={lead.data_evento ? formatDate(lead.data_evento) : null} />
              <InfoRow icon={MapPin} label="Cidade" value={lead.cidade_evento} />
              <InfoRow icon={MapPin} label="Estado" value={lead.estado_evento} />
              <InfoRow icon={MapPin} label="Local" value={lead.nome_local_evento} />
              <InfoRow icon={MapPin} label="Endereço" value={lead.endereco_evento} />
              <InfoRow icon={Users} label="Capacidade" value={lead.capacidade_publico ? String(lead.capacidade_publico) : null} />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Comercial
            </h4>
            <div className="grid grid-cols-2 gap-3 pl-4">
              <InfoRow icon={DollarSign} label="Orçamento" value={lead.orcamento_estimado ? formatCurrency(lead.orcamento_estimado) : null} />
              <InfoRow icon={DollarSign} label="Valor (Cachê)" value={lead.valor_estimado_cache ? formatCurrency(lead.valor_estimado_cache) : null} />
              <InfoRow icon={Percent} label="Comissão" value={lead.comissao_percentual ? `${lead.comissao_percentual}%` : null} />
              <InfoRow icon={FileText} label="Tipo Contrato" value={lead.tipo_contrato} />
              <InfoRow icon={Calendar} label="Limite Retorno" value={lead.data_limite_retorno ? formatDate(lead.data_limite_retorno) : null} />
              <InfoRow icon={Target} label="Origem" value={ORIGEM_LABELS[lead.origem_lead] || lead.origem_lead} />
            </div>
            {lead.tags && lead.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-4 mt-2">
                {lead.tags.map((tag: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

          {lead.observacoes_internas && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold">Observações Internas</h4>
                <p className="text-muted-foreground pl-4 whitespace-pre-wrap text-sm" data-testid="text-lead-observacoes">
                  {lead.observacoes_internas}
                </p>
              </div>
            </>
          )}

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Interações
              </h4>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setShowInteractionForm(!showInteractionForm)}
                data-testid="button-toggle-interaction-form"
              >
                <Plus className="h-3 w-3" /> Registrar
              </Button>
            </div>

            {showInteractionForm && (
              <div className="border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={tipoInteracao} onValueChange={setTipoInteracao}>
                      <SelectTrigger data-testid="select-tipo-interacao">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_INTERACAO_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    placeholder="Descreva a interação..."
                    value={descricaoInteracao}
                    onChange={(e) => setDescricaoInteracao(e.target.value)}
                    rows={2}
                    data-testid="textarea-descricao-interacao"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowInteractionForm(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleAddInteraction} disabled={submittingInteraction || !descricaoInteracao.trim()} data-testid="button-submit-interaction">
                    {submittingInteraction && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}

            {interactionsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : interactions && interactions.length > 0 ? (
              <div className="space-y-3 pl-4">
                {interactions.map((inter) => (
                  <div key={inter.id} className="flex gap-3 text-sm border-l-2 border-muted-foreground/20 pl-3 py-1" data-testid={`interaction-${inter.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {TIPO_INTERACAO_LABELS[inter.tipo_interacao] || inter.tipo_interacao}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(inter.data_interacao)}
                        </span>
                      </div>
                      {inter.descricao && (
                        <p className="text-muted-foreground">{inter.descricao}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground pl-4">Nenhuma interação registrada.</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-between border-t pt-4">
          <div className="flex gap-2">
            {lead.status_lead !== "fechado" && lead.status_lead !== "perdido" && (
              <>
                <Button variant="default" size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={handleConverterContrato} data-testid="button-converter-contrato">
                  <FileText className="h-4 w-4" /> Converter em Contrato
                </Button>
                <Button variant="destructive" size="sm" className="gap-1" onClick={handleMarcarPerdido} data-testid="button-marcar-perdido">
                  <XCircle className="h-4 w-4" /> Marcar como Perdido
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => { onEdit(lead); onOpenChange(false); }} data-testid="button-edit-from-view">
                Editar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} data-testid="button-close-lead-view">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
