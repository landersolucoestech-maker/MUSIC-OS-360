/**
 * integrations/mappers/contrato.mapper.ts
 *
 * Mapper entre a entidade de domínio Contrato (mockData) e os DTOs
 * de assinatura digital (ISigningProvider).
 *
 * REGRA: este mapper é a ÚNICA fonte de verdade para a transformação
 * Contrato ↔ SigningDTO. Nenhum componente ou hook faz transformação inline.
 *
 * Uso:
 *   import { contratoMapper } from "@/modules/integrations/mappers";
 *   const input = contratoMapper.toSigningInput(contrato);
 *   const updated = contratoMapper.applySigningStatus(contrato, signingDoc);
 */

import type { CreateSigningDocumentParams as CreateDocumentInput, SigningDocument } from "@/modules/integrations/dto";

/** Entidade de domínio Contrato (fonte: mockData). */
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
   * Converte um Contrato para o input de criação de documento de assinatura.
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
   * Aplica o estado de um SigningDocument de volta à entidade Contrato.
   * Retorna um patch (parcial) para atualizar o mockData.
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
   * Verifica se um contrato está em estado de assinatura activa.
   */
  isInSigning(contrato: ContratoEntity): boolean {
    return contrato.status === "aguardando_assinatura" && !!contrato.signingDocId;
  },

  /**
   * Verifica se um contrato está próximo de expirar (< 30 dias).
   */
  isDueToExpire(contrato: ContratoEntity, thresholdDays = 30): boolean {
    if (!contrato.expiresAt) return false;
    const daysLeft =
      (new Date(contrato.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft < thresholdDays;
  },
};
