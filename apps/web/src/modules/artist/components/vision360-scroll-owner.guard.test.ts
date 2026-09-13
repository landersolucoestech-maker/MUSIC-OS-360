import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * REGRESSÃO — scroll do Artist 360 View Modal.
 *
 * Bug real medido em Chromium: o outer `<ScrollArea className="flex-1 min-h-0">`
 * do Radix não rolava. O Viewport do Radix usa `height: 100%`, que NÃO resolve
 * contra um pai dimensionado por flex-grow — o viewport mediu 1467px dentro de
 * um Root de 681.5px, logo `scrollHeight === clientHeight` e `scrollTop` nunca
 * saía de 0. Todo o conteúdo abaixo da dobra ficava inacessível.
 *
 * Correção: o scroll owner passou a ser um container de overflow NATIVO, que é
 * dimensionado pelo próprio flex e não depende de resolução de porcentagem.
 *
 * Este guard é textual de propósito: jsdom não faz layout, então a prova real de
 * scroll é o Playwright multi-viewport. O que este teste impede é a REGRESSÃO
 * estrutural — alguém "simplificar" de volta para o ScrollArea e reintroduzir o
 * bug sem que nada falhe.
 */
const FILE = join(__dirname, "ArtistVision360Modal.tsx");
const source = readFileSync(FILE, "utf8");

describe("Artist 360 modal — scroll owner estrutural", () => {
  it("o scroll owner existe e é um container de overflow nativo", () => {
    expect(source).toContain('data-testid="vision360-scroll"');
    expect(source).toMatch(/flex-1 min-h-0 overflow-y-auto[^"]*"\s+data-testid="vision360-scroll"/);
  });

  it("NÃO voltou a usar o ScrollArea do Radix como scroll owner externo", () => {
    // ScrollAreas internos (h-[150px], h-[320px]) continuam legítimos; o que não
    // pode voltar é o outer com flex-1, que é exatamente o padrão quebrado.
    expect(source).not.toContain('<ScrollArea className="flex-1 min-h-0">');
  });

  it("a cadeia flex acima do scroll owner continua intacta", () => {
    // Sem max-h no DialogContent o modal cresce além da viewport;
    // sem min-h-0 nos Tabs o filho flexível nunca é constrangido.
    expect(source).toContain("max-h-[90vh]");
    expect(source).toMatch(/<Tabs[^>]*className="[^"]*flex-1[^"]*min-h-0/);
  });

  it("o modal não ganhou overflow horizontal deliberado no scroll owner", () => {
    expect(source).not.toMatch(/data-testid="vision360-scroll"[^>]*overflow-x-auto/);
  });
});
