import { z } from "zod";

export const projectSchema = z.object({
  releaseType: z.string()
    .min(1, "Tipo de lançamento é obrigatório"),
  epName: z.string()
    .max(200, "Título deve ter no máximo 200 caracteres")
    .optional()
    .or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
  notes: z.string()
    .max(2000, "Observações deve ter no máximo 2000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type ProjectFormData = z.infer<typeof projectSchema>;
