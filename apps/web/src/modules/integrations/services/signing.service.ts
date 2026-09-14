/**
 * integrations/services/signing.service.ts
 *
 * Orquestração de assinatura digital — Decision Gate item 9 (GAP-15).
 *
 * Autentique é o único provedor real hoje (ver Decision Gate item 13 —
 * Clicksign/DocuSign removidos da UI). O backend real
 * (apps/api/.../autentique/autentique.controller.ts) só suporta
 * criar-documento + webhook — NÃO existe getDocument/listDocuments/
 * cancelDocument/resendInvite; nunca fabricar essas capacidades.
 *
 * Autentique envia o convite de assinatura por email diretamente aos
 * signatários via sua própria plataforma (a mutação GraphQL createDocument
 * já dispara isso) — por isso este serviço NÃO chama nenhum adapter de
 * email próprio (chamaria um provider sempre indisponível e duplicaria a
 * notificação). A confirmação de assinatura chega via webhook real, que já
 * emite CONTRACT_SIGNED (transação provisória, tarefas, notificação
 * in-app — ver contract-events.handler.ts) — nenhuma notificação adicional
 * é necessária aqui.
 */

import { api } from "@/shared/lib/api-client";

export type SigningProviderId = "autentique" | "docusign";

/**
 * Cada provedor real expõe o MESMO contrato no backend
 * (POST {base}/documents → { documentId }), então o roteamento é só o prefixo.
 * Um provedor só entra aqui depois de ter adapter real — nunca antecipadamente.
 */
const PROVIDER_ENDPOINT: Record<SigningProviderId, string> = {
  autentique: "/integrations/autentique/documents",
  docusign:   "/integrations/docusign/documents",
};

export interface SendForSigningInput {
  contratoId: string;
  title: string;
  /** URL pública do arquivo a assinar (contrato.arquivo_url). */
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
    throw new Error(`Não foi possível baixar o arquivo do contrato em "${url}". Verifique a URL cadastrada.`);
  }
  if (!response.ok) {
    throw new Error(`Falha ao baixar o arquivo do contrato (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Falha ao ler o conteúdo do arquivo."));
    reader.readAsDataURL(blob);
  });
}

export const signingService = {
  /**
   * Orquestra o envio de um contrato para assinatura digital via Autentique:
   * 1. Baixa o arquivo do contrato (arquivo_url) e converte para base64
   * 2. Cria o documento no Autentique (que já notifica os signatários)
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
      throw new Error("Este contrato não possui um arquivo (URL) cadastrado. Adicione a URL do PDF antes de enviar para assinatura.");
    }
    if (signers.length === 0) {
      throw new Error("Adicione ao menos um signatário antes de enviar para assinatura.");
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
