import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronDown, Loader2, Music2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConteudos, type ConteudoInsert, type Conteudo } from "@/hooks/useConteudos";
import { useLancamentos, type LancamentoWithRelations } from "@/hooks/useLancamentos";

const PLATAFORMA_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter" },
  { value: "linkedin", label: "LinkedIn" },
];

const TIPO_CONTEUDO_OPTIONS = [
  { value: "post", label: "Post" },
  { value: "stories", label: "Stories" },
  { value: "video", label: "Vídeo" },
  { value: "anuncio", label: "Anúncio" },
  { value: "carrossel", label: "Carrossel" },
  { value: "reels", label: "Reels" },
];

const FORMATO_OPTIONS = [
  { value: "imagem", label: "Imagem" },
  { value: "video", label: "Vídeo" },
  { value: "carrossel", label: "Carrossel" },
  { value: "texto", label: "Texto" },
  { value: "gif", label: "GIF" },
];

interface ConteudoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Conteudo | null;
  mode: "create" | "edit";
  tipo?: "post" | "stories" | "default";
}

export function ConteudoFormModal({ open, onOpenChange, initialData, mode, tipo = "default" }: ConteudoFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { addConteudo, updateConteudo } = useConteudos();
  const { lancamentos, isLoading: loadingLancamentos } = useLancamentos();

  const [titulo, setTitulo] = useState("");
  const [plataformas, setPlataformas] = useState<string[]>([]);
  const [tiposConteudo, setTiposConteudo] = useState<string[]>([]);
  const [formatos, setFormatos] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [campanhaRelacionada, setCampanhaRelacionada] = useState("");
  const [descricao, setDescricao] = useState("");
  const [legenda, setLegenda] = useState("");
  const [dataPublicacao, setDataPublicacao] = useState<Date | undefined>(undefined);
  const [horarioPublicacao, setHorarioPublicacao] = useState("");
  const [lancamentoId, setLancamentoId] = useState("");

  const toggleItem = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const getTitulo = () => {
    if (mode === "edit") return "Editar Conteúdo";
    if (tipo === "post") return "Criar Post";
    if (tipo === "stories") return "Criar Stories";
    return "Novo Conteúdo";
  };

  useEffect(() => {
    if (initialData && mode === "edit") {
      setTitulo(initialData.titulo || "");
      setPlataformas(initialData.plataforma || []);
      setTiposConteudo(initialData.tipo_conteudo || []);
      setFormatos(initialData.formato || []);
      setStatus(initialData.status || "");
      setCampanhaRelacionada(initialData.campanha_relacionada || "");
      setDescricao(initialData.descricao || "");
      setLegenda(initialData.legenda || "");
      setDataPublicacao(initialData.data_publicacao ? new Date(initialData.data_publicacao) : undefined);
      setHorarioPublicacao(initialData.horario_publicacao || "");
      setLancamentoId(initialData.lancamento_id || "");
    } else {
      setTitulo("");
      setPlataformas([]);
      setTiposConteudo(tipo === "post" ? ["post"] : tipo === "stories" ? ["stories"] : []);
      setFormatos([]);
      setStatus("");
      setCampanhaRelacionada("");
      setDescricao("");
      setLegenda("");
      setDataPublicacao(undefined);
      setHorarioPublicacao("");
      setLancamentoId("");
    }
  }, [initialData, mode, open, tipo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo) {
      toast.error("Preencha o título do conteúdo");
      return;
    }

    setIsLoading(true);

    try {
      const payload: ConteudoInsert = {
        titulo,
        plataforma: plataformas.length > 0 ? plataformas : null,
        tipo_conteudo: tiposConteudo.length > 0 ? tiposConteudo : null,
        formato: formatos.length > 0 ? formatos : null,
        status: status || "rascunho",
        campanha_relacionada: campanhaRelacionada || null,
        descricao: descricao || null,
        legenda: legenda || null,
        data_publicacao: dataPublicacao ? format(dataPublicacao, "yyyy-MM-dd") : null,
        horario_publicacao: horarioPublicacao || null,
        lancamento_id: lancamentoId || null,
      };

      if (mode === "edit" && initialData?.id) {
        await updateConteudo.mutateAsync({ id: initialData.id, ...payload });
      } else {
        await addConteudo.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar conteúdo");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case "planejado": return "Planejado";
      case "analise": return "Em Análise";
      case "aprovado": return "Aprovado";
      case "ativo": return "Ativo";
      case "programado": return "Programado";
      default: return s;
    }
  };

  const renderMultiSelect = (
    label: string,
    options: { value: string; label: string }[],
    selected: string[],
    setSelected: (v: string[]) => void,
    testId: string,
    placeholder: string,
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            data-testid={`dropdown-${testId}`}
          >
            {selected.length === 0
              ? placeholder
              : `${selected.length} selecionado${selected.length > 1 ? "s" : ""}`}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto" align="start">
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={selected.includes(opt.value)}
              onCheckedChange={() => toggleItem(selected, setSelected, opt.value)}
              onSelect={(e) => e.preventDefault()}
              data-testid={`dropdown-item-${testId}-${opt.value}`}
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((s) => {
            const optLabel = options.find((o) => o.value === s)?.label || s;
            return (
              <Badge
                key={s}
                variant="secondary"
                className="text-xs cursor-pointer"
                onClick={() => toggleItem(selected, setSelected, s)}
                data-testid={`badge-${testId}-${s}`}
              >
                {optLabel}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitulo()}</DialogTitle>
          <DialogDescription>Configure os detalhes do conteúdo de marketing</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título do Conteúdo *</Label>
            <Input
              id="titulo"
              data-testid="input-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Post de lançamento do novo single"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderMultiSelect("Plataforma", PLATAFORMA_OPTIONS, plataformas, setPlataformas, "plataforma", "Selecione as plataformas")}
            {renderMultiSelect("Tipo de Conteúdo", TIPO_CONTEUDO_OPTIONS, tiposConteudo, setTiposConteudo, "tipo-conteudo", "Selecione os tipos")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderMultiSelect("Formato", FORMATO_OPTIONS, formatos, setFormatos, "formato", "Selecione os formatos")}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={setStatus}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Music2 className="h-4 w-4" />
              Vincular a Lançamento (Faixa)
            </Label>
            <Select
              value={lancamentoId}
              onValueChange={(v) => setLancamentoId(v === "none" ? "" : v)}
            >
              <SelectTrigger data-testid="select-lancamento">
                <SelectValue placeholder="Selecione um lançamento (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {loadingLancamentos ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : (
                  lancamentos.map((lanc: LancamentoWithRelations) => (
                    <SelectItem key={lanc.id} value={lanc.id}>
                      {lanc.titulo}
                      {lanc.artistas?.nome_artistico ? ` — ${lanc.artistas.nome_artistico}` : ""}
                      {lanc.status ? ` (${getStatusLabel(lanc.status)})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Vincule a uma faixa da área de distribuição para rastrear performance</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campanhaRelacionada">Campanha Relacionada</Label>
            <Input
              id="campanhaRelacionada"
              data-testid="input-campanha"
              value={campanhaRelacionada}
              onChange={(e) => setCampanhaRelacionada(e.target.value)}
              placeholder="Nome da campanha (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição do Conteúdo</Label>
            <Textarea
              id="descricao"
              data-testid="input-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição detalhada do conteúdo"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legenda">Legenda / Copy</Label>
            <Textarea
              id="legenda"
              data-testid="input-legenda"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Texto que acompanhará a publicação"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Publicação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataPublicacao && "text-muted-foreground"
                    )}
                    data-testid="button-data-publicacao"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPublicacao ? (
                      format(dataPublicacao, "PPP", { locale: ptBR })
                    ) : (
                      "Selecione a data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataPublicacao}
                    onSelect={(date) => setDataPublicacao(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="horarioPublicacao">Horário de Publicação</Label>
              <Input
                id="horarioPublicacao"
                data-testid="input-horario"
                type="time"
                value={horarioPublicacao}
                onChange={(e) => setHorarioPublicacao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancelar">
              Cancelar
            </Button>
            <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={isLoading} data-testid="button-salvar">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Salvar Conteúdo" : "Atualizar Conteúdo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
