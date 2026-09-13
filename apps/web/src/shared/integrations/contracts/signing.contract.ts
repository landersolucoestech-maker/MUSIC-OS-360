/**
 * shared/integrations/contracts/signing.contract.ts
 *
 * Contrato de assinatura digital — implementação alvo: Autentique.
 *
 * ESTADO ACTUAL: useAutentique em modules/integrations/hooks/useAutentique.ts (mock).
 * MIGRAÇÃO FUTURA: ISigningProvider implementado via Autentique GraphQL API.
 *
 * Domínios que utilizam assinatura:
 *   - Contracts (contratos com artistas, distribuidoras, editoras)
 *   - CRM (acordos de representação, NDAs)
 */

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type SigningStatus =
  | "draft"
  | "pending"
  | "partially_signed"
  | "completed"
  | "refused"
  | "expired"
  | "cancelled";

export type SignerRole =
  | "signer"
  | "witness"
  | "approver"
  | "cc";

export interface Signer {
  name: string;
  email: string;
  role: SignerRole;
  /** CPF ou CNPJ do signatário */
  document?: string;
  /** URL da assinatura gerada após assinar */
  signature_url?: string | null;
  signed_at?: string | null;
}

export interface SigningDocument {
  id: string;
  external_id?: string | null;
  title: string;
  status: SigningStatus;
  signers: Signer[];
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  completed_at?: string | null;
  /** URL do PDF original */
  document_url: string;
  /** URL do PDF assinado (disponível após conclusão) */
  signed_document_url?: string | null;
  /**
   * Link de acesso ao envelope de assinatura no provedor (enviado aos signatários).
   * Disponível imediatamente após createDocument.
   */
  signing_url?: string | null;
  /** ID do contrato local associado */
  contrato_id?: string;
}

export interface CreateSigningDocumentParams {
  title: string;
  /** PDF em base64 ou URL pública acessível */
  document: string;
  signers: Omit<Signer, "signature_url" | "signed_at">[];
  /** Data de expiração (ISO 8601). Default: 30 dias */
  expires_at?: string;
  /** Mensagem para os signatários */
  message?: string;
  /** ID do contrato local para referência cruzada */
  contrato_id?: string;
}

export interface SigningWebhookEvent {
  type: "document.signed" | "document.refused" | "document.completed" | "document.expired";
  document_id: string;
  signer_email?: string;
  timestamp: string;
}

// ─── Contrato ─────────────────────────────────────────────────────────────────

/**
 * ISigningProvider — contrato de assinatura digital.
 *
 * Implementações previstas:
 *   - MockSigningProvider      (standalone — status simulado)
 *   - AutentiqueSigningProvider (produção — Autentique GraphQL API)
 */
export interface ISigningProvider {
  /** Cria um documento para assinatura e envia convites por e-mail */
  createDocument(params: CreateSigningDocumentParams): Promise<SigningDocument>;

  /** Consulta o estado actual de um documento */
  getDocument(documentId: string): Promise<SigningDocument>;

  /** Lista documents (opcionalmente filtrados por contrato local) */
  listDocuments(params?: { contrato_id?: string; status?: SigningStatus }): Promise<SigningDocument[]>;

  /** Cancela um documento em aberto */
  cancelDocument(documentId: string): Promise<void>;

  /** Reenvia o convite de assinatura para um signatário */
  resendInvite(documentId: string, signerEmail: string): Promise<void>;

  /** Processa um evento de webhook recebido */
  handleWebhook(event: SigningWebhookEvent): Promise<void>;

  /** Verifica as credenciais configuradas */
  verifyConnection(): Promise<boolean>;
}
