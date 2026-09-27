/**
 * Permanent guard (Wave 13 — item 7): UserFormModal.tsx had a whole
 * "Permissões" tab (per-module checkbox grid, templates, department
 * selector, artist link) that was never sent in onSubmit — the admin
 * checked/unchecked permissions, saved, and nothing persisted. The only real
 * field of that tab was the access level selector (nivel_acesso -> cargo ->
 * PATCH /users/:id/role, with the RBAC's own authorization/auditing).
 *
 * This test prevents the reintroduction of the dead UI: no per-module permission
 * grid, permission template or client-side-only artist link
 * in this file — the single source of truth for permissions is the
 * roles system (useRoles/rbac-admin.controller.ts), managed at /usuarios.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "UserFormModal.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("UserFormModal.tsx — no dead per-module permissions UI", () => {
  it("no longer declares the per-module permission grid (MODULOS/ModulePermissions/togglePermission)", () => {
    expect(SOURCE).not.toMatch(/\bMODULOS\b/);
    expect(SOURCE).not.toMatch(/\bModulePermissions\b/);
    expect(SOURCE).not.toMatch(/\btogglePermission\b/);
    expect(SOURCE).not.toMatch(/\bPERMISSION_TEMPLATES\b/);
    expect(SOURCE).not.toMatch(/\bSETOR_PERMISSIONS\b/);
  });

  it("no longer declares the fake artist link (dropdown always empty, never sent)", () => {
    expect(SOURCE).not.toMatch(/\bartistaVinculado\b/);
    expect(SOURCE).not.toMatch(/\bARTISTAS_OPCOES\b/);
  });

  it("no longer declares the department selector (no matching field in the users backend)", () => {
    expect(SOURCE).not.toMatch(/\bSETORES\b/);
  });

  it("onSubmit sends only fields the backend really supports (full_name/phone/cargo)", () => {
    const onSubmitStart = SOURCE.indexOf("const onSubmit");
    const onSubmitEnd = SOURCE.indexOf("const selectedNivel", onSubmitStart);
    const onSubmitBody = SOURCE.slice(onSubmitStart, onSubmitEnd);
    expect(onSubmitBody).toMatch(/full_name:\s*data\.nome/);
    expect(onSubmitBody).toMatch(/phone:\s*data\.telefone/);
    expect(onSubmitBody).toMatch(/cargo:\s*data\.nivel_acesso/);
    expect(onSubmitBody).not.toMatch(/permissions|setor|artistaVinculado/);
  });

  it("keeps the only real access field (nivel_acesso) visible in the form", () => {
    expect(SOURCE).toMatch(/nivel_acesso/);
    expect(SOURCE).toMatch(/NIVEIS_ACESSO/);
  });
});
