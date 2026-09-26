/**
 * Guarda permanente para o contrato HTTP de atualização de usuários.
 *
 * Dados de perfil usam PATCH /users/:id. Alterações de papel devem usar o
 * endpoint RBAC dedicado PATCH /users/:id/role, que possui autorização e
 * auditoria próprias. O alias legado `cargo` pode alimentar o papel, mas nunca
 * deve ser enviado como chave literal ao backend.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "useUsuarios.ts");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("useUsuarios — profile and RBAC contracts", () => {
  it("traduz full_name para fullName no PATCH de perfil", () => {
    expect(SOURCE).toMatch(/fullName:\s*full_name/);
    expect(SOURCE).toMatch(/api\.patch\(`\/users\/\$\{id\}`,\s*profilePayload\)/);
  });

  it("sends role or the cargo alias through the dedicated RBAC endpoint", () => {
    expect(SOURCE).toMatch(/const effectiveRole = role \?\? cargo/);
    expect(SOURCE).toMatch(
      /api\.patch\(`\/users\/\$\{id\}\/role`,\s*\{\s*role:\s*effectiveRole\s*\}\)/,
    );
  });

  it("includes neither role nor cargo in the generic profile payload", () => {
    const profilePayload = SOURCE.match(/const profilePayload = \{[\s\S]*?\n\s*\};/)?.[0] ?? "";
    expect(profilePayload).not.toMatch(/\brole\b|\bcargo\b/);
    expect(SOURCE).not.toMatch(/\{\s*full_name,?\s*phone,?\s*cargo,?\s*\}/);
  });
});
