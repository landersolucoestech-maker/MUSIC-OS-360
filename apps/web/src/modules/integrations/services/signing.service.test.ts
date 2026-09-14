import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClientMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: { post: apiClientMock.post } }));

import { signingService } from "./signing.service";

/**
 * Decision Gate item 9 (GAP-15): Autentique é o único provedor real. O
 * backend não retorna signing_url nem suporta cancel/get — este serviço
 * nunca deve inventar esses campos. Autentique já notifica os signatários
 * por email diretamente; este serviço nunca chama um adapter de email
 * próprio (evita duplicar a notificação e evita depender de um provider
 * sempre indisponível).
 */
function mockBase64Read() {
  const originalFileReader = globalThis.FileReader;
  class FakeFileReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL() {
      this.result = "data:application/pdf;base64,ZmFrZS1wZGY=";
      this.onload?.();
    }
  }
  // @ts-expect-error — stub mínimo suficiente para o serviço
  globalThis.FileReader = FakeFileReader;
  return () => { globalThis.FileReader = originalFileReader; };
}

describe("signingService.sendForSigning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("baixa o arquivo, converte para base64 e chama o endpoint real do Autentique", async () => {
    const restore = mockBase64Read();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["fake-pdf"]),
    });
    apiClientMock.post.mockResolvedValueOnce({ documentId: "doc-123" });

    const result = await signingService.sendForSigning({
      contratoId: "c1",
      title: "Contrato X",
      fileUrl: "https://storage.example/contratos/c1.pdf",
      signers: [{ name: "Ana", email: "ana@x.com" }],
    });

    expect(fetch).toHaveBeenCalledWith("https://storage.example/contratos/c1.pdf");
    expect(apiClientMock.post).toHaveBeenCalledWith(
      "/integrations/autentique/documents",
      {
        name: "Contrato X",
        fileBase64: "ZmFrZS1wZGY=",
        signers: [{ name: "Ana", email: "ana@x.com" }],
        contractId: "c1",
      },
      { headers: { "X-Idempotency-Key": expect.any(String) } },
    );
    expect(result).toEqual({ documentId: "doc-123", provider: "autentique" });
    restore();
  });

  // 2026-08-23: DocuSign passou a ser provedor real (integrations/docusign). O
  // roteamento por provedor tem de bater no endpoint certo — mandar um envelope
  // DocuSign para o endpoint do Autentique falharia silenciosamente no provedor errado.
  it("roteia para o endpoint do DocuSign quando esse provedor é escolhido", async () => {
    const restore = mockBase64Read();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["fake-pdf"]),
    });
    apiClientMock.post.mockResolvedValueOnce({ documentId: "env-999" });

    const result = await signingService.sendForSigning({
      contratoId: "c1",
      title: "Contrato X",
      fileUrl: "https://storage.example/contratos/c1.pdf",
      signers: [{ name: "Ana", email: "ana@x.com" }],
      provider: "docusign",
    });

    expect(apiClientMock.post).toHaveBeenCalledWith(
      "/integrations/docusign/documents",
      expect.objectContaining({ name: "Contrato X", contractId: "c1" }),
      { headers: { "X-Idempotency-Key": expect.any(String) } },
    );
    expect(result).toEqual({ documentId: "env-999", provider: "docusign" });
    restore();
  });

  it("mantém Autentique como provedor padrão quando nenhum é informado", async () => {
    const restore = mockBase64Read();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["fake-pdf"]),
    });
    apiClientMock.post.mockResolvedValueOnce({ documentId: "doc-1" });

    const result = await signingService.sendForSigning({
      contratoId: "c1",
      title: "Contrato X",
      fileUrl: "https://storage.example/contratos/c1.pdf",
      signers: [{ name: "Ana", email: "ana@x.com" }],
    });

    expect(apiClientMock.post.mock.calls[0][0]).toBe("/integrations/autentique/documents");
    expect(result.provider).toBe("autentique");
    restore();
  });

  /**
   * find-917fba5c/find-93b0039d: this creates a real external signature
   * document -- a retry/double-click must not create a second one. Each
   * call gets its own fresh key by default (protects one attempt's own
   * retry); an explicit key lets a caller intentionally retry the same
   * attempt.
   */
  it("sends a fresh X-Idempotency-Key per call by default", async () => {
    const restore = mockBase64Read();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, blob: async () => new Blob(["fake-pdf"]) });
    apiClientMock.post.mockResolvedValue({ documentId: "doc-1" });

    const input = { contratoId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [{ name: "A", email: "a@x.com" }] };
    await signingService.sendForSigning(input);
    await signingService.sendForSigning(input);

    const key1 = apiClientMock.post.mock.calls[0][2].headers["X-Idempotency-Key"];
    const key2 = apiClientMock.post.mock.calls[1][2].headers["X-Idempotency-Key"];
    expect(key1).toBeTruthy();
    expect(key2).toBeTruthy();
    expect(key1).not.toBe(key2);
    restore();
  });

  it("honors an explicitly-passed idempotencyKey for an intentional same-attempt retry", async () => {
    const restore = mockBase64Read();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, blob: async () => new Blob(["fake-pdf"]) });
    apiClientMock.post.mockResolvedValue({ documentId: "doc-1" });

    const input = { contratoId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [{ name: "A", email: "a@x.com" }] };
    await signingService.sendForSigning(input, "retry-key-123");

    expect(apiClientMock.post.mock.calls[0][2]).toEqual({ headers: { "X-Idempotency-Key": "retry-key-123" } });
    restore();
  });

  it("rejeita quando não há URL de arquivo — nunca envia um documento vazio", async () => {
    await expect(
      signingService.sendForSigning({ contratoId: "c1", title: "X", fileUrl: "", signers: [{ name: "A", email: "a@x.com" }] }),
    ).rejects.toThrow(/não possui um arquivo/i);
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("rejeita quando não há signatários", async () => {
    await expect(
      signingService.sendForSigning({ contratoId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [] }),
    ).rejects.toThrow(/signatário/i);
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("propaga erro honesto quando o download do arquivo falha (rede)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network down"));

    await expect(
      signingService.sendForSigning({ contratoId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [{ name: "A", email: "a@x.com" }] }),
    ).rejects.toThrow(/não foi possível baixar/i);
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("propaga erro honesto quando o download retorna status não-OK", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(
      signingService.sendForSigning({ contratoId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [{ name: "A", email: "a@x.com" }] }),
    ).rejects.toThrow(/404/);
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });
});
