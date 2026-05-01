import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormTextarea } from "@/components/forms/FormField";
import { toast } from "sonner";
import { FileText, Music, DollarSign, Calendar, Building } from "lucide-react";

interface LicencaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenca?: any;
  mode: "create" | "edit" | "view";
}

const tiposLicenca = ["Sync TV", "Sync Cinema", "Sync Publicidade", "Sync Games", "Sync Digital", "Master Use", "Mecânica"];
const midiasDestino = ["TV Aberta", "TV Fechada", "Cinema", "Streaming", "Redes Sociais", "Publicidade Digital", "Games", "Outro"];
const territorios = ["Brasil", "América Latina", "Mundial", "Estados Unidos", "Europa", "Ásia"];

export function LicencaFormModal({ open, onOpenChange, licenca, mode }: LicencaFormModalProps) {
  const [formData, setFormData] = useState({
    titulo: licenca?.titulo || "",
    tipoLicenca: licenca?.tipoLicenca || "",
    obraMusical: licenca?.obraMusical || "",
    artista: licenca?.artista || "",
    cliente: licenca?.cliente || "",
    projeto: licenca?.projeto || "",
    midiaDestino: licenca?.midiaDestino || "",
    territorio: licenca?.territorio || "",
    dataInicio: licenca?.dataInicio || "",
    dataFim: licenca?.dataFim || "",
    valor: licenca?.valor || "",
    moeda: licenca?.moeda || "BRL",
    observacoes: licenca?.observacoes || "",
  });

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Nova Licença de Sync" : mode === "edit" ? "Editar Licença" : "Detalhes da Licença";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    if (!formData.titulo || !formData.obraMusical || !formData.cliente) {
      toast.error("Preencha os campos obrigatórios!");
      return;
    }

    toast.success(mode === "create" ? "Licença criada com sucesso!" : "Licença atualizada com sucesso!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Music className="h-4 w-4" /> Informações da Licença
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título da Licença *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  disabled={isViewMode}
                  placeholder="Nome/Título da licença"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Licença *</Label>
                <Select value={formData.tipoLicenca} onValueChange={(v) => setFormData({ ...formData, tipoLicenca: v })} disabled={isViewMode}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    {tiposLicenca.map(tipo => <SelectItem key={tipo} value={tipo.toLowerCase().replace(/ /g, "_")}>{tipo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Obra Musical *</Label>
                <Input
                  value={formData.obraMusical}
                  onChange={(e) => setFormData({ ...formData, obraMusical: e.target.value })}
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

          {/* Cliente e Projeto */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" /> Cliente e Projeto
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Input
                  value={formData.cliente}
                  onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                  disabled={isViewMode}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Input
                  value={formData.projeto}
                  onChange={(e) => setFormData({ ...formData, projeto: e.target.value })}
                  disabled={isViewMode}
                  placeholder="Nome do projeto/campanha"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mídia de Destino</Label>
                <Select value={formData.midiaDestino} onValueChange={(v) => setFormData({ ...formData, midiaDestino: v })} disabled={isViewMode}>
                  <SelectTrigger><SelectValue placeholder="Selecione a mídia" /></SelectTrigger>
                  <SelectContent>
                    {midiasDestino.map(midia => <SelectItem key={midia} value={midia.toLowerCase().replace(/ /g, "_")}>{midia}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Território</Label>
                <Select value={formData.territorio} onValueChange={(v) => setFormData({ ...formData, territorio: v })} disabled={isViewMode}>
                  <SelectTrigger><SelectValue placeholder="Selecione o território" /></SelectTrigger>
                  <SelectContent>
                    {territorios.map(t => <SelectItem key={t} value={t.toLowerCase().replace(/ /g, "_")}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Período e Valor */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Período e Valor
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={formData.dataInicio}
                  onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                  disabled={isViewMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={formData.dataFim}
                  onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                  disabled={isViewMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <div className="flex gap-2">
                  <Select value={formData.moeda} onValueChange={(v) => setFormData({ ...formData, moeda: v })} disabled={isViewMode}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">R$</SelectItem>
                      <SelectItem value="USD">US$</SelectItem>
                      <SelectItem value="EUR">€</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    disabled={isViewMode}
                    placeholder="0,00"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              disabled={isViewMode}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isViewMode ? "Fechar" : "Cancelar"}
            </Button>
            {!isViewMode && (
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {mode === "create" ? "Criar Licença" : "Salvar Alterações"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
