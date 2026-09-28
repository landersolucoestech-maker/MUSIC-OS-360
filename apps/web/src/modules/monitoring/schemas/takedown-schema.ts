import { z } from "zod";

export const takedownSchema = z.object({
  title: z.string()
    .min(1, "Título é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  type: z.string().optional().or(z.literal("")),
  affectedWork: z.string().max(200, "Nome da obra deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  artistName: z.string().max(150, "Nome do artista deve ter no máximo 150 caracteres").optional().or(z.literal("")),
  platform: z.string()
    .min(1, "Plataforma é obrigatória"),
  infringingUrl: z.string()
    .max(500, "URL deve ter no máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
  reason: z.string()
    .min(1, "Motivo é obrigatório")
    .max(500, "Motivo deve ter no máximo 500 caracteres")
    .trim(),
  description: z.string()
    .max(2000, "Descrição deve ter no máximo 2000 caracteres")
    .optional()
    .or(z.literal("")),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  status: z.enum(["pending", "in_progress", "completed", "rejected"]).default("pending"),
  identifiedAt: z.string().optional().or(z.literal("")),
  evidence: z.string().max(2000, "Evidências devem ter no máximo 2000 caracteres").optional().or(z.literal("")),
  notes: z.string().max(2000, "Observações deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
});

export type TakedownFormData = z.infer<typeof takedownSchema>;
