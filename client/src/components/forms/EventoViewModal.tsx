import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, MapPin, User, Phone, Mail, Users, DollarSign, Tag, FileText, Pencil, Building2, CheckSquare } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils-format";

interface EventoViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: any;
  onEdit?: () => void;
}

const tipoEventoLabels: Record<string, string> = {
  sessoes_estudio: "Sessão de Estúdio",
  ensaios: "Ensaio",
  sessoes_fotos: "Sessão de Fotos",
  shows: "Show",
  show: "Show",
  entrevistas: "Entrevista",
  podcasts: "Podcast",
  programas_tv: "Programa de TV",
  radio: "Rádio",
  producao_conteudo: "Produção de Conteúdo",
  reunioes: "Reunião",
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "confirmado": return <Badge className="bg-green-600">Confirmado</Badge>;
    case "agendado":
    case "pendente": return <Badge className="bg-amber-500">Pendente</Badge>;
    case "realizado":
    case "concluido": return <Badge className="bg-blue-600">Realizado</Badge>;
    case "cancelado": return <Badge className="bg-red-600">Cancelado</Badge>;
    default: return <Badge variant="secondary">{status || "—"}</Badge>;
  }
};

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground border-b border-border pb-2">
        <Icon className="h-4 w-4" />
        <span className="uppercase tracking-wide text-xs">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || <span className="text-muted-foreground italic">—</span>}</p>
    </div>
  );
}

export function EventoViewModal({ open, onOpenChange, evento, onEdit }: EventoViewModalProps) {
  if (!evento) return null;

  const artista = evento.artistas;
  const checklist: Array<{ item: string; concluido: boolean }> = Array.isArray(evento.checklist) ? evento.checklist : [];
  const checklistDone = checklist.filter(c => c.concluido).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="modal-evento-view">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl" data-testid="text-evento-titulo">{evento.titulo}</DialogTitle>
              <DialogDescription className="mt-1">
                Detalhes completos do evento
              </DialogDescription>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tipoEventoLabels[evento.tipo_evento] || evento.tipo_evento}
                </Badge>
                {getStatusBadge(evento.status)}
                {evento.tipo_local && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {evento.tipo_local.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* DATA E HORÁRIO */}
          <Section title="Quando" icon={Calendar}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Data Início" value={formatDate(evento.data_inicio)} />
              <Field label="Horário Início" value={evento.horario_inicio} />
              <Field label="Data Fim" value={evento.data_fim ? formatDate(evento.data_fim) : null} />
              <Field label="Horário Fim" value={evento.horario_fim} />
            </div>
          </Section>

          {/* LOCAL */}
          <Section title="Onde" icon={MapPin}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Local" value={evento.local} />
              <Field
                label="Endereço"
                value={[evento.endereco, evento.cidade, evento.uf].filter(Boolean).join(", ")}
              />
            </div>
          </Section>

          {/* ARTISTA */}
          {artista && (
            <Section title="Artista" icon={User}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" data-testid="text-evento-artista">
                      {artista.nome_artistico || artista.nome || "—"}
                    </p>
                    {artista.genero_musical && (
                      <p className="text-xs text-muted-foreground">{artista.genero_musical}</p>
                    )}
                  </div>
                  {artista.email && (
                    <div className="hidden sm:flex flex-col text-right text-xs text-muted-foreground">
                      <span>{artista.email}</span>
                      {artista.telefone && <span>{artista.telefone}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Section>
          )}

          {/* CONTATO DO LOCAL */}
          {(evento.contato_local || evento.contato_telefone || evento.contato_email) && (
            <Section title="Contato no Local" icon={Phone}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field
                  label="Responsável"
                  value={evento.contato_local && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {evento.contato_local}
                    </span>
                  )}
                />
                <Field
                  label="Telefone"
                  value={evento.contato_telefone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {evento.contato_telefone}
                    </span>
                  )}
                />
                <Field
                  label="E-mail"
                  value={evento.contato_email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{evento.contato_email}</span>
                    </span>
                  )}
                />
              </div>
            </Section>
          )}

          {/* DETALHES OPERACIONAIS (Show) */}
          {(evento.valor_cache != null || evento.capacidade_publico != null || evento.publico_esperado != null) && (
            <Section title="Detalhes Operacionais" icon={DollarSign}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {evento.valor_cache != null && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Cachê</p>
                      <p className="text-xl font-bold text-green-600 mt-1" data-testid="text-evento-cache">
                        {formatCurrency(evento.valor_cache)}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {evento.capacidade_publico != null && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Capacidade</p>
                      <p className="text-xl font-bold mt-1 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {Number(evento.capacidade_publico).toLocaleString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {evento.publico_esperado != null && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Público Esperado</p>
                      <p className="text-xl font-bold mt-1 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {Number(evento.publico_esperado).toLocaleString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </Section>
          )}

          {/* DESCRIÇÃO */}
          {evento.descricao && (
            <Section title="Descrição" icon={FileText}>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap" data-testid="text-evento-descricao">
                    {evento.descricao}
                  </p>
                </CardContent>
              </Card>
            </Section>
          )}

          {/* CHECKLIST */}
          {checklist.length > 0 && (
            <Section title={`Checklist (${checklistDone}/${checklist.length})`} icon={CheckSquare}>
              <Card>
                <CardContent className="p-4 space-y-2">
                  {checklist.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={c.concluido} disabled className="pointer-events-none" />
                      <span className={c.concluido ? "line-through text-muted-foreground" : "text-foreground"}>
                        {c.item}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </Section>
          )}

          {/* OBSERVAÇÕES */}
          {evento.observacoes && (
            <Section title="Observações" icon={FileText}>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{evento.observacoes}</p>
                </CardContent>
              </Card>
            </Section>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-fechar-evento">
            Fechar
          </Button>
          {onEdit && (
            <Button onClick={onEdit} data-testid="button-editar-evento-view">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
