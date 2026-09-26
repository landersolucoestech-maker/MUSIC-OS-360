/**
 * leads.service.test.ts
 *
 * Guarda permanente (Fase 2 — persistência real de Leads): leads.service.ts
 * NUNCA pode voltar a conter um mock de dados em memória. Antes desta fase,
 * o arquivo mantinha um array `let leads = [...seedLeads]` mutado em runtime
 * (create/update/remove operavam sobre esse array, nunca sobre um backend
 * real) — dados desapareciam a cada reload da página e eram idênticos para
 * todos os tenants.
 *
 * Este teste falha se o arquivo voltar a conter: seeds/arrays de negócio,
 * mutação de variável module-level, IDs gerados localmente como substituto
 * de persistência, ou qualquer resposta estática. E confirma comportamentalmente
 * que list/create/update/remove sempre delegam para `api` (HTTP real, `/leads`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "leads.service.ts");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "seed de negócio (seedLeads)", pattern: /seedLeads/ },
  { name: "variável module-level mutável (let leads =)", pattern: /let\s+leads\s*=/ },
  { name: "geração local de id como substituto de persistência", pattern: /crypto\.randomUUID\(\)/ },
  { name: "delay simulado", pattern: /setTimeout\s*\(\s*resolve/ },
  { name: "array de leads hardcoded", pattern: /nomeCompleto:\s*["'`]Marina/ },
];

describe("leads.service.ts — permanent guard against reintroducing a mock", () => {
  it("contains no business-data mock pattern", () => {
    const violations = FORBIDDEN_PATTERNS
      .filter(({ pattern }) => pattern.test(SOURCE))
      .map(({ name }) => name);
    expect(violations).toEqual([]);
  });

  it("imports and uses only the real `api` (no own array)", () => {
    expect(SOURCE).toMatch(/from\s+["']@\/shared\/lib\/api-client["']/);
    expect(SOURCE).not.toMatch(/:\s*Lead\[\]\s*=\s*\[/);
  });
});

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "@/shared/lib/api-client";
import { leadsService } from "./leads.service";

const apiRow = {
  id: "1",
  nome: "X",
  nome_completo: "X",
  nomeArtistico: null,
  empresa: null,
  email: null,
  phone: null,
  whatsapp: null,
  instagram: null,
  city: null,
  state: null,
  country: null,
  clientType: null,
  serviceType: null,
  payloadServico: null,
  dadosInternosCRM: null,
  status: "novo",
  uploads: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("leadsService — always delegates to the real API (no local state)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() calls GET /leads and maps the API shape to Lead", async () => {
    vi.mocked(api.get).mockResolvedValue([apiRow] as never);

    const result = await leadsService.list();

    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("/leads"));
    expect(result).toEqual([expect.objectContaining({ id: "1", nomeCompleto: "X" })]);
  });

  it("create() delegates to POST /leads without generating an id locally", async () => {
    const created = { ...apiRow, id: "server-generated-id" };
    vi.mocked(api.post).mockResolvedValue(created as never);

    const result = await leadsService.create({ nomeCompleto: "Novo" } as never);

    expect(api.post).toHaveBeenCalledWith("/leads", expect.objectContaining({ name: "Novo" }));
    expect(result.id).toBe("server-generated-id");
  });

  it("update() delega para PATCH /leads/:id", async () => {
    const updated = { ...apiRow, nome_completo: "Atualizado" };
    vi.mocked(api.patch).mockResolvedValue(updated as never);

    const result = await leadsService.update("1", { nomeCompleto: "Atualizado" } as never);

    expect(api.patch).toHaveBeenCalledWith("/leads/1", expect.objectContaining({ name: "Atualizado" }));
    expect(result.nomeCompleto).toBe("Atualizado");
  });

  it("remove() delega para DELETE /leads/:id", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined as never);
    await leadsService.remove("1");
    expect(api.delete).toHaveBeenCalledWith("/leads/1");
  });

  it("propagates API errors without masking (no local success fallback)", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));
    await expect(leadsService.list()).rejects.toThrow("network down");
  });
});
