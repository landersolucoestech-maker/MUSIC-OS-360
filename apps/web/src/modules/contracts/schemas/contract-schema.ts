import { z } from "zod";
import { ContractStatus } from "../lib/contract-status";

export const SIGNER_ROLES = ["artista", "label", "produtor", "empresario"] as const;
export type ContractSignerRole = typeof SIGNER_ROLES[number];

export const SIGNER_ROLE_LABEL: Record<ContractSignerRole, string> = {
  artista:    "Artista",
  label:      "Gravadora / Label",
  produtor:   "Produtor",
  empresario: "Empresário",
};

export const contractSignerSchema = z.object({
  name:  z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  role:  z.enum(SIGNER_ROLES),
});

export type ContractSigner = z.infer<typeof contractSignerSchema>;

export const contractSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  service_type: z.string().min(1, "Tipo de serviço é obrigatório"),
  status: z.nativeEnum(ContractStatus).default(ContractStatus.DRAFT),
  file_url: z.string().optional(),
  version_notes: z.string().optional(),
  release_id: z.string().optional(),
  start_date: z.date({ required_error: "Data de início é obrigatória" }),
  end_date: z.date().optional(),
  registry_office: z.boolean().optional(),
  registry_date: z.date().optional(),
  payment_type: z.enum(["fixed_value", "recebimentos externos de direitos"]).optional(),
  fixed_value: z.number().optional(),
  external_rights_percentage: z.number().min(0).max(100).optional(),
  advance_payment: z.number().optional(),
  financial_support: z.number().optional(),
  observations: z.string().optional(),
  terms: z.string().optional(),
  signers: z.array(contractSignerSchema).max(10, "Máximo de 10 signatários").default([]),
});

export type ContractFormData = z.infer<typeof contractSchema>;

