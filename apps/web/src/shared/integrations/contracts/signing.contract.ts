/**
 * shared/integrations/contracts/signing.contract.ts
 *
 * Digital signature contract — target implementation: Autentique.
 *
 * CURRENT STATE: useAutentique in modules/integrations/hooks/useAutentique.ts (mock).
 * FUTURE MIGRATION: ISigningProvider implemented via the Autentique GraphQL API.
 *
 * Domains that use signatures:
 *   - Contracts (contracts with artists, distributors, publishers)
 *   - CRM (representation agreements, NDAs)
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
  /** Signer's CPF or CNPJ */
  document?: string;
  /** Signature URL generated after signing */
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
  /** Signed PDF URL (available after completion) */
  signed_document_url?: string | null;
  /**
   * Access link to the signature envelope at the provider (sent to signers).
   * Available right after createDocument.
   */
  signing_url?: string | null;
  /** ID do contrato local associado */
  contrato_id?: string;
}

export interface CreateSigningDocumentParams {
  title: string;
  /** PDF in base64 or an accessible public URL */
  document: string;
  signers: Omit<Signer, "signature_url" | "signed_at">[];
  /** Expiry date (ISO 8601). Default: 30 days */
  expires_at?: string;
  /** Message for the signers */
  message?: string;
  /** Local contract ID for cross-reference */
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
 * ISigningProvider — digital signature contract.
 *
 * Planned implementations:
 *   - MockSigningProvider      (standalone — simulated status)
 *   - AutentiqueSigningProvider (production — Autentique GraphQL API)
 */
export interface ISigningProvider {
  /** Creates a document for signature and sends email invitations */
  createDocument(params: CreateSigningDocumentParams): Promise<SigningDocument>;

  /** Looks up the current state of a document */
  getDocument(documentId: string): Promise<SigningDocument>;

  /** Lista documents (opcionalmente filtrados por contrato local) */
  listDocuments(params?: { contrato_id?: string; status?: SigningStatus }): Promise<SigningDocument[]>;

  /** Cancels an open document */
  cancelDocument(documentId: string): Promise<void>;

  /** Resends the signature invitation to a signer */
  resendInvite(documentId: string, signerEmail: string): Promise<void>;

  /** Processes a received webhook event */
  handleWebhook(event: SigningWebhookEvent): Promise<void>;

  /** Verifica as credenciais configuradas */
  verifyConnection(): Promise<boolean>;
}
