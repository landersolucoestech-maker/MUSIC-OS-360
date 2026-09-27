import { z } from "zod";
import { parseISO, isValid } from "date-fns";

export const eventSchema = z.object({
  title: z.string()
    .min(1, "Título do evento é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres")
    .trim(),
  eventType: z.string()
    .min(1, "Tipo de evento é obrigatório"),
  artistId: z.string().optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
  startDate: z.preprocess((val) => {
    if (typeof val === "string" && val !== "") {
      const d = parseISO(val as string);
      return isValid(d) ? d : val;
    }
    return val;
  }, z.date({ required_error: "Data de início é obrigatória" })),
  startTime: z.string().optional().or(z.literal("")),
  endDate: z.preprocess((val) => {
    if (typeof val === "string" && val !== "") {
      const d = parseISO(val as string);
      return isValid(d) ? d : val;
    }
    return val;
  }, z.date().optional().nullable()),
  endTime: z.string().optional().or(z.literal("")),
  venue: z.string().max(200, "Nome do local deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  address: z.string().max(300, "Endereço deve ter no máximo 300 caracteres").optional().or(z.literal("")),
  venueContact: z.string().max(150, "Contato deve ter no máximo 150 caracteres").optional().or(z.literal("")),
  capacity: z.string().optional().or(z.literal("")),
  feeAmount: z.string().optional().or(z.literal("")),
  expectedAttendance: z.string().optional().or(z.literal("")),
  description: z.string().max(2000, "Descrição deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
  notes: z.string().max(2000, "Observações deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
});

export type EventFormData = z.infer<typeof eventSchema>;
