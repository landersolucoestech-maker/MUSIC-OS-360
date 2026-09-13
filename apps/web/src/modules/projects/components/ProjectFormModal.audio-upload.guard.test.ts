/**
 * ProjectFormModal.audio-upload.guard.test.ts
 *
 * Guarda permanente (Task T — continuidade): `uploadFile` era um stub que
 * sempre retornava `null` — o upload de áudio por música nunca enviava nada
 * a lugar nenhum, mas exibia "Arquivo de áudio carregado localmente." como
 * se tivesse funcionado (falso-sucesso). `musica.audioUrl` nunca era
 * preenchido, então mesmo salvando o projeto o áudio se perdia. Este teste
 * falha se o stub voltar (ou se o real upload via R2 for removido).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ProjectFormModal.tsx"), "utf8");

describe("ProjectFormModal — upload de áudio usa o backend real (Task T)", () => {
  it("não contém mais o stub que sempre retornava null", () => {
    expect(SOURCE).not.toMatch(/async\s*\(_file: File\)[^{]*=>\s*null/);
  });

  it("usa useUploadToR2 para enviar o arquivo de fato", () => {
    expect(SOURCE).toMatch(/useUploadToR2/);
    expect(SOURCE).toMatch(/category:\s*"audio"/);
  });

  it("nunca exibe sucesso sem uma URL real (sem toast de 'carregado localmente' mascarando falha)", () => {
    expect(SOURCE).not.toMatch(/Arquivo de áudio carregado localmente/);
  });
});
