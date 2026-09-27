/**
 * integrations/mappers/contract.mapper.ts
 *
 * Mapper between the Contract domain entity (mockData) and the digital
 * signature DTOs (ISigningProvider).
 *
 * RULE: this mapper is the ONLY source of truth for the
 * Contract ↔ SigningDTO transformation. No component or hook transforms inline.
 *
 * Usage:
 *   import { contratoMapper } from "@/modules/integrations/mappers";
 *   const input = contratoMapper.toSigningInput(contrato);
 *   const updated = contratoMapper.applySigningStatus(contrato, signingDoc);
 */

import type { CreateSigningDocumentParams as CreateDocumentInput, SigningDocument } from "@/modules/integrations/dto";

/** Contract domain entity (source: mockData). */
export interface ContractEntity {
  id:            string;
  title:        string;
  type:          string;
  status:        string;
  partes:        Array<{ nome: string; email: string; papel: string }>;
  fileKey?:      string;
  bucket?:       string;
  signingDocId?: string;
  expiresAt?:    string;
  createdAt:     string;
  updatedAt:     string;
}

export const contractMapper = {
  /**
   * Converts a Contract into the input for creating a signature document.
   */
  toSigningInput(contract: ContractEntity, _deadline_days = 7): CreateDocumentInput {
    return {
      title:    contract.title,
      document: contract.fileKey
        ? `/storage/${contract.bucket ?? "documents"}/${contract.fileKey}`
        : "",
      signers: contract.partes.map(p => ({
        name:  p.nome,
        email: p.email,
        role:  p.papel as import("@/shared/integrations/contracts/signing.contract").SignerRole,
      })),
      expires_at: contract.expiresAt,
    };
  },

  /**
   * Applies the state of a SigningDocument back to the Contract entity.
   * Returns a (partial) patch to update the mockData.
   */
  applySigningStatus(
    contract: ContractEntity,
    signingDoc: SigningDocument,
  ): Partial<ContractEntity> {
    const statusMap: Record<SigningDocument["status"], ContractEntity["status"]> = {
      draft:            "rascunho",
      pending:          "aguardando_assinatura",
      partially_signed: "parcialmente_assinado",
      completed:        "assinado",
      refused:          "rejeitado",
      expired:          "expirado",
      cancelled:        "cancelado",
    };

    return {
      id:            contract.id,
      signingDocId:  signingDoc.id,
      status:        statusMap[signingDoc.status] ?? contract.status,
      updatedAt:     new Date().toISOString(),
    };
  },

  /**
   * Checks whether a contract is in an active signature state.
   */
  isInSigning(contract: ContractEntity): boolean {
    return contract.status === "aguardando_assinatura" && !!contract.signingDocId;
  },

  /**
   * Checks whether a contract is close to expiring (< 30 days).
   */
  isDueToExpire(contract: ContractEntity, thresholdDays = 30): boolean {
    if (!contract.expiresAt) return false;
    const daysLeft =
      (new Date(contract.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft < thresholdDays;
  },
};
