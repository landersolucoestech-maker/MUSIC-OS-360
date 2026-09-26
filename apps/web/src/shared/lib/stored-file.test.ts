/**
 * find-df79ea88 — stored upload links open through the tenant-checked signed
 * download, never through the permanent public bucket URL.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({
  api: apiMock,
  getAccessToken: () => "tok",
  getTenantId: () => "tenant-x",
}));

import {
  uploadFileIdFromUrl, resolveStoredFileUrl, openStoredFile, storedFileDisplayName, fetchStoredFileBytes,
} from "./stored-file";

const T = "11111111-1111-4111-8111-111111111111";
const F = "22222222-2222-4222-8222-222222222222";
const PUBLIC = `https://pub-files.example.r2.dev/tenants/${T}/documents/${F}/Contrato_Final.pdf`;
const REF = `r2://musicos-bucket/tenants/${T}/spreadsheets/${F}/planilha.xlsx`;

describe("stored-file", () => {
  beforeEach(() => { apiMock.get.mockReset(); });

  it("extracts the fileId from public R2 URLs and r2:// references", () => {
    expect(uploadFileIdFromUrl(PUBLIC)).toBe(F);
    expect(uploadFileIdFromUrl(REF)).toBe(F);
    expect(uploadFileIdFromUrl("https://drive.google.com/file/d/abc/view")).toBeNull();
    expect(uploadFileIdFromUrl(`https://x/tenants/${T}/secret/${F}/a.pdf`)).toBeNull();
    expect(uploadFileIdFromUrl(null)).toBeNull();
  });

  it("upload links resolve to the signed URL from GET /uploads/:fileId/download (not the stored URL)", async () => {
    apiMock.get.mockResolvedValue({ url: "https://signed.example/x?X-Amz-Signature=s", expiresIn: 3600 });
    await expect(resolveStoredFileUrl(PUBLIC)).resolves.toBe("https://signed.example/x?X-Amz-Signature=s");
    expect(apiMock.get).toHaveBeenCalledWith(`/uploads/${F}/download`);
  });

  it("external links pass through the scheme guard; javascript: is refused", async () => {
    await expect(resolveStoredFileUrl("https://drive.google.com/f")).resolves.toBe("https://drive.google.com/f");
    await expect(resolveStoredFileUrl("javascript:alert(1)")).resolves.toBe("");
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it("openStoredFile opens the tab synchronously and navigates it to the signed URL; closes it on failure", async () => {
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    apiMock.get.mockResolvedValueOnce({ url: "https://signed.example/ok", expiresIn: 3600 });
    await openStoredFile(PUBLIC);
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.location.href).toBe("https://signed.example/ok");
    expect(tab.opener).toBeNull();

    apiMock.get.mockRejectedValueOnce(new Error("403"));
    await expect(openStoredFile(PUBLIC)).rejects.toThrow("403");
    expect(tab.close).toHaveBeenCalled();
    open.mockRestore();
  });

  it("display name never surfaces the raw storage URL of an upload", () => {
    expect(storedFileDisplayName(PUBLIC)).toBe("Contrato_Final.pdf");
    expect(storedFileDisplayName("https://drive.google.com/f")).toBe("https://drive.google.com/f");
  });

  it("preview bytes of an upload come from the authenticated /raw stream", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const buf = await fetchStoredFileBytes(PUBLIC);
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toMatch(new RegExp(`/api/v1/uploads/${F}/raw$`));
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    fetchSpy.mockRestore();
  });
});
