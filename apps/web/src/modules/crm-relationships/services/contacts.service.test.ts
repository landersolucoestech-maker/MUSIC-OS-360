/**
 * contacts.service.test.ts
 *
 * Guarda permanente (Fase 3 — persistência real de Contatos/Clientes):
 * contacts.service.ts NUNCA pode voltar a conter um mock de dados em
 * memória. Antes desta fase, o arquivo mantinha `let contacts = [...5 seeds
 * fictícios]` mutado em runtime — dados desapareciam a cada reload e eram
 * idênticos para todos os tenants.
 *
 * Este teste falha se o arquivo voltar a conter esses padrões, e confirma
 * comportamentalmente que list/create/update/remove sempre delegam para
 * `clientsService` (HTTP real, tabela `clients` → `/clients` — ver
 * clients.service.ts: "Contato" e "Cliente" são a mesma entidade física).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "contacts.service.ts");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "array de negócio module-level (let contacts =)", pattern: /let\s+contacts\s*=/ },
  { name: "delay simulado", pattern: /setTimeout\s*\(\s*resolve/ },
];

describe("contacts.service.ts — guarda permanente contra reintrodução de mock", () => {
  it("não contém nenhum padrão de mock de dados de negócio", () => {
    const violations = FORBIDDEN_PATTERNS
      .filter(({ pattern }) => pattern.test(SOURCE))
      .map(({ name }) => name);
    expect(violations).toEqual([]);
  });

  it("importa e usa o `clientsService` real (nenhum array próprio de contatos)", () => {
    expect(SOURCE).toMatch(/from\s+["']\.\/clients\.service["']/);
    expect(SOURCE).not.toMatch(/:\s*Contact\[\]\s*=\s*\[/);
  });
});

vi.mock("./clients.service", () => ({
  clientsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { clientsService } from "./clients.service";
import { contactsService } from "./contacts.service";

const wireRow = {
  id: "c1",
  tipo_pessoa: "pessoa_fisica",
  nome: "Ana Fotógrafa",
  categoria: "SERVICE_PROVIDER",
  perfil: "fotografo",
  status: "active",
  prioridade_contato: "medium",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("contactsService — delega sempre para o clientsService real (sem estado local)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() chama clientsService.list() e traduz o formato da API para Contact", async () => {
    vi.mocked(clientsService.list).mockResolvedValue([wireRow] as never);

    const result = await contactsService.list();

    expect(clientsService.list).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ id: "c1", name: "Ana Fotógrafa", contactType: "SERVICE_PROVIDER" }),
    ]);
  });

  it("create() delega para clientsService.create(...) sem gerar id localmente", async () => {
    vi.mocked(clientsService.create).mockResolvedValue({ ...wireRow, id: "server-id" } as never);

    const result = await contactsService.create({
      name: "Ana Fotógrafa",
      contactType: "SERVICE_PROVIDER",
      tags: [],
      status: "active",
      priority: "medium",
      payloadOperacional: { tipo_pessoa: "pessoa_fisica", perfil: "fotografo" },
      attachments: [],
      timeline: [],
    } as never);

    expect(clientsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ana Fotógrafa", category: "SERVICE_PROVIDER" }),
    );
    expect(result.id).toBe("server-id");
  });

  it("update() só envia campos alterados (payload parcial repassado ao clientsService)", async () => {
    vi.mocked(clientsService.update).mockResolvedValue(wireRow as never);

    await contactsService.update("c1", { notes: "nova observação" });

    const sentPayload = vi.mocked(clientsService.update).mock.calls[0][1] as Record<string, unknown>;
    expect(sentPayload["category"]).toBeUndefined();
    expect(sentPayload["notes"]).toBe("nova observação");
  });

  it("remove() delega para clientsService.remove(id)", async () => {
    vi.mocked(clientsService.remove).mockResolvedValue(undefined as never);
    await contactsService.remove("c1");
    expect(clientsService.remove).toHaveBeenCalledWith("c1");
  });

  it("propaga erros do clientsService sem mascarar (nenhum fallback de sucesso local)", async () => {
    vi.mocked(clientsService.list).mockRejectedValue(new Error("network down"));
    await expect(contactsService.list()).rejects.toThrow("network down");
  });
});
