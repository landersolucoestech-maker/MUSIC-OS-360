export type DocumentStatus =
  | "draft"
  | "pending_signature"
  | "partially_signed"
  | "signed"
  | "cancelled"
  | "expired";

export type SignerStatus = "pending" | "signed" | "rejected" | "expired";

export type DocumentLogEvent =
  | "created"
  | "template_applied"
  | "sent_for_signature"
  | "signer_viewed"
  | "signer_signed"
  | "signer_rejected"
  | "completed"
  | "cancelled"
  | "expired"
  | "webhook_received";

export interface DocumentSigner {
  id: string;
  document_id: string;
  role: string;
  name: string;
  email: string;
  cpf?: string;
  status: SignerStatus;
  signed_at?: string;
  token?: string;
  autentique_signer_id?: string;
  anchor?: string;
}

export interface DocumentLog {
  id: string;
  document_id: string;
  event: DocumentLogEvent;
  payload?: Record<string, unknown>;
  created_at: string;
  user_id?: string;
}

export type SigningProviderLabel = "autentique" | "clicksign" | "docusign";

export interface LinkedDocument {
  id: string;
  org_id: string;
  template_id?: string;
  title: string;
  status: DocumentStatus;
  content_html: string;
  pdf_url?: string;
  autentique_doc_id?: string;
  artist_id?: string;
  contract_id?: string;
  signing_provider?: SigningProviderLabel;
  variables: Record<string, string>;
  signers: DocumentSigner[];
  logs: DocumentLog[];
  expires_at?: string;
  signed_at?: string;
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  draft:              "Rascunho",
  pending_signature:  "Aguardando Assinatura",
  partially_signed:   "Parcialmente Assinado",
  signed:             "Assinado",
  cancelled:          "Cancelado",
  expired:            "Expirado",
};

export const SIGNER_STATUS_LABEL: Record<SignerStatus, string> = {
  pending:  "Pendente",
  signed:   "Assinado",
  rejected: "Rejeitado",
  expired:  "Expirado",
};
