/**
 * ProjectFormModal.metadata-guard.test.ts
 *
 * Guarda permanente (auditoria 2026-07-18 — projects CRÍTICO confirmado):
 * ProjectFormModal.tsx serializava musicas[] com JSON.stringify() dentro de
 * `descricao` (texto livre) — proibido pela regra de produto. Normalizado em
 * project_tracks (migration 20260718000013). Este teste falha se o arquivo
 * voltar a serializar musicas em descricao.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "ProjectFormModal.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

describe("ProjectFormModal — does not serialize musicas into descricao", () => {
  it("no longer uses JSON.stringify(musicasParaSalvar) or JSON.parse(projeto.descricao)", () => {
    expect(SOURCE).not.toMatch(/JSON\.stringify\(musicasParaSalvar\)/);
    expect(SOURCE).not.toMatch(/JSON\.parse\(projeto\.descricao/);
  });

  it("sends musicas as a structured payload field (own storage via project_tracks)", () => {
    expect(SOURCE).toMatch(/musicas:\s*musicasParaSalvar/);
  });

  it("reads musicas from `projeto.musicas` (hydrated by the API), not from descricao", () => {
    expect(SOURCE).toMatch(/\(projeto as \{ musicas\?: MusicaData\[\] \}\)\.musicas/);
  });
});
