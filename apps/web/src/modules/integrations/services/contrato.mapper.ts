/**
 * integrations/mappers/contrato.mapper.ts
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
export interface ContratoEntity {
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

export const contratoMapper = {
  /**
   * Converts a Contract into the input for creating a signature document.
   */
  toSigningInput(contrato: ContratoEntity, _deadline_days = 7): CreateDocumentInput {
    return {
      title:    contrato.title,
      document: contrato.fileKey
        ? `/storage/${contrato.bucket ?? "documents"}/${contrato.fileKey}`
        : "",
      signers: contrato.partes.map(p => ({
        name:  p.nome,
        email: p.email,
        role:  p.papel as import("@/shared/integrations/contracts/signing.contract").SignerRole,
      })),
      expires_at: contrato.expiresAt,
    };
  },

  /**
   * Applies the state of a SigningDocument back to the Contract entity.
   * Returns a (partial) patch to update the mockData.
   */
  applySigningStatus(
    contrato: ContratoEntity,
    signingDoc: SigningDocument,
  ): Partial<ContratoEntity> {
    const statusMap: Record<SigningDocument["status"], ContratoEntity["status"]> = {
      draft:            "rascunho",
      pending:          "aguardando_assinatura",
      partially_signed: "parcialmente_assinado",
      completed:        "assinado",
      refused:          "rejeitado",
      expired:          "expirado",
      cancelled:        "cancelado",
    };

    return {
      id:            contrato.id,
      signingDocId:  signingDoc.id,
      status:        statusMap[signingDoc.status] ?? contrato.status,
      updatedAt:     new Date().toISOString(),
    };
  },

  /**
   * Checks whether a contract is in an active signature state.
   */
  isInSigning(contrato: ContratoEntity): boolean {
    return contrato.status === "aguardando_assinatura" && !!contrato.signingDocId;
  },

  /**
   * Checks whether a contract is close to expiring (< 30 days).
   */
  isDueToExpire(contrato: ContratoEntity, thresholdDays = 30): boolean {
    if (!contrato.expiresAt) return false;
    const daysLeft =
      (new Date(contrato.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft < thresholdDays;
  },
};
