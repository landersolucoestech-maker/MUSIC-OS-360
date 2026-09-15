/**
 * Configuracoes.rbac-shadow-disclosure.guard.test.ts
 *
 * Guarda permanente (CODEBASE_MAP Gotcha #17 -- "the most significant
 * UX-integrity finding in the whole map"): the "Papéis e Permissões" editor
 * is fully backend-wired (create role, toggle permission, set inheritance)
 * with zero indication that RBAC_PERSISTED_AUTHORITY can default to SHADOW
 * on the backend -- an admin unchecking a permission saw full success
 * confirmation while nothing was actually enforced yet. This test fails if
 * the disclosure banner or its data source regresses.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CONFIGURACOES = fs.readFileSync(path.resolve(__dirname, "Configuracoes.tsx"), "utf8");
const USE_ROLES = fs.readFileSync(
  path.resolve(__dirname, "../hooks/useRoles.ts"),
  "utf8",
);

describe("Configuracoes — RBAC shadow-mode disclosure (CODEBASE_MAP #17)", () => {
  it("useRoles fetches the real backend authority mode", () => {
    expect(USE_ROLES).toMatch(/api\.get<RbacAuthorityMode>\(["']\/rbac\/authority-mode["']\)/);
    expect(USE_ROLES).toMatch(/authorityMode:\s*authorityModeQuery\.data/);
  });

  it("the Papéis e Permissões card renders a not-enforced banner sourced from authorityMode", () => {
    expect(CONFIGURACOES).toMatch(/authorityMode\s*&&\s*!authorityMode\.enforced/);
    expect(CONFIGURACOES).toMatch(/data-testid="alert-rbac-not-enforced"/);
  });

  it("never claims enforcement is on merely because the editor UI is functional", () => {
    // The banner must gate on the real backend flag, not on roles.length or isLoading alone.
    const bannerBlock = CONFIGURACOES.slice(
      CONFIGURACOES.indexOf('data-testid="alert-rbac-not-enforced"') - 200,
      CONFIGURACOES.indexOf('data-testid="alert-rbac-not-enforced"'),
    );
    expect(bannerBlock).toMatch(/authorityMode/);
  });
});
