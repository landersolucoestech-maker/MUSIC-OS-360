import { afterEach, describe, expect, it, vi } from "vitest";

import { api, resolveApiUserMessage, setAccessToken, setTenantId } from "./api-client";
import { IntegrationError, NotFoundError, PasswordChangeRequiredError, TenantError, toUserMessage } from "./errors";

function mockResponse(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("api-client response contract", () => {
  afterEach(() => {
    setAccessToken(null);
    setTenantId(null);
    vi.unstubAllGlobals();
  });

  it("unwraps an object payload", async () => {
    mockResponse({
      data: { entities: [{ name: "artists" }] },
      timestamp: "2026-06-19T00:00:00.000Z",
    });

    await expect(
      api.get<{ entities: Array<{ name: string }> }>("/reports/entities"),
    ).resolves.toEqual({ entities: [{ name: "artists" }] });
  });

  it("unwraps an array payload", async () => {
    mockResponse({
      data: [{ entity: "artists" }, { entity: "contracts" }],
      timestamp: "2026-06-19T00:00:00.000Z",
    });

    await expect(
      api.get<Array<{ entity: string }>>("/reports/definitions"),
    ).resolves.toHaveLength(2);
  });

  it("returns the data array from a paginated HTTP response", async () => {
    mockResponse({
      data: [{ id: "ticket-1" }],
      meta: { total: 1, offset: 0, limit: 200 },
      timestamp: "2026-06-19T00:00:00.000Z",
    });

    await expect(
      api.get<Array<{ id: string }>>("/support-tickets?limit=200"),
    ).resolves.toEqual([{ id: "ticket-1" }]);
  });

  it("returns undefined for an empty response", async () => {
    mockResponse(undefined, 204);

    await expect(api.delete("/financial-categories/category-1")).resolves.toBeUndefined();
  });

  it("maps a 403 MUST_CHANGE_PASSWORD body to PasswordChangeRequiredError (Part 74)", async () => {
    mockResponse({ statusCode: 403, error: "MUST_CHANGE_PASSWORD", message: "Troca de senha obrigatória." }, 403);

    await expect(api.get("/artists")).rejects.toBeInstanceOf(PasswordChangeRequiredError);
  });

  it("maps any other 403 body to the generic TenantError (unchanged behavior)", async () => {
    mockResponse({ statusCode: 403, error: "TENANT_SUSPENDED", message: "Tenant suspenso." }, 403);

    await expect(api.get("/artists")).rejects.toBeInstanceOf(TenantError);
  });
});

describe("api-client error boundary — API copy is userMessage, diagnostics never reach the UI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function caught(): Promise<unknown> {
    return api.get("/artists").then(
      () => { throw new Error("expected rejection"); },
      (err: unknown) => err,
    );
  }

  it("403: the API message is the user copy — the internal '[tenant] Cross-tenant…' diagnostic is not", async () => {
    mockResponse({ statusCode: 403, error: "TENANT_SUSPENDED", message: "Tenant suspenso." }, 403);
    const err = await caught();
    expect(err).toBeInstanceOf(TenantError);
    expect(toUserMessage(err)).toBe("Tenant suspenso.");
    expect(toUserMessage(err)).not.toMatch(/Cross-tenant|record org/);
  });

  it("404: the API message is the user copy (no 'not found' diagnostic appended)", async () => {
    mockResponse({ statusCode: 404, message: "Artista não encontrado." }, 404);
    const err = await caught();
    expect(err).toBeInstanceOf(NotFoundError);
    expect(toUserMessage(err)).toBe("Artista não encontrado.");
  });

  it("5xx: keeps the machine error code; user copy is the API message", async () => {
    mockResponse({ statusCode: 503, error: "R2_NOT_CONFIGURED", message: "Upload indisponível no momento." }, 503);
    const err = await caught();
    expect(err).toBeInstanceOf(IntegrationError);
    expect((err as IntegrationError).errorCode).toBe("R2_NOT_CONFIGURED");
    expect(toUserMessage(err)).toBe("Upload indisponível no momento.");
  });

  it("network failure: raw 'Failed to fetch' never reaches the user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await caught();
    expect(toUserMessage(err)).toMatch(/Falha de conexão/);
    expect(toUserMessage(err)).not.toMatch(/Failed to fetch/);
  });
});

const RAW_PROVIDER = "ECONNREFUSED 10.0.0.5:5432 password authentication failed";
const RAW_DB = 'duplicate key value violates unique constraint "artists_slug_key"';
const RAW_STACK = "TypeError: x is undefined\n    at ArtistsService.find (/app/src/artists.service.ts:41:13)";
const LEAKS = ["ECONNREFUSED", "password authentication", "duplicate key", "violates", "artists_slug_key", "10.0.0.5", "TypeError", "artists.service.ts"];

describe("api-client error boundary — raw provider text in body.message never reaches userMessage", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function userMessageFor(status: number, body: unknown): Promise<string> {
    mockResponse(body, status);
    const err = await api.get("/artists").then(
      () => { throw new Error("expected rejection"); },
      (e: unknown) => e,
    );
    return toUserMessage(err, "FALLBACK");
  }

  it.each([
    [400, RAW_DB, "Bad Request"],
    [403, RAW_PROVIDER, "ForbiddenException"],
    [404, RAW_PROVIDER, "NotFoundException"],
    [409, RAW_DB, "ConflictException"],
    [500, RAW_PROVIDER, "Internal Server Error"],
    [502, RAW_STACK, "Bad Gateway"],
    [503, RAW_PROVIDER, "ServiceUnavailableException"],
  ])("status %i with raw text is mapped to PT-BR by status", async (status, raw, error) => {
    const message = await userMessageFor(status, { statusCode: status, error, message: raw });
    for (const leak of LEAKS) expect(message).not.toContain(leak);
    expect(message).toMatch(status >= 500 ? /^O servidor encontrou um problema/ : /^(Os dados enviados|Você não tem|Não encontramos|Não foi possível concluir)/);
  });

  it("a known code with raw text falls back to the code's PT-BR copy, not the server text", async () => {
    const message = await userMessageFor(503, { statusCode: 503, error: "SESSION_UPDATE_FAILED", message: RAW_PROVIDER });
    expect(message).toBe("Não foi possível atualizar a sessão. Tente novamente.");
  });

  it("raw text inside a validation array is dropped, safe PT-BR entries are kept", async () => {
    const message = await userMessageFor(400, {
      statusCode: 400,
      error: "VALIDATION_FAILED",
      message: ["Nome é obrigatório.", RAW_DB],
    });
    expect(message).toBe("Nome é obrigatório.");
  });

  it("a validation array with only raw text yields the VALIDATION_FAILED default", async () => {
    const message = await userMessageFor(400, { statusCode: 400, error: "VALIDATION_FAILED", message: [RAW_STACK] });
    expect(message).toMatch(/inválidos/);
    for (const leak of LEAKS) expect(message).not.toContain(leak);
  });

  it("English text without a technical marker is not shown either (no PT-BR signal, unknown code)", async () => {
    const message = await userMessageFor(500, { statusCode: 500, error: "Internal Server Error", message: "Something went wrong" });
    expect(message).not.toContain("Something");
    expect(message).toMatch(/servidor/);
  });

  it("non-string / missing body message maps by status", async () => {
    expect(await userMessageFor(500, { message: { nested: RAW_PROVIDER } })).toMatch(/servidor/);
    expect(await userMessageFor(404, {})).toBe("Não encontramos o recurso solicitado.");
    expect(await userMessageFor(429, { message: undefined })).toMatch(/Muitas tentativas/);
  });

  it("legitimate PT-BR API messages still show", async () => {
    expect(await userMessageFor(400, { error: "VALIDATION_FAILED", message: ["O campo e-mail está em um formato inválido.", "Nome é obrigatório."] }))
      .toBe("O campo e-mail está em um formato inválido.; Nome é obrigatório.");
    expect(await userMessageFor(404, { error: "NotFoundException", message: "Artista não encontrado." })).toBe("Artista não encontrado.");
    expect(await userMessageFor(409, { error: "ConflictException", message: "Já existe um convite pendente para este e-mail." }))
      .toBe("Já existe um convite pendente para este e-mail.");
    expect(await userMessageFor(503, { error: "R2_NOT_CONFIGURED", message: "Upload indisponível no momento." })).toBe("Upload indisponível no momento.");
  });

  it("resolveApiUserMessage: oversized text and prototype-key codes are not trusted", () => {
    expect(resolveApiUserMessage(400, { message: "Erro não permitido. ".repeat(40) })).toMatch(/inválidos/);
    const viaProto = resolveApiUserMessage(500, { error: "constructor", message: RAW_PROVIDER });
    expect(viaProto).toMatch(/servidor/);
  });
});
