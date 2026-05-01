import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCampanhas } from "@/hooks/useCampanhas";
import { useArtistas } from "@/hooks/useArtistas";
import { useLancamentos } from "@/hooks/useLancamentos";
import { 
  Facebook, 
  Instagram, 
  Music2,
  Play,
  Target,
  ChevronDown,
  Minus,
  Plus,
  Sparkles,
  MapPin,
  Image
} from "lucide-react";

interface CampanhaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  mode: "create" | "edit";
}

const PLATAFORMAS = [
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "tiktok", label: "TikTok", icon: Play },
  { id: "spotify", label: "Spotify Ad Studio", icon: Music2 },
  { id: "youtube", label: "YouTube Ads", icon: Play },
  { id: "google", label: "Google Ads", icon: Target },
];

const OBJETIVOS = [
  { value: "awareness", label: "Awareness" },
  { value: "engagement", label: "Engajamento" },
  { value: "traffic", label: "Tráfego" },
  { value: "conversions", label: "Conversões" },
  { value: "leads", label: "Leads" },
];

const STATUS_OPTIONS = [
  { value: "planejada", label: "Planejada" },
  { value: "ativa", label: "Ativa" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluída" },
  { value: "rascunho", label: "Rascunho" },
];

export const CampanhaFormModal = ({ open, onOpenChange, initialData, mode }: CampanhaFormModalProps) => {
  const { addCampanha, updateCampanha } = useCampanhas();
  const { artistas } = useArtistas();
  const { lancamentos } = useLancamentos();
  
  // Form state
  const [nome, setNome] = useState("");
  const [artistaId, setArtistaId] = useState("");
  const [lancamentoId, setLancamentoId] = useState("");
  const [plataformasSelecionadas, setPlataformasSelecionadas] = useState<string[]>([]);
  const [orcamentoDiario, setOrcamentoDiario] = useState(10);
  const [duracao, setDuracao] = useState(7);
  const [objetivo, setObjetivo] = useState("");
  const [status, setStatus] = useState("planejada");
  const [observacoes, setObservacoes] = useState("");
  
  // Collapsible sections
  const [engajamentoOpen, setEngajamentoOpen] = useState(false);
  const [segmentacaoOpen, setSegmentacaoOpen] = useState(false);
  const [criativosOpen, setCriativosOpen] = useState(false);

  // Calculate total
  const total = orcamentoDiario * duracao;

  // Filter lancamentos by selected artist
  const lancamentosFiltrados = artistaId 
    ? lancamentos.filter((l: any) => l.artista_id === artistaId)
    : lancamentos;

  useEffect(() => {
    if (initialData && mode === "edit") {
      setNome(initialData.nome || "");
      setArtistaId(initialData.artista_id || "");
      setStatus(initialData.status || "planejada");
      setOrcamentoDiario(initialData.orcamento || 10);
      setObservacoes(initialData.observacoes || "");
      // Parse plataforma string to array if needed
      if (initialData.plataforma) {
        setPlataformasSelecionadas(initialData.plataforma.split(",").map((p: string) => p.trim()));
      }
    } else if (mode === "create") {
      resetForm();
    }
  }, [initialData, mode, open]);

  const resetForm = () => {
    setNome("");
    setArtistaId("");
    setLancamentoId("");
    setPlataformasSelecionadas([]);
    setOrcamentoDiario(10);
    setDuracao(7);
    setObjetivo("");
    setStatus("planejada");
    setObservacoes("");
  };

  const togglePlataforma = (plataformaId: string) => {
    setPlataformasSelecionadas(prev => 
      prev.includes(plataformaId)
        ? prev.filter(p => p !== plataformaId)
        : [...prev, plataformaId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      nome,
      artista_id: artistaId || null,
      plataforma: plataformasSelecionadas.join(", ") || null,
      status,
      orcamento: total,
      gasto: 0,
      observacoes: observacoes || null,
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date(Date.now() + duracao * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    if (mode === "edit" && initialData?.id) {
      updateCampanha.mutate({ id: initialData.id, ...data }, {
        onSuccess: () => {
          toast.success("Campanha atualizada com sucesso.");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Não foi possível atualizar a campanha.");
        }
      });
    } else {
      addCampanha.mutate(data, {
        onSuccess: () => {
          toast.success("Campanha criada com sucesso.");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Não foi possível criar a campanha.");
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex">
          {/* Left side - Form */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[90vh]">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-semibold">
                {mode === "edit" ? "Editar Campanha" : "Nova Campanha"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome da Campanha */}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Campanha *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Lançamento Single 2024"
                  required
                  className="bg-background"
                />
              </div>

              {/* Artista e Lançamento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Artista</Label>
                  <Select value={artistaId} onValueChange={setArtistaId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {artistas.map((artista: any) => (
                        <SelectItem key={artista.id} value={artista.id}>
                          {artista.nome_artistico}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Lançamento</Label>
                  <Select value={lancamentoId} onValueChange={setLancamentoId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione um artista..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lancamentosFiltrados.map((lancamento: any) => (
                        <SelectItem key={lancamento.id} value={lancamento.id}>
                          {lancamento.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Plataformas de Anúncio */}
              <div className="space-y-3">
                <Label>Plataformas de Anúncio</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATAFORMAS.map((plataforma) => {
                    const Icon = plataforma.icon;
                    const isSelected = plataformasSelecionadas.includes(plataforma.id);
                    return (
                      <Button
                        key={plataforma.id}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "gap-2",
                          isSelected && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => togglePlataforma(plataforma.id)}
                      >
                        <Icon className="h-4 w-4" />
                        {plataforma.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Orçamento e Duração */}
              <div className="border border-border rounded-lg p-4 space-y-6">
                {/* Orçamento Diário */}
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Orçamento diário</span>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setOrcamentoDiario(Math.max(1, orcamentoDiario - 5))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-2xl font-bold min-w-[100px] text-center">
                        R$ {orcamentoDiario}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setOrcamentoDiario(orcamentoDiario + 5)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Slider
                    value={[orcamentoDiario]}
                    onValueChange={(value) => setOrcamentoDiario(value[0])}
                    min={1}
                    max={500}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Duração */}
                <div className="space-y-2">
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Duração</span>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setDuracao(Math.max(1, duracao - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-2xl font-bold min-w-[100px] text-center">
                        {duracao} dias
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setDuracao(duracao + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      R$ {total} / {duracao} dias
                    </p>
                  </div>
                </div>
              </div>

              {/* Objetivo e Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select value={objetivo} onValueChange={setObjetivo}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {OBJETIVOS.map((obj) => (
                        <SelectItem key={obj.value} value={obj.value}>
                          {obj.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Collapsible Sections */}
              <div className="space-y-2">
                <Collapsible open={engajamentoOpen} onOpenChange={setEngajamentoOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Engajamento de Fãs</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", engajamentoOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="py-4">
                    <p className="text-sm text-muted-foreground">Configurações de engajamento...</p>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={segmentacaoOpen} onOpenChange={setSegmentacaoOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Segmentação Geográfica</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", segmentacaoOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="py-4">
                    <p className="text-sm text-muted-foreground">Configurações de segmentação...</p>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={criativosOpen} onOpenChange={setCriativosOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Criativos de Anúncio</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", criativosOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="py-4">
                    <p className="text-sm text-muted-foreground">Upload de criativos...</p>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="observacoes">Descrição</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações da campanha"
                  rows={3}
                  className="bg-background"
                />
              </div>
            </form>
          </div>

          {/* Right side - Summary */}
          <div className="w-72 bg-muted/30 border-l border-border p-6 flex flex-col">
            <h3 className="font-semibold text-lg mb-6">Resumo da Campanha</h3>
            
            <div className="space-y-4 flex-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plataformas</span>
                <span className="font-medium">{plataformasSelecionadas.length} selecionadas</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orçamento diário</span>
                <span className="font-medium">R$ {orcamentoDiario}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duração</span>
                <span className="font-medium">{duracao} dias</span>
              </div>
              
              <div className="border-t border-border pt-4 mt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Total</span>
                  <span className="text-xl font-bold">R$ {total}</span>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full mt-6 bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
            >
              {mode === "edit" ? "Atualizar Campanha" : "Criar Campanha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
