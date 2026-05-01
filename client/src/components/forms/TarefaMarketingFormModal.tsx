import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TarefaMarketingFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  mode: "create" | "edit";
}

export function TarefaMarketingFormModal({ open, onOpenChange, initialData, mode }: TarefaMarketingFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    campanhaRelacionada: "",
    responsavel: "",
    prioridade: "",
    status: "",
    categoria: "",
    dataEntrega: undefined as Date | undefined,
  });

  useEffect(() => {
    if (initialData && mode === "edit") {
      setFormData({
        titulo: initialData.titulo || "",
        descricao: initialData.descricao || "",
        campanhaRelacionada: initialData.campanhaRelacionada || "",
        responsavel: initialData.responsavel || "",
        prioridade: initialData.prioridade || "",
        status: initialData.status || "",
        categoria: initialData.categoria || "",
        dataEntrega: initialData.dataEntrega ? new Date(initialData.dataEntrega) : undefined,
      });
    } else {
      setFormData({
        titulo: "",
        descricao: "",
        campanhaRelacionada: "",
        responsavel: "",
        prioridade: "",
        status: "",
        categoria: "",
        dataEntrega: undefined,
      });
    }
  }, [initialData, mode, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.dataEntrega) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(mode === "create" ? "Tarefa criada com sucesso!" : "Tarefa atualizada com sucesso!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar tarefa");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova Tarefa de Marketing" : "Editar Tarefa"}</DialogTitle>
          <DialogDescription>Configure os detalhes da tarefa de marketing</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título da Tarefa *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Criar arte para Instagram"
              required
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição detalhada da tarefa"
              rows={4}
            />
          </div>

          {/* Linha 1 - Campanha e Responsável */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="campanhaRelacionada">Campanha Relacionada</Label>
              <Input
                id="campanhaRelacionada"
                value={formData.campanhaRelacionada}
                onChange={(e) => setFormData({ ...formData, campanhaRelacionada: e.target.value })}
                placeholder="Nome da campanha (opcional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={formData.responsavel}
                onValueChange={(v) => setFormData({ ...formData, responsavel: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copywriting">Copywriting</SelectItem>
                  <SelectItem value="creative_director">Creative Director</SelectItem>
                  <SelectItem value="design_team">Design Team</SelectItem>
                  <SelectItem value="marketing_team">Marketing Team</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="video_team">Video Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2 - Prioridade, Status e Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
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
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="atrasada">Atrasada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(v) => setFormData({ ...formData, categoria: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="publicidade">Publicidade</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="copywriting">Copywriting</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data de Entrega */}
          <div className="space-y-2">
            <Label>Data de Entrega *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.dataEntrega && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.dataEntrega ? (
                    format(formData.dataEntrega, "PPP", { locale: ptBR })
                  ) : (
                    "Selecione a data"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.dataEntrega}
                  onSelect={(date) => setFormData({ ...formData, dataEntrega: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Criar Tarefa" : "Atualizar Tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
