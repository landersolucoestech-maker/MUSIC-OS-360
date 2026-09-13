/**
 * Guarda permanente (Wave 13 — item 7): UsuarioFormModal.tsx tinha uma aba
 * "Permissões" inteira (grade de checkboxes por módulo, templates, seletor de
 * setor, vínculo de artista) que nunca era enviada em onSubmit — o admin
 * marcava/desmarcava permissões, salvava, e nada persistia. O único campo
 * real daquela aba era o seletor de Nível de Acesso (nivel_acesso -> cargo ->
 * PATCH /users/:id/role, com autorização/auditoria próprias do RBAC).
 *
 * Este teste impede a reintrodução da UI morta: nenhuma grade de permissões
 * por módulo, template de permissão ou vínculo de artista client-side-only
 * neste arquivo — a fonte única de verdade para permissões é o sistema de
 * roles (useRoles/rbac-admin.controller.ts), gerenciado em /usuarios.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "UsuarioFormModal.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("UsuarioFormModal.tsx — sem UI morta de permissões por módulo", () => {
  it("não declara mais a grade de permissões por módulo (MODULOS/ModulePermissions/togglePermission)", () => {
    expect(SOURCE).not.toMatch(/\bMODULOS\b/);
    expect(SOURCE).not.toMatch(/\bModulePermissions\b/);
    expect(SOURCE).not.toMatch(/\btogglePermission\b/);
    expect(SOURCE).not.toMatch(/\bPERMISSION_TEMPLATES\b/);
    expect(SOURCE).not.toMatch(/\bSETOR_PERMISSIONS\b/);
  });

  it("não declara mais o vínculo de artista fictício (dropdown sempre vazio, nunca enviado)", () => {
    expect(SOURCE).not.toMatch(/\bartistaVinculado\b/);
    expect(SOURCE).not.toMatch(/\bARTISTAS_OPCOES\b/);
  });

  it("não declara mais o seletor de setor (sem campo correspondente no backend de usuários)", () => {
    expect(SOURCE).not.toMatch(/\bSETORES\b/);
  });

  it("onSubmit só envia campos com suporte real no backend (full_name/phone/cargo)", () => {
    const onSubmitStart = SOURCE.indexOf("const onSubmit");
    const onSubmitEnd = SOURCE.indexOf("const selectedNivel", onSubmitStart);
    const onSubmitBody = SOURCE.slice(onSubmitStart, onSubmitEnd);
    expect(onSubmitBody).toMatch(/full_name:\s*data\.nome/);
    expect(onSubmitBody).toMatch(/phone:\s*data\.telefone/);
    expect(onSubmitBody).toMatch(/cargo:\s*data\.nivel_acesso/);
    expect(onSubmitBody).not.toMatch(/permissions|setor|artistaVinculado/);
  });

  it("mantém o único campo real de acesso (nivel_acesso) visível no formulário", () => {
    expect(SOURCE).toMatch(/nivel_acesso/);
    expect(SOURCE).toMatch(/NIVEIS_ACESSO/);
  });
});
