import { z } from "zod";

const percentageField = z
  .string()
  .refine(
    (v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 100),
    { message: "Percentual deve ser entre 0 e 100" },
  )
  .optional()
  .or(z.literal(""));

const valueField = z
  .string()
  .refine(
    (v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
    { message: "Valor deve ser um número positivo" },
  )
  .optional()
  .or(z.literal(""));

/**
 * Unified share with the `share_type` discriminator:
 *  - internal_release → link to an internal release (release + participant + percentage);
 *  - external_receivable → receivable from an external song (song + company link + percentage),
 *    does NOT require a release.
 */
export const shareSchema = z
  .object({
    share_type: z.enum(["internal_release", "external_receivable"]).default("internal_release"),
    // Internal
    release_id: z.string().optional().or(z.literal("")),
    holder: z.string().max(150, "Detentor deve ter no máximo 150 caracteres").optional().or(z.literal("")),
    recipient: z.string().max(150).optional().or(z.literal("")),
    funcao: z.enum(["compositor", "interprete", "produtor", "editora", "gravadora", "empresario", "outro"]).optional(),
    // External
    music_title: z.string().max(200, "Nome deve ter no máximo 200 caracteres").optional().or(z.literal("")),
    artista_externo: z.string().max(150).optional().or(z.literal("")),
    artista_project_id: z.string().optional().or(z.literal("")),
    pagador: z.string().max(150).optional().or(z.literal("")),
    pagador_contato: z.string().max(200).optional().or(z.literal("")),
    origem_acordo: z.string().max(300).optional().or(z.literal("")),
    data_prevista: z.string().optional().or(z.literal("")),
    documents: z.string().max(500).optional().or(z.literal("")),
    // Common
    percentage: percentageField,
    valor_total: valueField,
    status: z.enum(["pendente", "parcial", "enviado", "aceito", "recebido", "recusado", "erro", "cancelado"]).default("pendente"),
    acordo_notas: z.string().max(2000, "Notas devem ter no máximo 2000 caracteres").optional().or(z.literal("")),
    acordo_url: z.string().max(500, "URL deve ter no máximo 500 caracteres").optional().or(z.literal("")),
    notes: z.string().max(2000, "Observações deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasPct = data.percentage !== undefined && data.percentage !== "";
    if (!hasPct) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentage"], message: "Percentual é obrigatório" });
    }
    if (data.share_type === "internal_release") {
      if (!data.release_id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["release_id"], message: "Selecione o lançamento" });
      if (!data.holder) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["holder"], message: "Informe o participante" });
    } else {
      if (!data.music_title) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["music_title"], message: "Informe o nome da música" });
      if (!data.artista_project_id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["artista_project_id"], message: "Vincule um artista/projeto da empresa" });
    }
  });

export type ShareFormData = z.infer<typeof shareSchema>;
