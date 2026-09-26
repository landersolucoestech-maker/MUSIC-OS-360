import { z } from "zod";

export const obraSchema = z.object({
  tituloObra: z.string()
    .min(1, "Título da obra é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  generoMusical: z.string().optional().or(z.literal("")),
  idioma: z.string().optional().or(z.literal("")),
  situacao: z.string().optional().or(z.literal("")),
  iswc: z.string().max(20, "ISWC inválido").optional().or(z.literal("")),
  codEcad: z.string().max(50, "Código ECAD inválido").optional().or(z.literal("")),
  // Renamed from codAbramus — code at any collective management society
  // (ABRAMUS, UBC, SOCINPRO, ...), not only ABRAMUS.
  codEntidade: z.string().max(50, "Código inválido").optional().or(z.literal("")),
  duracaoMin: z.string().optional().or(z.literal("")),
  duracaoSeg: z.string().optional().or(z.literal("")),
  instrumental: z.enum(["sim", "nao"]).default("nao"),
  criadaPorIA: z.union([z.boolean(), z.enum(["sim", "nao"])]).default(false),
  letraCompleta: z.string().optional().or(z.literal("")),
  aceitaTermos: z.boolean().default(false),
}).strict();

export type ObraFormData = z.infer<typeof obraSchema>;
