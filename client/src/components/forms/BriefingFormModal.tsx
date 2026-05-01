import { useState, useEffect, KeyboardEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormTextarea } from "@/components/forms/FormField";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BriefingFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  mode: "create" | "edit";
}

export function BriefingFormModal({ open, onOpenChange, initialData, mode }: BriefingFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    campanhaRelacionada: "",
    prioridade: "",
    status: "",
    budget: "",
    prazoEntrega: undefined as Date | undefined,
    objetivo: "",
    publicoAlvo: "",
    descricao: "",
  });
  const [entregaveis, setEntregaveis] = useState<string[]>([]);
  const [novoEntregavel, setNovoEntregavel] = useState("");

  useEffect(() => {
    if (initialData && mode === "edit") {
      setFormData({
        titulo: initialData.titulo || "",
        campanhaRelacionada: initialData.campanhaRelacionada || "",
        prioridade: initialData.prioridade || "",
        status: initialData.status || "",
        budget: initialData.budget || "",
        prazoEntrega: initialData.prazoEntrega ? new Date(initialData.prazoEntrega) : undefined,
        objetivo: initialData.objetivo || "",
        publicoAlvo: initialData.publicoAlvo || "",
        descricao: initialData.descricao || "",
      });
      setEntregaveis(initialData.entregaveis || []);
    } else {
      setFormData({
        titulo: "",
        campanhaRelacionada: "",
        prioridade: "",
        status: "",
        budget: "",
        prazoEntrega: undefined,
        objetivo: "",
        publicoAlvo: "",
        descricao: "",
      });
      setEntregaveis([]);
    }
  }, [initialData, mode, open]);

  const handleAddEntregavel = () => {
    if (novoEntregavel.trim()) {
      setEntregaveis([...entregaveis, novoEntregavel.trim()]);
      setNovoEntregavel("");
    }
  };

  const handleRemoveEntregavel = (index: number) => {
    setEntregaveis(entregaveis.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEntregavel();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.campanhaRelacionada || !formData.prioridade || 
        !formData.status || !formData.prazoEntrega || !formData.objetivo || !formData.publicoAlvo) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(mode === "create" ? "Briefing criado com sucesso!" : "Briefing atualizado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar briefing");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Briefing de Marketing" : "Editar Briefing"}</DialogTitle>
          <DialogDescription>Defina os detalhes e diretrizes do projeto de marketing</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Linha 1 - Título e Campanha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título do Briefing *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Campanha de Lançamento do Álbum"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campanha">Campanha Relacionada *</Label>
              <Input
                id="campanha"
                value={formData.campanhaRelacionada}
                onChange={(e) => setFormData({ ...formData, campanhaRelacionada: e.target.value })}
                placeholder="Nome da campanha"
                required
              />
            </div>
          </div>

          {/* Linha 2 - Prioridade, Status e Budget */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prioridade *</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(v) => setFormData({ ...formData, prioridade: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-priority-high" />
                      Alta
                    </span>
                  </SelectItem>
                  <SelectItem value="media">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-priority-medium" />
                      Média
                    </span>
                  </SelectItem>
                  <SelectItem value="baixa">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-priority-low" />
                      Baixa
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_revisao">Em Revisão</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (R$)</Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Linha 3 - Prazo de Entrega */}
          <div className="space-y-2">
            <Label>Prazo de Entrega *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.prazoEntrega && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.prazoEntrega ? (
                    format(formData.prazoEntrega, "PPP", { locale: ptBR })
                  ) : (
                    "Selecione a data"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.prazoEntrega}
                  onSelect={(date) => setFormData({ ...formData, prazoEntrega: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Campos de texto longo */}
          <div className="space-y-2">
            <Label htmlFor="objetivo">Objetivo do Projeto *</Label>
            <Textarea
              id="objetivo"
              value={formData.objetivo}
              onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
              placeholder="Descreva o objetivo principal do projeto"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="publicoAlvo">Público-Alvo *</Label>
            <Textarea
              id="publicoAlvo"
              value={formData.publicoAlvo}
              onChange={(e) => setFormData({ ...formData, publicoAlvo: e.target.value })}
              placeholder="Defina o público-alvo do projeto"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição Detalhada</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição detalhada do briefing"
              rows={4}
            />
          </div>

          {/* Entregáveis */}
          <div className="space-y-2">
            <Label>Entregáveis</Label>
            <div className="flex gap-2">
              <Input
                value={novoEntregavel}
                onChange={(e) => setNovoEntregavel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite um entregável e pressione Enter"
              />
              <Button type="button" onClick={handleAddEntregavel} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {entregaveis.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {entregaveis.map((item, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveEntregavel(index)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Criar Briefing" : "Atualizar Briefing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
