import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormTextarea } from "@/components/forms/FormField";
import { toast } from "sonner";
import { AlertTriangle, Link2, Music, Calendar, FileText } from "lucide-react";

interface TakedownFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  takedown?: any;
  mode: "create" | "edit" | "view";
}

const plataformas = ["YouTube", "Spotify", "Apple Music", "Deezer", "SoundCloud", "TikTok", "Instagram", "Facebook", "Twitter/X", "Outra"];
const motivos = ["Uso não autorizado", "Violação de direitos autorais", "Plágio", "Sample não autorizado", "Distribuição ilegal", "Outro"];
const tiposTakedown = ["Enviado por nós", "Recebido (Claim)"];
const prioridades = ["Alta", "Média", "Baixa"];

export function TakedownFormModal({ open, onOpenChange, takedown, mode }: TakedownFormModalProps) {
  const [formData, setFormData] = useState({
    titulo: takedown?.titulo || "",
    tipo: takedown?.tipo || "enviado",
    obraAfetada: takedown?.obraAfetada || "",
    artista: takedown?.artista || "",
    plataforma: takedown?.plataforma || "",
    urlInfratora: takedown?.urlInfratora || "",
    motivo: takedown?.motivo || "",
    descricao: takedown?.descricao || "",
    prioridade: takedown?.prioridade || "media",
    dataIdentificacao: takedown?.dataIdentificacao || new Date().toISOString().split("T")[0],
    evidencias: takedown?.evidencias || "",
    observacoes: takedown?.observacoes || "",
  });

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Registrar Takedown" : mode === "edit" ? "Editar Takedown" : "Detalhes do Takedown";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (!formData.titulo || !formData.plataforma || !formData.motivo) {
      toast.error("Preencha os campos obrigatórios!");
      return;
    }

    toast.success(mode === "create" ? "Takedown registrado com sucesso!" : "Takedown atualizado com sucesso!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Informações do Takedown
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título/Identificação *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  disabled={isViewMode}
                  placeholder="Identificação do takedown"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })} disabled={isViewMode}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enviado">Enviado por nós</SelectItem>
                    <SelectItem value="recebido">Recebido (Claim)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Obra Afetada</Label>
                <Input
                  value={formData.obraAfetada}
                  onChange={(e) => setFormData({ ...formData, obraAfetada: e.target.value })}
                  disabled={isViewMode}
                  placeholder="Nome da obra"
                />
              </div>
              <div className="space-y-2">
                <Label>Artista</Label>
                <Input
                  value={formData.artista}
                  onChange={(e) => setFormData({ ...formData, artista: e.target.value })}
                  disabled={isViewMode}
                  placeholder="Nome do artista"
                />
              </div>
            </div>
          </div>

          {/* Plataforma e URL */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Plataforma e Localização
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plataforma *</Label>
                <Select value={formData.plataforma} onValueChange={(v) => setFormData({ ...formData, plataforma: v })} disabled={isViewMode}>
                  <SelectTrigger><SelectValue placeholder="Selecione a plataforma" /></SelectTrigger>
                  <SelectContent>
                    {plataformas.map(p => <SelectItem key={p} value={p.toLowerCase().replace(/ /g, "_")}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })} disabled={isViewMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>URL do Conteúdo Infrator</Label>
              <Input
                value={formData.urlInfratora}
                onChange={(e) => setFormData({ ...formData, urlInfratora: e.target.value })}
                disabled={isViewMode}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Motivo e Descrição */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Motivo e Descrição
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Select value={formData.motivo} onValueChange={(v) => setFormData({ ...formData, motivo: v })} disabled={isViewMode}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    {motivos.map(m => <SelectItem key={m} value={m.toLowerCase().replace(/ /g, "_")}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Identificação</Label>
                <Input
                  type="date"
                  value={formData.dataIdentificacao}
                  onChange={(e) => setFormData({ ...formData, dataIdentificacao: e.target.value })}
                  disabled={isViewMode}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição Detalhada</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                disabled={isViewMode}
                placeholder="Descreva detalhadamente a infração..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Evidências/Links de Prova</Label>
              <Textarea
                value={formData.evidencias}
                onChange={(e) => setFormData({ ...formData, evidencias: e.target.value })}
                disabled={isViewMode}
                placeholder="Links para evidências, screenshots, etc..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                disabled={isViewMode}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {mode === "create" ? "Registrar Takedown" : "Salvar Alterações"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
