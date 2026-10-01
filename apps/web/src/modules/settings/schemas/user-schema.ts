import { z } from "zod";

export const userSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  email: z.string()
    .min(1, "Email é obrigatório")
    .email("Email inválido")
    .max(100, "Email deve ter no máximo 100 caracteres"),
  phone: z.string()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.enum(["active", "inactive", "suspended"], {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  department: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  accessLevel: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type UserFormData = z.infer<typeof userSchema>;
