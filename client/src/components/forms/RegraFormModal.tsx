import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, FormTextarea, FieldError } from "@/components/forms/FormField";

interface Regra {
  id: number;
  keywords: string;
  category: string;
  type: string;
  origin: string;
}

interface RegraFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  regra?: Regra;
  onSave: (regra: Omit<Regra, "id" | "origin">) => void;
}

const regraFormSchema = z.object({
  category: z.string()
    .min(1, "Informe o nome da categoria")
    .max(50, "Categoria deve ter no máximo 50 caracteres")
    .trim(),
  type: z.enum(["Receita", "Despesa"], {
    errorMap: () => ({ message: "Selecione o tipo" })
  }),
  keywords: z.string()
    .min(1, "Informe pelo menos uma palavra-chave")
    .max(500, "Palavras-chave devem ter no máximo 500 caracteres")
    .trim(),
});

type RegraFormData = z.infer<typeof regraFormSchema>;

export function RegraFormModal({ open, onOpenChange, mode, regra, onSave }: RegraFormModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegraFormData>({
    resolver: zodResolver(regraFormSchema),
    mode: "onChange",
    defaultValues: {
      category: "",
      type: "Receita",
      keywords: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === "edit" && regra) {
        reset({
          category: regra.category,
          type: regra.type as "Receita" | "Despesa",
          keywords: regra.keywords,
        });
      } else {
        reset({
          category: "",
          type: "Receita",
          keywords: "",
        });
      }
    }
  }, [mode, regra, open, reset]);

  const onSubmit = (data: RegraFormData) => {
    onSave({
      category: data.category.trim(),
      type: data.type,
      keywords: data.keywords.trim(),
    });

    toast.success(`A regra "${data.category}" foi ${mode === "create" ? "criada" : "atualizada"} com sucesso.`);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova Regra" : "Editar Regra"}</DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Crie uma nova regra de categorização automática" 
              : "Edite as informações da regra de categorização"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Nome da Categoria"
            required
            placeholder="Ex: Streaming, Shows, Marketing..."
            {...register("category")}
            maxLength={50}
            error={errors.category?.message}
          />

          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo <span className="text-destructive">*</span></Label>
            <Select 
              value={watch("type")} 
              onValueChange={(v) => setValue("type", v as "Receita" | "Despesa", { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Receita">Receita</SelectItem>
                <SelectItem value="Despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <FieldError error={errors.type?.message} />
          </div>

          <FormTextarea
            label="Palavras-chave"
            required
            placeholder="Digite as palavras-chave separadas por vírgula. Ex: spotify, apple music, deezer"
            {...register("keywords")}
            rows={4}
            maxLength={500}
            error={errors.keywords?.message}
            description="Separe as palavras-chave por vírgula. Transações que contiverem essas palavras serão automaticamente categorizadas."
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : mode === "create" ? "Criar Regra" : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
