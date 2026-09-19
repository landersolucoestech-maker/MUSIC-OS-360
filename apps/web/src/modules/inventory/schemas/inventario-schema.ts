import { z } from "zod";

export const inventarioSchema = z.object({
  name: z.string()
    .min(1, "Nome é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  category: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  quantidade: z.number()
    .min(1, "Quantidade mínima é 1")
    .optional()
    .nullable(),
  localizacao: z.string()
    .max(200, "Localização deve ter no máximo 200 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["disponivel", "em_uso", "emprestado", "manutencao", "danificado", "descartado"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  valor_unitario: z.number()
    .min(0, "Valor não pode ser negativo")
    .optional()
    .nullable(),
  observacoes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type InventarioFormData = z.infer<typeof inventarioSchema>;
