import { z } from "zod";

export const employeeSchema = z.object({
  fullName: z.string()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  email: z.string()
    .email("Email inválido")
    .max(100, "Email deve ter no máximo 100 caracteres")
    .optional()
    .or(z.literal("")),
  cpf: z.string().max(20, "CPF inválido").optional().or(z.literal("")),
  rg: z.string().max(20, "RG inválido").optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  telefone: z.string().max(20, "Telefone inválido").optional().or(z.literal("")),
  endereco: z.string().max(300, "Endereço deve ter no máximo 300 caracteres").optional().or(z.literal("")),
  cargo: z.string().max(100, "Cargo deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  setor: z.string().optional().or(z.literal("")),
  contractType: z.string().optional().or(z.literal("")),
  hireDate: z.string().optional().or(z.literal("")),
  baseSalary: z.number().min(0, "Salário não pode ser negativo").optional().nullable(),
  status: z.enum(["active", "inactive", "on_vacation", "on_leave"]).default("active"),
  observacoes: z.string().max(2000, "Observações deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;
