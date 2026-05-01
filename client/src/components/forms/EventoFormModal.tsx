import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormTextarea, FieldError } from "@/components/forms/FormField";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useClientes } from "@/hooks/useClientes";

interface EventoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: any;
  mode: "create" | "edit" | "view";
}

const tiposEvento = [
  { value: "sessoes_estudio", label: "Sessões de estúdio" },
  { value: "ensaios", label: "Ensaios" },
  { value: "sessoes_fotos", label: "Sessões de fotos" },
  { value: "shows", label: "Shows" },
  { value: "entrevistas", label: "Entrevistas" },
  { value: "podcasts", label: "Podcasts" },
  { value: "programas_tv", label: "Programas de TV" },
  { value: "radio", label: "Rádio" },
  { value: "producao_conteudo", label: "Produção de conteúdo" },
  { value: "reunioes", label: "Reuniões" },
];

const statusOptions = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "pendente", label: "Pendente" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

// Artistas serão carregados do banco de dados
const artistasOptions: { value: string; label: string }[] = [];

const tiposRelacionadosArtista = [
  "sessoes_estudio",
  "ensaios",
  "sessoes_fotos",
  "shows",
  "entrevistas",
  "podcasts",
  "programas_tv",
  "radio",
  "producao_conteudo",
];

// Tipos de evento que devem puxar o local do CRM
const tiposLocalCRM = ["shows", "programas_tv", "radio", "podcasts"];

export function EventoFormModal({ open, onOpenChange, evento, mode }: EventoFormModalProps) {
  const { clientes } = useClientes();
  
  // Filtrar apenas contatos PJ do CRM para o campo de local
  const locaisCRM = clientes.filter((c: any) => c.tipo_pessoa === "pessoa_juridica");
  
  const [formData, setFormData] = useState({
    titulo: evento?.titulo || "",
    tipoEvento: evento?.tipoEvento || "",
    artista: evento?.artista || "",
    status: evento?.status || "agendado",
    dataInicio: evento?.dataInicio ? new Date(evento.dataInicio) : undefined as Date | undefined,
    horarioInicio: evento?.horarioInicio || "",
    dataFim: evento?.dataFim ? new Date(evento.dataFim) : undefined as Date | undefined,
    horarioFim: evento?.horarioFim || "",
    nomeLocal: evento?.nomeLocal || "",
    endereco: evento?.endereco || "",
    contatoLocal: evento?.contatoLocal || "",
    capacidadePublico: evento?.capacidadePublico || "",
    valorCache: evento?.valorCache || "",
    publicoEsperado: evento?.publicoEsperado || "",
    descricao: evento?.descricao || "",
    observacoes: evento?.observacoes || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Evento na Agenda" : mode === "edit" ? "Editar Evento" : "Visualizar Evento";

  // Verificar se tipo de evento é relacionado a artista
  const isArtistaRelated = tiposRelacionadosArtista.includes(formData.tipoEvento);
  
  // Exibir campos de local quando for relacionado a artista OU reunião
  const showLocalFields = isArtistaRelated || formData.tipoEvento === "reunioes";
  
  // Exibir campos exclusivos de shows
  const isShow = formData.tipoEvento === "shows";
  
  // Verificar se o tipo de evento deve puxar local do CRM
  const shouldUseCRMLocal = tiposLocalCRM.includes(formData.tipoEvento);

  // Atualizar dados de contato quando selecionar um local do CRM
  const handleLocalCRMChange = (localId: string) => {
    const localSelecionado = locaisCRM.find(l => l.id === localId);
    if (localSelecionado) {
      setFormData({
        ...formData,
        nomeLocal: localId,
        contatoLocal: localSelecionado.telefone || "",
        endereco: [localSelecionado.endereco, localSelecionado.cidade, localSelecionado.estado].filter(Boolean).join(", ")
      });
    } else {
      setFormData({ ...formData, nomeLocal: localId });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = "Título é obrigatório";
    }
    if (!formData.tipoEvento) {
      newErrors.tipoEvento = "Tipo de evento é obrigatório";
    }
    if (!formData.dataInicio) {
      newErrors.dataInicio = "Data de início é obrigatória";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (!validate()) {
      toast.error("Por favor, corrija os erros no formulário");
      return;
    }

    setIsSubmitting(true);
    
    // Simular salvamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success(mode === "create" ? "Evento criado com sucesso!" : "Evento atualizado com sucesso!");
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const FieldError = ({ field }: { field: string }) => {
    if (!errors[field]) return null;
    return <span className="text-sm text-destructive mt-1">{errors[field]}</span>;
  };

  const getLocalPlaceholder = () => {
    if (formData.tipoEvento === "reunioes") {
      return "Nome do local da reunião";
    }
    return "Nome do venue / casa de show";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campos Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Título do Evento */}
            <div className="space-y-2 md:col-span-2">
              <Label>Título do Evento *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Digite o título do evento"
                disabled={isViewMode}
                className={errors.titulo ? "border-destructive" : ""}
              />
              <FieldError field="titulo" />
            </div>

            {/* Tipo de Evento */}
            <div className="space-y-2">
              <Label>Tipo de Evento *</Label>
              <Select 
                value={formData.tipoEvento} 
                onValueChange={(v) => setFormData({ ...formData, tipoEvento: v, artista: "" })} 
                disabled={isViewMode}
              >
                <SelectTrigger className={errors.tipoEvento ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposEvento.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError field="tipoEvento" />
            </div>

            {/* Artista - Condicional */}
            {isArtistaRelated && (
              <div className="space-y-2">
                <Label>Artista</Label>
                <Select 
                  value={formData.artista} 
                  onValueChange={(v) => setFormData({ ...formData, artista: v })} 
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um artista" />
                  </SelectTrigger>
                  <SelectContent>
                    {artistasOptions.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">Nenhum artista cadastrado</div>
                    ) : artistasOptions.map((artista) => (
                      <SelectItem key={artista.value} value={artista.value}>
                        {artista.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })} 
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datas e Horários */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data de Início */}
            <div className="space-y-2">
              <Label>Data de Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.dataInicio && "text-muted-foreground",
                      errors.dataInicio && "border-destructive"
                    )}
                    disabled={isViewMode}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dataInicio ? (
                      format(formData.dataInicio, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dataInicio}
                    onSelect={(date) => setFormData({ ...formData, dataInicio: date })}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <FieldError field="dataInicio" />
            </div>

            {/* Horário de Início */}
            <div className="space-y-2">
              <Label>Horário de Início</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={formData.horarioInicio}
                  onChange={(e) => setFormData({ ...formData, horarioInicio: e.target.value })}
                  disabled={isViewMode}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Data de Fim */}
            <div className="space-y-2">
              <Label>Data de Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.dataFim && "text-muted-foreground"
                    )}
                    disabled={isViewMode}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dataFim ? (
                      format(formData.dataFim, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data (opcional)</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dataFim}
                    onSelect={(date) => setFormData({ ...formData, dataFim: date })}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Horário de Fim */}
            <div className="space-y-2">
              <Label>Horário de Fim</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={formData.horarioFim}
                  onChange={(e) => setFormData({ ...formData, horarioFim: e.target.value })}
                  disabled={isViewMode}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Campos de Local - Condicional */}
          {showLocalFields && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Local</Label>
                {shouldUseCRMLocal ? (
                  <Select 
                    value={formData.nomeLocal} 
                    onValueChange={handleLocalCRMChange} 
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o local (CRM)" />
                    </SelectTrigger>
                    <SelectContent>
                      {locaisCRM.map((local) => (
                        <SelectItem key={local.id} value={local.id}>
                          {local.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.nomeLocal}
                    onChange={(e) => setFormData({ ...formData, nomeLocal: e.target.value })}
                    placeholder={getLocalPlaceholder()}
                    disabled={isViewMode}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Contato do Local</Label>
                <Input
                  value={formData.contatoLocal}
                  onChange={(e) => setFormData({ ...formData, contatoLocal: e.target.value })}
                  placeholder="Telefone / WhatsApp do local"
                  disabled={shouldUseCRMLocal || isViewMode}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Endereço Completo</Label>
                <Input
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Endereço completo do local"
                  disabled={shouldUseCRMLocal || isViewMode}
                />
              </div>
            </div>
          )}

          {/* Campos Exclusivos para Shows */}
          {isShow && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Capacidade do Público</Label>
                <Input
                  type="number"
                  value={formData.capacidadePublico}
                  onChange={(e) => setFormData({ ...formData, capacidadePublico: e.target.value })}
                  placeholder="Capacidade máxima do local"
                  disabled={isViewMode}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Valor do Cachê</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valorCache}
                    onChange={(e) => setFormData({ ...formData, valorCache: e.target.value })}
                    placeholder="0,00"
                    disabled={isViewMode}
                    className="pl-10"
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Público Esperado</Label>
                <Input
                  type="number"
                  value={formData.publicoEsperado}
                  onChange={(e) => setFormData({ ...formData, publicoEsperado: e.target.value })}
                  placeholder="Quantidade de pessoas esperadas"
                  disabled={isViewMode}
                  min="0"
                />
              </div>
            </div>
          )}

          {/* Descrição e Observações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do evento"
                rows={3}
                disabled={isViewMode}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o evento"
                rows={3}
                disabled={isViewMode}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            {!isViewMode && (
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar Evento"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
