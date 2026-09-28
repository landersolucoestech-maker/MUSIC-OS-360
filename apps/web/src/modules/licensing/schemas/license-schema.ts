import { z } from "zod";

export const licenseSchema = z
  .object({
    title: z.string().min(1, "Título é obrigatório").max(200, "Título deve ter no máximo 200 caracteres").trim(),
    licenseType: z.string().optional().or(z.literal("")),
    workId: z.string().min(1, "Obra musical é obrigatória"),
    clientId: z.string().min(1, "Cliente é obrigatório"),
    projectName: z.string().max(200, "Nome do projeto deve ter no máximo 200 caracteres").optional().or(z.literal("")),
    targetMedia: z.string().max(150).optional().or(z.literal("")),
    territory: z.string().max(150).optional().or(z.literal("")),
    status: z.string().optional().or(z.literal("")),
    startDate: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
    // Compensation
    remunerationType: z.enum(["FIXED", "PERCENTAGE", "FIXED_PLUS_PERCENTAGE"]).default("FIXED"),
    currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
    amount: z.string().optional().or(z.literal("")),
    percentage: z.string().optional().or(z.literal("")),
    notes: z.string().max(2000, "Observações deve ter no máximo 2000 caracteres").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasAmount = data.amount !== undefined && data.amount !== "" && Number(data.amount) > 0;
    const hasPercentage = data.percentage !== undefined && data.percentage !== "" && Number(data.percentage) > 0;

    if (data.remunerationType === "FIXED" || data.remunerationType === "FIXED_PLUS_PERCENTAGE") {
      if (!data.currency) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["currency"], message: "Moeda é obrigatória" });
      if (!hasAmount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Informe um valor válido" });
    }
    if (data.remunerationType === "PERCENTAGE" || data.remunerationType === "FIXED_PLUS_PERCENTAGE") {
      if (!hasPercentage) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentage"], message: "Informe um percentual válido" });
    }
  });

export type LicenseFormData = z.infer<typeof licenseSchema>;
