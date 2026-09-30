import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useCompanySettings } from "./useCompanySettings";

const RESPONSE = {
  legalName: "Gravadora Exemplo Ltda",
  tradeName: "Exemplo",
  cnpj: "00000000000191",
  stateRegistration: "123",
  contactName: "Maria",
  address: { zipCode: "01001000", street: "Praça da Sé", number: "1", complement: "sala 2", city: "São Paulo", state: "SP" },
  phone: "1130000000",
  banking: { bankName: "Banco X", agency: "0001", account: "12345-6" },
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  apiMock.get.mockReset().mockResolvedValue(RESPONSE);
  apiMock.patch.mockReset().mockResolvedValue(RESPONSE);
});

describe("useCompanySettings — English flat shape over the unchanged /company-settings wire contract", () => {
  it("maps the nested API response into the English flat shape", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper });
    await waitFor(() => expect(result.current.companySettings.city).toBe("São Paulo"));
    expect(result.current.companySettings).toMatchObject({
      zipCode: "01001000",
      street: "Praça da Sé",
      number: "1",
      complement: "sala 2",
      state: "SP",
      phone: "1130000000",
      contactName: "Maria",
      bankName: "Banco X",
      agency: "0001",
      account: "12345-6",
    });
  });

  it("sends the same wire keys (contactName/address.*/phone/banking.*) on PATCH", async () => {
    const { result } = renderHook(() => useCompanySettings(), { wrapper });
    await waitFor(() => expect(result.current.companySettings.city).toBe("São Paulo"));
    await act(async () => {
      await result.current.saveCompanySettings({
        zipCode: "20000000", street: "Rua A", number: "10", complement: "", city: "Rio", state: "RJ",
        phone: "2122223333", contactName: "João", bankName: "Banco Y", agency: "0002", account: "99-9",
      });
    });
    const [path, body] = apiMock.patch.mock.calls[0]!;
    expect(path).toBe("/company-settings");
    expect(body).toMatchObject({
      contactName: "João",
      address: { zipCode: "20000000", street: "Rua A", number: "10", complement: "", city: "Rio", state: "RJ" },
      phone: "2122223333",
      banking: { bankName: "Banco Y", agency: "0002", account: "99-9" },
    });
  });
});
