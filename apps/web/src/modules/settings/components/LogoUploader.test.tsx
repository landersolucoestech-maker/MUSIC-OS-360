import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserFacingError } from "@/shared/lib/errors";

const RAW = "ECONNREFUSED 10.0.0.5:5432 password authentication failed";

const mocks = vi.hoisted(() => ({
  saveLogo: vi.fn(),
  removeLogo: vi.fn(),
  getLogo: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("@/app/providers/TenantContext", () => ({
  useTenant: () => ({
    tenant: { id: "ws-1", name: "Gravadora", config: {} },
    setTenant: vi.fn(),
  }),
}));
vi.mock("@/modules/settings/services/company-logo.service", () => ({
  validateLogoFile: vi.fn().mockResolvedValue({ ok: true }),
  companyLogoService: {
    saveLogo: mocks.saveLogo,
    removeLogo: mocks.removeLogo,
    getLogo: mocks.getLogo,
  },
}));

import { LogoUploader } from "./LogoUploader";

function shownToasts(): string[] {
  return mocks.toastError.mock.calls.map((call) => String(call[0]));
}

function expectSafe(messages: string[]) {
  expect(messages).toHaveLength(1);
  for (const m of messages) {
    expect(m).not.toContain("ECONNREFUSED");
    expect(m).not.toContain("password authentication");
    expect(m).not.toContain("Logo upload failed");
    expect(m).not.toContain("Failed to fetch");
  }
}

async function selectFile() {
  const input = (await screen.findByTestId("logo-input")) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "logo.png", { type: "image/png" })] } });
}

describe("LogoUploader error toasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLogo.mockResolvedValue("data:image/png;base64,AAAA");
  });

  it("save: a raw Error never reaches the toast; the PT-BR fallback does", async () => {
    mocks.saveLogo.mockRejectedValue(new Error(RAW));
    render(<LogoUploader />);
    await selectFile();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expectSafe(shownToasts());
    expect(shownToasts()[0]).toBe("Falha ao salvar a logo.");
  });

  it("save: a UserFacingError shows its PT-BR copy, not its English technical message", async () => {
    mocks.saveLogo.mockRejectedValue(new UserFacingError("Logo upload failed", "Falha ao enviar a logo. Tente novamente."));
    render(<LogoUploader />);
    await selectFile();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expectSafe(shownToasts());
    expect(shownToasts()[0]).toBe("Falha ao enviar a logo. Tente novamente.");
  });

  it("remove: raw Error and English UserFacingError technical text never reach the toast", async () => {
    mocks.removeLogo.mockRejectedValueOnce(new Error(RAW));
    render(<LogoUploader />);
    fireEvent.click(await screen.findByRole("button", { name: /Remover/ }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expectSafe(shownToasts());
    expect(shownToasts()[0]).toBe("Falha ao remover a logo.");

    mocks.toastError.mockClear();
    mocks.removeLogo.mockRejectedValueOnce(new UserFacingError(`Logo upload failed ${RAW}`, "Não foi possível remover agora."));
    fireEvent.click(await screen.findByRole("button", { name: /Remover/ }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expectSafe(shownToasts());
    expect(shownToasts()[0]).toBe("Não foi possível remover agora.");
  });
});
