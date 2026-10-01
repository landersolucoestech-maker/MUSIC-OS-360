/**
 * Permanent guard for the users update HTTP contract.
 *
 * Profile data uses PATCH /users/:id. Role changes must use the
 * dedicated RBAC endpoint PATCH /users/:id/role, which has its own authorization and
 * auditing. The legacy `cargo` alias was removed: the input carries `role`.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "useUsers.ts");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("useUsers — profile and RBAC contracts", () => {
  it("maps full_name to fullName in the profile PATCH", () => {
    expect(SOURCE).toMatch(/fullName:\s*full_name/);
    expect(SOURCE).toMatch(/api\.patch\(`\/users\/\$\{id\}`,\s*profilePayload\)/);
  });

  it("sends the role through the dedicated RBAC endpoint (AssignRoleDto { role })", () => {
    expect(SOURCE).toMatch(
      /api\.patch\(`\/users\/\$\{id\}\/role`,\s*\{\s*role\s*\}\)/,
    );
  });

  it("no longer carries the dead `cargo` alias (the API never returns it, the update input never needs it)", () => {
    expect(SOURCE).not.toMatch(/\bcargo\b/);
  });

  it("includes neither role nor cargo in the generic profile payload", () => {
    const profilePayload = SOURCE.match(/const profilePayload = \{[\s\S]*?\n\s*\};/)?.[0] ?? "";
    expect(profilePayload).not.toMatch(/\brole\b|\bcargo\b/);
  });
});
