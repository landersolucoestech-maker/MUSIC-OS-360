import { z } from "zod";

export const workSchema = z.object({
  title: z.string()
    .min(1, "Título da obra é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  musicGenre: z.string().optional().or(z.literal("")),
  /** ISO 639 code of `works.language` (varchar(10)). */
  language: z.string().max(10, "Idioma inválido").optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
  iswc: z.string().max(20, "ISWC inválido").optional().or(z.literal("")),
  ecadCode: z.string().max(50, "Código ECAD inválido").optional().or(z.literal("")),
  // Code at any collective management society (ABRAMUS, UBC, SOCINPRO, ...).
  societyCode: z.string().max(50, "Código inválido").optional().or(z.literal("")),
  durationMinutes: z.string().optional().or(z.literal("")),
  durationSeconds: z.string().optional().or(z.literal("")),
  isInstrumental: z.boolean().default(false),
  aiUsed: z.boolean().default(false),
  lyrics: z.string().optional().or(z.literal("")),
  termsAccepted: z.boolean().default(false),
}).strict();

export type WorkFormData = z.infer<typeof workSchema>;
