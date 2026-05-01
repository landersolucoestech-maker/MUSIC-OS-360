import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface SharePendenteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: SharePendenteData) => void;
}

interface SharePendenteData {
  titulo_musica: string;
  artista: string;
  beneficiario: string;
  funcao: string;
  percentual: string;
  observacoes: string;
}

const funcaoOptions = [
  { value: "interprete", label: "Intérprete" },
  { value: "compositor", label: "Compositor" },
  { value: "produtor", label: "Produtor" },
  { value: "musico", label: "Músico" },
  { value: "arranjador", label: "Arranjador" },
  { value: "outro", label: "Outro" },
];

export function SharePendenteFormModal({ open, onOpenChange, onSubmit }: SharePendenteFormModalProps) {
  const [formData, setFormData] = useState<SharePendenteData>({
    titulo_musica: "",
    artista: "",
    beneficiario: "",
    funcao: "interprete",
    percentual: "",
    observacoes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof SharePendenteData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.titulo_musica.trim()) {
      toast.error("O título da música é obrigatório");
      return;
    }
    if (!formData.beneficiario.trim()) {
      toast.error("O nome do beneficiário é obrigatório");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
      toast.success("Share pendente registrado com sucesso!");
      setFormData({
        titulo_musica: "",
        artista: "",
        beneficiario: "",
        funcao: "interprete",
        percentual: "",
        observacoes: "",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao registrar share pendente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      titulo_musica: "",
      artista: "",
      beneficiario: "",
      funcao: "interprete",
      percentual: "",
      observacoes: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar Share Pendente</DialogTitle>
          <DialogDescription>
            Registre uma música que precisa receber share de algum participante
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="titulo_musica">Título da Música *</Label>
            <Input
              id="titulo_musica"
              placeholder="Ex: Nome da Música"
              value={formData.titulo_musica}
              onChange={(e) => handleChange("titulo_musica", e.target.value)}
              data-testid="input-titulo-musica"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="artista">Artista</Label>
            <Input
              id="artista"
              placeholder="Nome do artista"
              value={formData.artista}
              onChange={(e) => handleChange("artista", e.target.value)}
              data-testid="input-artista"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="beneficiario">Quem deve receber o share *</Label>
              <Input
                id="beneficiario"
                placeholder="Nome do participante"
                value={formData.beneficiario}
                onChange={(e) => handleChange("beneficiario", e.target.value)}
                data-testid="input-beneficiario"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="funcao">Função</Label>
              <Select value={formData.funcao} onValueChange={(value) => handleChange("funcao", value)}>
                <SelectTrigger data-testid="select-funcao">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  {funcaoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="percentual">Percentual do Share (%)</Label>
            <Input
              id="percentual"
              placeholder="Ex: 10.00"
              value={formData.percentual}
              onChange={(e) => handleChange("percentual", e.target.value)}
              data-testid="input-percentual"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações adicionais sobre o share pendente..."
              value={formData.observacoes}
              onChange={(e) => handleChange("observacoes", e.target.value)}
              rows={3}
              data-testid="textarea-observacoes"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={handleCancel} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            data-testid="button-registrar"
          >
            {isSubmitting ? "Registrando..." : "Registrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
