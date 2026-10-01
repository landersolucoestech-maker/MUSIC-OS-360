import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClientMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: { post: apiClientMock.post } }));

import { signingService } from "./signing.service";

/**
 * Decision Gate item 9 (GAP-15): Autentique is the only real provider. The
 * backend returns no signing_url nor supports cancel/get — this service
 * must never invent those fields. Autentique already notifies the signers
 * by email directly; this service never calls an email adapter of its
 * own (avoids duplicating the notification and depending on an always
 * unavailable provider).
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
  // @ts-expect-error — minimal stub sufficient for the service
  globalThis.FileReader = FakeFileReader;
  return () => { globalThis.FileReader = originalFileReader; };
}

describe("signingService.sendForSigning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("downloads the file, converts it to base64 and calls the real Autentique endpoint", async () => {
    const restore = mockBase64Read();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["fake-pdf"]),
    });
    apiClientMock.post.mockResolvedValueOnce({ documentId: "doc-123" });

    const result = await signingService.sendForSigning({
      contractId: "c1",
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

  // 2026-08-23: DocuSign became a real provider (integrations/docusign). The
  // per-provider routing must hit the right endpoint — sending a DocuSign
  // envelope to the Autentique endpoint would fail silently on the wrong provider.
  it("routes to the DocuSign endpoint when that provider is chosen", async () => {
    const restore = mockBase64Read();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["fake-pdf"]),
    });
    apiClientMock.post.mockResolvedValueOnce({ documentId: "env-999" });

    const result = await signingService.sendForSigning({
      contractId: "c1",
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

  it("keeps Autentique as the default provider when none is given", async () => {
    const restore = mockBase64Read();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["fake-pdf"]),
    });
    apiClientMock.post.mockResolvedValueOnce({ documentId: "doc-1" });

    const result = await signingService.sendForSigning({
      contractId: "c1",
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

    const input = { contractId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [{ name: "A", email: "a@x.com" }] };
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

    const input = { contractId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [{ name: "A", email: "a@x.com" }] };
    await signingService.sendForSigning(input, "retry-key-123");

    expect(apiClientMock.post.mock.calls[0][2]).toEqual({ headers: { "X-Idempotency-Key": "retry-key-123" } });
    restore();
  });

  it("rejects when there is no file URL — never sends an empty document", async () => {
    await expect(
      signingService.sendForSigning({ contractId: "c1", title: "X", fileUrl: "", signers: [{ name: "A", email: "a@x.com" }] }),
    ).rejects.toMatchObject({ userMessage: expect.stringMatching(/não possui um arquivo/i) });
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("rejects when there are no signers", async () => {
    await expect(
      signingService.sendForSigning({ contractId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [] }),
    ).rejects.toMatchObject({ userMessage: expect.stringMatching(/signatário/i) });
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("propagates an honest error when the file download fails (network)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network down"));

    await expect(
      signingService.sendForSigning({ contractId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [{ name: "A", email: "a@x.com" }] }),
    ).rejects.toMatchObject({ userMessage: expect.stringMatching(/não foi possível baixar/i) });
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("propagates an honest error when the download returns a non-OK status", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(
      signingService.sendForSigning({ contractId: "c1", title: "X", fileUrl: "https://x/y.pdf", signers: [{ name: "A", email: "a@x.com" }] }),
    ).rejects.toThrow(/404/);
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });
});
