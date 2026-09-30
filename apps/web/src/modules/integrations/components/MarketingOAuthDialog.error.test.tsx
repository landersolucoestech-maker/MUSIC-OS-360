import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { MarketingOAuthDialog } from "./MarketingOAuthDialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const RAW = 'QueryFailedError: duplicate key value violates unique constraint "uq_integrations_tenant_platform"';

function respondWith(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status, json: async () => body }) as Response));
}

async function clickConnect() {
  render(<MarketingOAuthDialog open onOpenChange={() => undefined} platform="corp_tiktok" onConnect={async () => undefined} />);
  fireEvent.click(screen.getByTestId("button-oauth-open-corp_tiktok"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  return vi.mocked(toast.error).mock.calls[0][0] as string;
}

describe("MarketingOAuthDialog /oauth/init failure copy", () => {
  beforeEach(() => {
    vi.spyOn(window, "open").mockReturnValue({ close: vi.fn(), focus: vi.fn(), closed: false } as unknown as Window);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("never shows raw English server text; shows mapped PT-BR copy instead", async () => {
    respondWith(500, { message: RAW, error: "Internal Server Error" });
    const shown = await clickConnect();
    expect(shown).not.toMatch(/QueryFailedError|constraint|uq_integrations/);
    expect(shown).toBe("O servidor encontrou um problema. Tente novamente em instantes.");
    expect(document.body.textContent).not.toContain("QueryFailedError");
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("QueryFailedError");
  });

  it("keeps PT-BR API copy", async () => {
    respondWith(400, { message: "Plataforma não suportada para conexão.", error: "Bad Request" });
    expect(await clickConnect()).toBe("Plataforma não suportada para conexão.");
  });

  it("falls back to PT-BR copy when the body is not an object", async () => {
    respondWith(502, null);
    const shown = await clickConnect();
    expect(shown).toBe("O servidor encontrou um problema. Tente novamente em instantes.");
  });
});
