import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Finding fechado nesta correção: o backend (instagram-artist-profile.provider.ts
 * / tiktok-artist-profile.provider.ts) já classifica a resolução de identidade
 * em raw_payload.primary_identity_status ('VERIFIED_EXACT' | 'INSUFFICIENT_EVIDENCE'
 * | 'PROFILE_NOT_FOUND') -- um seguidor resolvido via UUID canônico (fallback
 * cross-platform, sem confirmação exata do handle) sem essa distinção aparecia
 * com a mesma confiança visual que um valor exato, apesar do catálogo da
 * Soundcharts poder fragmentar um artista real em múltiplas entidades internas.
 *
 * Este guard prova mecanicamente que a distinção chegou à UI para os dois
 * providers que usam o fallback canônico (Instagram, TikTok) -- os outros 5
 * (Spotify/YouTube/Deezer/AppleMusic/SoundCloud) resolvem só por lookup direto
 * (sem UUID canônico cross-platform), então não precisam desta indicação.
 */
const FILE = join(__dirname, "ArtistPlatformMetrics.tsx");
const source = readFileSync(FILE, "utf8");

describe("The unconfirmed-identity indicator (primary_identity_status) reaches the UI", () => {
  it("define o helper isUnverifiedIdentitySnapshot lendo primary_identity_status === INSUFFICIENT_EVIDENCE", () => {
    expect(source).toContain("function isUnverifiedIdentitySnapshot(");
    expect(source).toContain('raw_payload?.["primary_identity_status"] === "INSUFFICIENT_EVIDENCE"');
  });

  it("the Instagram card uses the helper for the visual indicator and the 'não confirmado' text", () => {
    const instagramCardStart = source.indexOf("metric-instagram-${artistId}");
    const instagramCardEnd = source.indexOf("hasInstagramProfileInput ? syncButton");
    const instagramCard = source.slice(instagramCardStart, instagramCardEnd);
    expect(instagramCard).toContain("isUnverifiedIdentitySnapshot(instagramSnapshot)");
    expect(instagramCard).toContain("não confirmado");
  });

  it("o card do TikTok usa o helper para o indicador visual e o texto 'não confirmado'", () => {
    const tiktokCardStart = source.indexOf("metric-tiktok-${artistId}");
    const tiktokCardEnd = source.indexOf("hasTikTokProfileInput ? syncButton");
    const tiktokCard = source.slice(tiktokCardStart, tiktokCardEnd);
    expect(tiktokCard).toContain("isUnverifiedIdentitySnapshot(tiktokSnapshot)");
    expect(tiktokCard).toContain("não confirmado");
  });

  it("o indicador não é confundido com o rótulo de dados de demonstração (dev_mock)", () => {
    // isDevMockSnapshot e isUnverifiedIdentitySnapshot são condições
    // independentes lendo campos distintos de raw_payload -- nunca um
    // substituindo o outro.
    expect(source).toContain('raw_payload?.["source"] === "dev_mock"');
    expect(source).toContain('raw_payload?.["primary_identity_status"] === "INSUFFICIENT_EVIDENCE"');
  });
});
