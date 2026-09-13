/**
 * Projects.metadata-guard.test.ts
 *
 * Guarda permanente (auditoria 2026-07-18 — projects CRÍTICO confirmado):
 * o import em massa de projetos serializava musicas[] com JSON.stringify()
 * dentro de `descricao` — anti-padrão real, corrigido pela normalização em
 * project_tracks (migration 20260718000013).
 *
 * Parte 86: o import em massa deixou de existir em Projects.tsx — Importação
 * e Exportação passaram a existir exclusivamente na Central de Relatórios
 * (modules/reports/), cujo resolver dedicado para o campo computed
 * `projects.musicas` (apps/api/.../computed-fields/projects-musicas.field.ts)
 * é hoje o único caminho de import em massa e nunca escreve em `descricao`
 * (coberto por computed-fields/projects-musicas.field.spec.ts e
 * import-commit.service.spec.ts). Este teste, portanto, passou a garantir a
 * ausência estrutural de um SEGUNDO writer client-side em Projects.tsx — se
 * ele reaparecer, deve continuar enviando musicas estruturado, nunca serializado.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "Projects.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("Projects.tsx — sem import em massa client-side (centralizado em Relatórios, Parte 86)", () => {
  it("não usa mais JSON.stringify(musicasParaSalvar) em lugar nenhum do arquivo", () => {
    expect(SOURCE).not.toMatch(/JSON\.stringify\(musicasParaSalvar\)/);
  });

  it("não reintroduz um segundo writer de import em massa (mutação addProjeto fora do modal de criar/editar)", () => {
    expect(SOURCE).not.toMatch(/importXlsx/);
    expect(SOURCE).not.toMatch(/addProjeto\.mutateAsync/);
  });
});
