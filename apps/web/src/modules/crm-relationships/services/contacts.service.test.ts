/**
 * contacts.service.test.ts
 *
 * Permanent guard (Phase 3 — real persistence of Contacts/Clients):
 * contacts.service.ts may NEVER again contain an in-memory data
 * mock. Before this phase, the file kept `let contacts = [...5 fictitious
 * seeds]` mutated at runtime — data disappeared on every reload and was
 * identical for every tenant.
 *
 * This test fails if the file contains those patterns again, and confirms
 * behaviorally that list/create/update/remove always delegate to
 * `clientsService` (real HTTP, `clients` table → `/clients` — see
 * clients.service.ts: "Contact" and "Client" are the same physical entity).
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

describe("contacts.service.ts — permanent guard against reintroducing a mock", () => {
  it("contains no business-data mock pattern", () => {
    const violations = FORBIDDEN_PATTERNS
      .filter(({ pattern }) => pattern.test(SOURCE))
      .map(({ name }) => name);
    expect(violations).toEqual([]);
  });

  it("imports and uses the real `clientsService` (no own contacts array)", () => {
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
  type: "pessoa_fisica",
  name: "Ana Fotógrafa",
  category: "SERVICE_PROVIDER",
  perfil: "fotografo",
  status: "active",
  prioridade_contato: "medium",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("contactsService — always delegates to the real clientsService (no local state)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() calls clientsService.list() and maps the API shape to Contact", async () => {
    vi.mocked(clientsService.list).mockResolvedValue([wireRow] as never);

    const result = await contactsService.list();

    expect(clientsService.list).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ id: "c1", name: "Ana Fotógrafa", contactType: "SERVICE_PROVIDER" }),
    ]);
  });

  it("create() delegates to clientsService.create(...) without generating an id locally", async () => {
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

  it("update() sends only changed fields (partial payload passed to clientsService)", async () => {
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

  it("propagates clientsService errors without masking (no local success fallback)", async () => {
    vi.mocked(clientsService.list).mockRejectedValue(new Error("network down"));
    await expect(contactsService.list()).rejects.toThrow("network down");
  });
});
