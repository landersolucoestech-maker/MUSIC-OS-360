import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import OAuthCallbackPage from "@/modules/integrations/pages/OAuthCallbackPage";

const RAW = "ECONNREFUSED 10.0.0.5:5432 password authentication failed";

function stubExchange(status: number, body: unknown): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe("OAuthCallbackPage - exchange error copy", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/oauth/meta_business?code=abc&state=meta_business:nonce-1");
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: { sessionStorage: { getItem: () => "nonce-1", removeItem: () => undefined } },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "opener", { configurable: true, value: null });
  });

  it("never renders raw provider/database text from body.message", async () => {
    stubExchange(502, { statusCode: 502, error: "Bad Gateway", message: RAW });
    const { container } = render(<OAuthCallbackPage />);
    await waitFor(() => expect(container.textContent).toMatch(/servidor/));
    expect(container.textContent).not.toContain("ECONNREFUSED");
    expect(container.textContent).not.toContain("password authentication");
  });

  it("never renders a raw message array entry", async () => {
    stubExchange(400, { statusCode: 400, error: "Bad Request", message: [RAW] });
    const { container } = render(<OAuthCallbackPage />);
    await waitFor(() => expect(container.textContent).toContain("inválidos"));
    expect(container.textContent).not.toContain("ECONNREFUSED");
  });

  it("still shows the API's own PT-BR copy", async () => {
    stubExchange(400, { statusCode: 400, error: "Bad Request", message: "O código de autorização expirou. Inicie a conexão novamente." });
    render(<OAuthCallbackPage />);
    expect(await screen.findByText(/O código de autorização expirou/)).toBeTruthy();
  });
});
