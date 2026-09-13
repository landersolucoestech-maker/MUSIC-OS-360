import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * SUBCLUSTER C — métricas públicas de artista NÃO são conexão de conta.
 *
 * Elas vêm do Soundcharts com credenciais DA PLATAFORMA (INTERNAL_PLATFORM),
 * resolvidas por identificadores do próprio artista. Portanto a UI de métricas
 * jamais pode pedir OAuth do cliente nem sugerir que falta "vincular conta" —
 * isso mandaria o utilizador executar uma ação que não existe e que não
 * resolveria nada.
 *
 * Guard textual de propósito: o defeito é de COPY, e é exatamente o que volta
 * a aparecer quando alguém edita a tela sem conhecer a arquitetura.
 */
const FILE = join(__dirname, "ArtistPlatformMetrics.tsx");
const source = readFileSync(FILE, "utf8");

describe("Métricas públicas de artista não pedem conexão de conta", () => {
  it("não sugere vincular/conectar conta para métricas públicas", () => {
    for (const forbidden of [
      "sem conta vinculada",
      "Conecte seu Instagram",
      "Conecte seu TikTok",
      "Conecte sua conta Soundcharts",
      "Conta não vinculada",
      "Vincular conta",
    ]) {
      expect(source, `copy proibida encontrada: "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("não oferece fluxo de OAuth a partir da tela de métricas", () => {
    for (const forbidden of ["oauth/init", "oauth/exchange", "connectAccount("]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("usa causa honesta quando o perfil não é localizado na fonte", () => {
    expect(source).toContain("perfil não localizado na fonte");
  });
});
