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

  it("fetches entities only from the real API", () => {
    reportsApi.entities();

    expect(apiClientMock.get).toHaveBeenCalledWith("/reports/entities");
  });

  it("fetches definitions only from the real API", () => {
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
            return 'attachment; filename="artists.xlsx"';
          }
          return null;
        }),
      },
      blob: vi.fn().mockResolvedValue(blob),
    } as unknown as Response);

    const result = await reportsApi.exportBlob("artists", {
      format: "xlsx",
      columns: ["name", "status"],
      filters: { status: "active", empty: "" },
      sort: "name",
      order: "ASC",
      page: 2,
      pageSize: 50,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/reports/entities/artists/export?format=xlsx&columns=name%2Cstatus&sort=name&order=ASC&page=2&pageSize=50&status=active",
      {
        headers: {
          Authorization: "Bearer access-token",
          "X-Tenant-ID": "tenant-123",
        },
        credentials: "include",
      },
    );
    expect(result).toEqual({ blob, filename: "artists.xlsx" });
  });

  it("exportBlob fails explicitly when the API responds with an error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue("serviço indisponível"),
    } as unknown as Response);

    const failure = reportsApi.exportBlob("artists", { format: "xlsx" });
    // Technical diagnostic keeps the status and raw body; the user copy never does.
    await expect(failure).rejects.toThrow("Export failed (HTTP 503): serviço indisponível");
    await expect(failure).rejects.toMatchObject({
      userMessage: "Não foi possível concluir a operação de relatório. Tente novamente.",
    });
  });

  it("sends importValidate to the real API", () => {
    const body: ImportUploadBody = {
      filename: "artists.xlsx",
      mimeType: XLSX_MIME,
      contentBase64: "abc",
    };

    reportsApi.importValidate("artists", body);

    expect(apiClientMock.post).toHaveBeenCalledWith("/reports/entities/artists/import/validate", body);
  });

  it("sends importCommit to the real API", () => {
    const body: ImportUploadBody = {
      filename: "artists.xlsx",
      mimeType: XLSX_MIME,
      contentBase64: "abc",
    };

    reportsApi.importCommit("artists", body);

    expect(apiClientMock.post).toHaveBeenCalledWith("/reports/entities/artists/import/commit", body);
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
