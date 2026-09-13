import { z } from "zod";

export const takedownSchema = z.object({
  title: z.string()
    .min(1, "Título é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  type: z.string().optional().or(z.literal("")),
  obraAfetada: z.string().max(200, "Nome da obra deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  artista: z.string().max(150, "Nome do artista deve ter no máximo 150 caracteres").optional().or(z.literal("")),
  plataforma: z.string()
    .min(1, "Plataforma é obrigatória"),
  urlInfratora: z.string()
    .max(500, "URL deve ter no máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
  motivo: z.string()
    .min(1, "Motivo é obrigatório")
    .max(500, "Motivo deve ter no máximo 500 caracteres")
    .trim(),
  descricao: z.string()
    .max(2000, "Descrição deve ter no máximo 2000 caracteres")
    .optional()
    .or(z.literal("")),
  prioridade: z.enum(["alta", "media", "baixa"]).default("media"),
  status: z.enum(["pending", "in_progress", "completed", "rejected"]).default("pending"),
  dataIdentificacao: z.string().optional().or(z.literal("")),
  evidencias: z.string().max(2000, "Evidências devem ter no máximo 2000 caracteres").optional().or(z.literal("")),
  observacoes: z.string().max(2000, "Observações deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
});

export type TakedownFormData = z.infer<typeof takedownSchema>;
