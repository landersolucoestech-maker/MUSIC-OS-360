import { z } from "zod";

export const phonogramSchema = z.object({
  title: z.string()
    .min(1, "Título do fonograma é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  isrc: z.string()
    .max(20, "ISRC deve ter no máximo 20 caracteres")
    .optional()
    .or(z.literal("")),
  durationText: z.string().optional().or(z.literal("")),
  musicGenre: z.string().optional().or(z.literal("")),
  isInstrumental: z.boolean().default(false),
  aiUsed: z.boolean().default(false),
  isSimultaneousPublication: z.boolean().default(false),
  termsAccepted: z.boolean().default(false),
});

export type PhonogramFormData = z.infer<typeof phonogramSchema>;
