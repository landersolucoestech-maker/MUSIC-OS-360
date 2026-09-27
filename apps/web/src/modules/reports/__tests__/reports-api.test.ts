import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  getAccessToken: vi.fn(() => "access-token"),
  getTenantId: vi.fn(() => "tenant-123"),
}));

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: apiClientMock.get,
    post: apiClientMock.post,
  },
  getAccessToken: apiClientMock.getAccessToken,
  getTenantId: apiClientMock.getTenantId,
}));

vi.mock("@/shared/lib/env", () => ({
  API_BASE_URL: "http://localhost:3001",
}));

import {
  reportsApi,
  triggerBlobDownload,
  XLSX_MIME,
  type ImportUploadBody,
} from "../services/reports-api";

describe("reportsApi — reports center, real data only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("busca entities exclusivamente pela API real", () => {
    reportsApi.entities();

    expect(apiClientMock.get).toHaveBeenCalledWith("/reports/entities");
  });

  it("busca definitions exclusivamente pela API real", () => {
    reportsApi.definitions();

    expect(apiClientMock.get).toHaveBeenCalledWith("/reports/definitions");
  });

  it("exportBlob calls the real endpoint with token, tenant and query params", async () => {
    const signature = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const blob = {
      slice: vi.fn(() => ({
        arrayBuffer: vi.fn().mockResolvedValue(signature.buffer),
      })),
    } as unknown as Blob;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn((name: string) => {
          if (name.toLowerCase() === "content-type") return XLSX_MIME;
          if (name.toLowerCase() === "content-disposition") {
            return 'attachment; filename="artistas.xlsx"';
          }
          return null;
        }),
      },
      blob: vi.fn().mockResolvedValue(blob),
    } as unknown as Response);

    const result = await reportsApi.exportBlob("artistas", {
      format: "xlsx",
      columns: ["nome", "status"],
      filters: { status: "ativo", vazio: "" },
      sort: "nome",
      order: "ASC",
      page: 2,
      pageSize: 50,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/reports/entities/artistas/export?format=xlsx&columns=nome%2Cstatus&sort=nome&order=ASC&page=2&pageSize=50&status=ativo",
      {
        headers: {
          Authorization: "Bearer access-token",
          "X-Tenant-ID": "tenant-123",
        },
        credentials: "include",
      },
    );
    expect(result).toEqual({ blob, filename: "artistas.xlsx" });
  });

  it("exportBlob falha explicitamente quando a API responde erro", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue("serviço indisponível"),
    } as unknown as Response);

    const failure = reportsApi.exportBlob("artistas", { format: "xlsx" });
    // Technical diagnostic keeps the status and raw body; the user copy never does.
    await expect(failure).rejects.toThrow("Export failed (HTTP 503): serviço indisponível");
    await expect(failure).rejects.toMatchObject({
      userMessage: "Não foi possível concluir a operação de relatório. Tente novamente.",
    });
  });

  it("envia importValidate para a API real", () => {
    const body: ImportUploadBody = {
      filename: "artistas.xlsx",
      mimeType: XLSX_MIME,
      contentBase64: "abc",
    };

    reportsApi.importValidate("artistas", body);

    expect(apiClientMock.post).toHaveBeenCalledWith("/reports/entities/artistas/import/validate", body);
  });

  it("envia importCommit para a API real", () => {
    const body: ImportUploadBody = {
      filename: "artistas.xlsx",
      mimeType: XLSX_MIME,
      contentBase64: "abc",
    };

    reportsApi.importCommit("artistas", body);

    expect(apiClientMock.post).toHaveBeenCalledWith("/reports/entities/artistas/import/commit", body);
  });

  describe("triggerBlobDownload — does not revoke the URL before the download starts", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn(() => "blob:fake-url"),
        revokeObjectURL: vi.fn(),
      });
    });

    it("clicks the link BEFORE revoking the URL, and revocation only happens on the next tick", () => {
      const anchor = document.createElement("a");
      const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => undefined);
      const createSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor);

      triggerBlobDownload(new Blob(["x"]), "arquivo.xlsx");

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(anchor.href).toBe("blob:fake-url");
      expect(anchor.download).toBe("arquivo.xlsx");
      // The revocation must NOT have happened yet in the same tick as click().
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();

      vi.runAllTimers();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

      createSpy.mockRestore();
      clickSpy.mockRestore();
    });
  });
});
