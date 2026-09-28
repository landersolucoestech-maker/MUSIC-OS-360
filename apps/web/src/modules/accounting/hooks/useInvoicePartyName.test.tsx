import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { storage } from "@/shared/lib/storage";
import {
  useInvoicePartyName,
  invoiceRecipientName,
  CLIENT_NOT_FOUND_LABEL,
} from "@/modules/accounting/hooks/useInvoicePartyName";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, findById: vi.fn() } };
});
const mockedFindById = vi.mocked(storage.findById);

const CLIENT_ID = "44444444-4444-4444-8444-444444444444";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useInvoicePartyName (invoices API embeds no client — resolved by client_id)", () => {
  beforeEach(() => mockedFindById.mockReset());

  it("uses the stored recipient name without any lookup", () => {
    const { result } = renderHook(() => useInvoicePartyName({ tomador_legal_name: "Razão SA", client_id: CLIENT_ID }), { wrapper: wrapper() });
    expect(result.current).toBe("Razão SA");
    expect(mockedFindById).not.toHaveBeenCalled();
  });

  it("resolves the client `name` by id through the 'clientes' storage key (/clients)", async () => {
    mockedFindById.mockResolvedValue({ id: CLIENT_ID, name: "Cliente Ltda" } as never);
    const { result } = renderHook(() => useInvoicePartyName({ client_id: CLIENT_ID }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toBe("Cliente Ltda"));
    expect(mockedFindById).toHaveBeenCalledWith("clientes", CLIENT_ID);
  });

  it("an id that does not resolve shows 'Cliente não encontrado', never the raw id", async () => {
    mockedFindById.mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useInvoicePartyName({ client_id: CLIENT_ID }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toBe(CLIENT_NOT_FOUND_LABEL));
    expect(CLIENT_NOT_FOUND_LABEL).toBe("Cliente não encontrado");
  });

  it("null when there is neither a recipient name nor a client", () => {
    const { result } = renderHook(() => useInvoicePartyName({}), { wrapper: wrapper() });
    expect(result.current).toBeNull();
    expect(mockedFindById).not.toHaveBeenCalled();
  });

  it("invoiceRecipientName prefers the legal name and ignores blanks", () => {
    expect(invoiceRecipientName({ tomador_legal_name: " ", tomador_name: "Fulano" })).toBe("Fulano");
    expect(invoiceRecipientName(null)).toBeNull();
  });
});

describe("invoice readers never read the non-existent `clientes` embed (guard)", () => {
  it.each([
    "../components/InvoiceViewModal.tsx",
    "../pages/Invoices.tsx",
    "../components/invoice-form/hooks/useInvoiceForm.ts",
  ])("%s", (rel) => {
    expect(fs.readFileSync(path.resolve(__dirname, rel), "utf8")).not.toMatch(/\.clientes\??\./);
  });
});
