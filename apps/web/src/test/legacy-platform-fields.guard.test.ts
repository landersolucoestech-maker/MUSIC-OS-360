/**
 * legacy-platform-fields.guard.test.ts
 *
 * Proteção permanente: o domínio Artista trabalha EXCLUSIVAMENTE com
 * foto_url/spotify_url/youtube_url. Nenhuma referência a spotify_artist_id,
 * youtube_artist_id, youtube_channel_id, banner_url ou video_apresentacao(_url)
 * pode existir em código-fonte vivo do frontend — nem como campo, nem como
 * utilitário de extração/reconstrução de ID (o frontend nunca extrai ID de
 * plataforma; isso é uma exceção documentada e restrita à camada de
 * integração do backend — ver apps/api's legacy-platform-fields.guard.spec.ts).
 *
 * Exceção documentada: artista-url-only-domain.test.ts referencia os nomes
 * legados como fixture, exatamente para provar que o mapper/form NUNCA os
 * produz — referenciá-los ali é o próprio teste de regressão.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");
const THIS_FILE = path.resolve(__filename);
const REGRESSION_TEST_EXCEPTION = path.resolve(SRC_ROOT, "test/artista-url-only-domain.test.ts");

const FORBIDDEN_SNAKE = [
  /spotify_artist_id/i,
  /youtube_artist_id/i,
  /youtube_channel_id/i,
  /banner_url/i,
  /video_apresentacao/i,
];

const FORBIDDEN_CAMEL = [
  /spotifyArtistId/i,
  /youtubeArtistId/i,
  /youtubeChannelId/i,
  /bannerUrl/i,
  /videoApresentacao/i,
];

// Utilitários de extração/reconstrução de ID↔URL: nenhum deve existir no frontend.
const FORBIDDEN_UTIL_NAMES = [
  /extractSpotifyId/,
  /extractYoutubeId/,
  /spotifyIdToUrl/,
  /youtubeIdToUrl/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("Permanent guard: the artist domain (frontend) only uses foto_url/spotify_url/youtube_url", () => {
  const allFiles = walk(SRC_ROOT).filter((f) => f !== THIS_FILE);

  it("no file contains the snake_case forms of the removed fields", () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      if (file === REGRESSION_TEST_EXCEPTION) continue;
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_SNAKE) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(SRC_ROOT, file)} — matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no file contains the camelCase forms of the removed fields", () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      if (file === REGRESSION_TEST_EXCEPTION) continue;
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_CAMEL) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(SRC_ROOT, file)} — matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no ID↔URL extraction/reconstruction utility exists in the frontend", () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_UTIL_NAMES) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(SRC_ROOT, file)} — matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
