import { z } from "zod";
import { InventoryStatus } from "@music-os-360/types";

export const inventorySchema = z.object({
  name: z.string()
    .min(1, "Nome é obrigatório")
    .max(150, "Nome deve ter no máximo 150 caracteres")
    .trim(),
  category: z.string()
    .optional()
    .nullable()
    .or(z.literal("")),
  quantity: z.number()
    .min(1, "Quantidade mínima é 1")
    .optional()
    .nullable(),
  storageLocation: z.string()
    .max(200, "Localização deve ter no máximo 200 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  status: z.nativeEnum(InventoryStatus, {
    errorMap: () => ({ message: "Selecione um status válido" })
  }),
  unitPrice: z.number()
    .min(0, "Valor não pode ser negativo")
    .optional()
    .nullable(),
  notes: z.string()
    .max(1000, "Observações deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
  sector: z.string().optional(),
  responsiblePerson: z.string().optional(),
  purchaseLocation: z.string().optional(),
  invoiceNumber: z.string().optional(),
  entryDate: z.string().optional(),
});

export type InventoryFormData = z.infer<typeof inventorySchema>;
