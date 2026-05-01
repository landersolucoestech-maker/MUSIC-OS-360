import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Save } from "lucide-react";
import { TemplateContrato } from "@/lib/template-contrato-types";
import { FileUpload, UploadedFile } from "@/components/shared/FileUpload";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, FieldError } from "@/components/forms/FormField";

interface Clausula {
  id: string;
  titulo: string;
  conteudo: string;
}

interface TemplateContratoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateContrato | null;
  onSave: (data: Omit<TemplateContrato, "id" | "dataCriacao" | "dataAtualizacao">) => void;
  tiposServico: string[];
}

const templateSchema = z.object({
  nome: z.string()
    .min(1, "Nome é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  tipoServico: z.string()
    .min(1, "Tipo de contrato é obrigatório"),
  ativo: z.boolean().default(true),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export function TemplateContratoFormModal({
  open,
  onOpenChange,
  template,
  onSave,
  tiposServico,
}: TemplateContratoFormModalProps) {
  const [imagemCabecalho, setImagemCabecalho] = useState<UploadedFile[]>([]);
  const [imagemRodape, setImagemRodape] = useState<UploadedFile[]>([]);
  const [clausulas, setClausulas] = useState<Clausula[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    mode: "onChange",
    defaultValues: {
      nome: "",
      tipoServico: "",
      ativo: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (template) {
        reset({
          nome: template.nome,
          tipoServico: template.tipoServico,
          ativo: template.ativo,
        });
        setClausulas(parseClausulasFromContent(template.conteudo));
      } else {
        reset({
          nome: "",
          tipoServico: "",
          ativo: true,
        });
        setImagemCabecalho([]);
        setImagemRodape([]);
        setClausulas([]);
      }
    }
  }, [template, open, reset]);

  const parseClausulasFromContent = (content: string): Clausula[] => {
    const lines = content.split('\n');
    const clausulasTemp: Clausula[] = [];
    let currentClausula: Clausula | null = null;

    for (const line of lines) {
      if (line.match(/^CLÁUSULA|^Cláusula|^\d+\./)) {
        if (currentClausula) {
          clausulasTemp.push(currentClausula);
        }
        currentClausula = {
          id: crypto.randomUUID(),
          titulo: line.trim(),
          conteudo: "",
        };
      } else if (currentClausula) {
        currentClausula.conteudo += line + "\n";
      }
    }

    if (currentClausula) {
      clausulasTemp.push(currentClausula);
    }

    return clausulasTemp.length > 0 ? clausulasTemp : [];
  };

  const handleAddClausula = () => {
    const novaClausula: Clausula = {
      id: crypto.randomUUID(),
      titulo: `CLÁUSULA ${clausulas.length + 1}ª`,
      conteudo: "",
    };
    setClausulas([...clausulas, novaClausula]);
  };

  const handleRemoveClausula = (id: string) => {
    setClausulas(clausulas.filter((c) => c.id !== id));
  };

  const handleClausulaChange = (id: string, field: "titulo" | "conteudo", value: string) => {
    setClausulas(
      clausulas.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const buildConteudo = (): string => {
    return clausulas
      .map((c) => `${c.titulo}\n${c.conteudo}`)
      .join("\n\n");
  };

  const extractVariaveis = (): string[] => {
    const conteudo = buildConteudo();
    const regex = /\{\{([A-Z_]+)\}\}/g;
    const matches = conteudo.matchAll(regex);
    const extracted = new Set<string>();
    for (const match of matches) {
      extracted.add(match[1]);
    }
    return Array.from(extracted);
  };

  const onSubmit = (data: TemplateFormData) => {
    onSave({
      nome: data.nome,
      tipoServico: data.tipoServico,
      descricao: "",
      conteudo: buildConteudo(),
      variaveis: extractVariaveis(),
      ativo: data.ativo,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar Template de Contrato" : "Novo Template de Contrato"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h3 className="font-medium text-foreground">Informações Básicas</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Nome do Template"
                required
                {...register("nome")}
                placeholder="Ex: Contrato de Agenciamento Artístico"
                error={errors.nome?.message}
              />
              <div className="space-y-1.5">
                <Label htmlFor="tipoServico">Tipo de Contrato <span className="text-destructive">*</span></Label>
                <Select 
                  value={watch("tipoServico")} 
                  onValueChange={(v) => setValue("tipoServico", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposServico.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError error={errors.tipoServico?.message} />
              </div>
            </div>
          </div>

          {/* Cabeçalho e Rodapé */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h3 className="font-medium text-foreground">Cabeçalho e Rodapé</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Imagem do Cabeçalho (Logo)</Label>
                <FileUpload
                  folder="templates/cabecalho"
                  accept="image/*"
                  maxSize={5}
                  value={imagemCabecalho}
                  onChange={setImagemCabecalho}
                />
              </div>
              <div className="space-y-2">
                <Label>Imagem do Rodapé</Label>
                <FileUpload
                  folder="templates/rodape"
                  accept="image/*"
                  maxSize={5}
                  value={imagemRodape}
                  onChange={setImagemRodape}
                />
              </div>
            </div>
          </div>

          {/* Cláusulas */}
          <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">Cláusulas</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddClausula}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Cláusula
              </Button>
            </div>

            {clausulas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma cláusula adicionada. Clique em "Adicionar Cláusula" para começar.
              </div>
            ) : (
              <div className="space-y-4">
                {clausulas.map((clausula, index) => (
                  <div key={clausula.id} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">☰</span>
                        <span className="font-medium">Cláusula {index + 1}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveClausula(clausula.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={clausula.titulo}
                        onChange={(e) => handleClausulaChange(clausula.id, "titulo", e.target.value)}
                        placeholder="Ex: DO OBJETO"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Conteúdo</Label>
                      <Textarea
                        value={clausula.conteudo}
                        onChange={(e) => handleClausulaChange(clausula.id, "conteudo", e.target.value)}
                        placeholder="Texto da cláusula... Use {{variavel}} para campos dinâmicos."
                        rows={4}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Variáveis disponíveis: {"{{contracted_name}}"}, {"{{royalties_percentage}}"}, {"{{start_date}}"}, {"{{end_date}}"}, {"{{fixed_value}}"}, {"{{advance_amount}}"}, {"{{financial_support}}"}, {"{{work_title}}"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={isSubmitting}>
              <Save className="h-4 w-4" />
              {isSubmitting ? "Salvando..." : "Salvar Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
