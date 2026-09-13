import { z } from "zod";
import { parseISO, isValid } from "date-fns";

export const eventSchema = z.object({
  title: z.string()
    .min(1, "Título do evento é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  tipoEvento: z.string()
    .min(1, "Tipo de evento é obrigatório"),
  artista: z.string().optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
  startDate: z.preprocess((val) => {
    if (typeof val === "string" && val !== "") {
      const d = parseISO(val as string);
      return isValid(d) ? d : val;
    }
    return val;
  }, z.date({ required_error: "Data de início é obrigatória" })),
  horarioInicio: z.string().optional().or(z.literal("")),
  endDate: z.preprocess((val) => {
    if (typeof val === "string" && val !== "") {
      const d = parseISO(val as string);
      return isValid(d) ? d : val;
    }
    return val;
  }, z.date().optional().nullable()),
  horarioFim: z.string().optional().or(z.literal("")),
  nomeLocal: z.string().max(200, "Nome do local deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  endereco: z.string().max(300, "Endereço deve ter no máximo 300 caracteres").optional().or(z.literal("")),
  contatoLocal: z.string().max(150, "Contacto deve ter no máximo 150 caracteres").optional().or(z.literal("")),
  capacidadePublico: z.string().optional().or(z.literal("")),
  valorCache: z.string().optional().or(z.literal("")),
  publicoEsperado: z.string().optional().or(z.literal("")),
  descricao: z.string().max(2000, "Descrição deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
  observacoes: z.string().max(2000, "Observações deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
});

export type EventFormData = z.infer<typeof eventSchema>;
