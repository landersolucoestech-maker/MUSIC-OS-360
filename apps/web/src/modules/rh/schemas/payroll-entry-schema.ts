import { z } from "zod";

export const payrollEntrySchema = z.object({
  employeeId: z.string()
    .min(1, "Funcionário é obrigatório"),
  referenceMonth: z.string()
    .min(1, "Mês de referência é obrigatório"),
  grossSalary: z.number()
    .min(0, "Salário bruto não pode ser negativo")
    .optional()
    .nullable(),
  descontos: z.number()
    .min(0, "Descontos não podem ser negativos")
    .optional()
    .nullable(),
  bonus: z.number()
    .min(0, "Bônus não pode ser negativo")
    .optional()
    .nullable(),
  paymentDate: z.string().optional().or(z.literal("")),
  status: z.enum(["pending", "processed", "paid", "cancelled"]).default("pending"),
  observacoes: z.string()
    .max(2000, "Observações deve ter no máximo 2000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type PayrollEntryFormData = z.infer<typeof payrollEntrySchema>;
