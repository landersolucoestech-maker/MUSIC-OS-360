/**
 * integrations/services/signing.service.ts
 *
 * Digital signature orchestration — Decision Gate item 9 (GAP-15).
 *
 * Autentique is the only real provider today (see Decision Gate item 13 —
 * Clicksign/DocuSign removed from the UI). The real backend
 * (apps/api/.../autentique/autentique.controller.ts) only supports
 * create-document + webhook — there is NO getDocument/listDocuments/
 * cancelDocument/resendInvite; never fabricate those capabilities.
 *
 * Autentique sends the signature invitation by email directly to the
 * signers via its own platform (the createDocument GraphQL mutation
 * already triggers it) — which is why this service does NOT call any email
 * adapter of its own (it would call an always unavailable provider and duplicate the
 * notification). The signature confirmation arrives via the real webhook, which already
 * emits CONTRACT_SIGNED (provisional transaction, tasks, in-app
 * notification — see contract-events.handler.ts) — no additional notification
 * is needed here.
 */

import { api } from "@/shared/lib/api-client";
import { UserFacingError } from "@/shared/lib/errors";

export type SigningProviderId = "autentique" | "docusign";

/**
 * Each real provider exposes the SAME contract in the backend
 * (POST {base}/documents → { documentId }), so routing is only the prefix.
 * A provider only enters here after it has a real adapter — never in advance.
 */
const PROVIDER_ENDPOINT: Record<SigningProviderId, string> = {
  autentique: "/integrations/autentique/documents",
  docusign:   "/integrations/docusign/documents",
};

export interface SendForSigningInput {
  contratoId: string;
  title: string;
  /** Public URL of the file to sign (contrato.arquivo_url). */
  fileUrl: string;
  signers: Array<{ name: string; email: string }>;
  provider?: SigningProviderId;
}

export interface SendForSigningResult {
  documentId: string;
  provider: SigningProviderId;
}

async function fetchFileAsBase64(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new UserFacingError(`Contract file download failed (network): ${url}`, "Não foi possível baixar o arquivo do contrato. Verifique a URL cadastrada.");
  }
  if (!response.ok) {
    throw new UserFacingError(`Contract file download failed (HTTP ${response.status})`, "Falha ao baixar o arquivo do contrato. Verifique a URL cadastrada.");
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new UserFacingError("FileReader failed to read the contract file", "Falha ao ler o conteúdo do arquivo."));
    reader.readAsDataURL(blob);
  });
}

export const signingService = {
  /**
   * Orchestrates sending a contract for digital signature via Autentique:
   * 1. Downloads the contract file (arquivo_url) and converts it to base64
   * 2. Creates the document in Autentique (which already notifies the signers)
   */
  /**
   * find-917fba5c/find-93b0039d: this creates a REAL external signature
   * document (Autentique/DocuSign email real signers directly) -- a
   * network-level retry or a double-click on the same submission must not
   * create a second one. idempotencyKey defaults to a fresh UUID per call
   * (protects the single submission's own retry/timeout, same convention
   * as conversations.service.ts's create()); pass the same value explicitly
   * for an intentional user-initiated retry of the same attempt.
   */
  async sendForSigning(input: SendForSigningInput, idempotencyKey: string = crypto.randomUUID()): Promise<SendForSigningResult> {
    const { contratoId, title, fileUrl, signers } = input;

    if (!fileUrl) {
      throw new UserFacingError("Contract has no file URL", "Este contrato não possui um arquivo (URL) cadastrado. Adicione a URL do PDF antes de enviar para assinatura.");
    }
    if (signers.length === 0) {
      throw new UserFacingError("No signers provided", "Adicione ao menos um signatário antes de enviar para assinatura.");
    }

    const provider: SigningProviderId = input.provider ?? "autentique";
    const fileBase64 = await fetchFileAsBase64(fileUrl);

    const doc = await api.post<{ documentId: string }>(
      PROVIDER_ENDPOINT[provider],
      {
        name: title,
        fileBase64,
        signers: signers.map((s) => ({ name: s.name, email: s.email })),
        contractId: contratoId,
      },
      { headers: { "X-Idempotency-Key": idempotencyKey } },
    );

    return { documentId: doc.documentId, provider };
  },
};
