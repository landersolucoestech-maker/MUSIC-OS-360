import { z } from "zod";

export const fonogramaSchema = z.object({
  title: z.string()
    .min(1, "Título do fonograma é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  isrc: z.string()
    .max(20, "ISRC deve ter no máximo 20 caracteres")
    .optional()
    .or(z.literal("")),
  durationText: z.string().optional().or(z.literal("")),
  genero: z.string().optional().or(z.literal("")),
  idioma: z.string().optional().or(z.literal("")),
  instrumental: z.boolean().default(false),
  criadaPorIA: z.boolean().default(false),
  pubSimultanea: z.boolean().default(false),
  aceitaTermos: z.boolean().default(false),
});

export type FonogramaFormData = z.infer<typeof fonogramaSchema>;
