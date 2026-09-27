import { z } from "zod";

export const leaveRequestSchema = z.object({
  employeeId: z.string()
    .min(1, "Funcionário é obrigatório"),
  type: z.string()
    .min(1, "Tipo de ausência é obrigatório"),
  startDate: z.string()
    .min(1, "Data de início é obrigatória"),
  endDate: z.string()
    .min(1, "Data de fim é obrigatória"),
  status: z.enum(["pending", "approved", "rejected", "in_progress", "completed"]).default("pending"),
  approvedBy: z.string().max(150, "Nome deve ter no máximo 150 caracteres").optional().or(z.literal("")),
  observacoes: z.string()
    .max(2000, "Observações deve ter no máximo 2000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;
