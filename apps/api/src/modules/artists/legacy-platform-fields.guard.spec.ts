/**
 * legacy-platform-fields.guard.spec.ts
 *
 * Proteção permanente: o domínio Artista trabalha EXCLUSIVAMENTE com
 * spotify_url/youtube_url/foto_url. Nenhuma referência a spotify_artist_id,
 * youtube_artist_id, youtube_channel_id pode existir como campo PERSISTIDO ou
 * EXPOSTO (coluna de banco, propriedade de DTO, header de export/import,
 * payload de API). Se qualquer DTO, entidade, service ou mapper reintroduzir
 * esses campos, este teste falha imediatamente.
 *
 * O que este guard NÃO proíbe (Plataformas 17 — reaudição pós-Soundcharts):
 * extrair um ID em memória, de uma URL já validada, para endereçar uma API
 * externa que só aceita ID (nunca URL) — desde que o ID nunca seja persistido
 * na entidade Artist nem exposto em DTO/export/import. Esse padrão já existia
 * antes da Soundcharts (exceção 1 abaixo) e se repetiu legitimamente na nova
 * arquitetura de métricas (exceções 3 e 4) pela mesma razão: a Soundcharts
 * também resolve artista por ID de plataforma, não por URL.
 *
 * Exceções documentadas e aprovadas — cada uma comprovada pela mesma regra
 * (ID só em memória, nunca persistido/exposto; ver o teste dedicado abaixo,
 * que roda a MESMA verificação para todas):
 *
 *   1. artist-external-profile-sync.service.ts — os métodos PRIVADOS
 *      extractSpotifyArtistId/resolveYoutubeRef (renomeado de
 *      extractYouTubeChannelId — find-eb3c5c45-class, agora delega ao
 *      parser canônico único em youtube-ref.util.ts) extraem um ID/ref em
 *      memória para chamar as APIs reais do Spotify/YouTube diretamente.
 *
 *   2. create-artist.dto.spec.ts — teste de regressão que envia os campos
 *      legados como fixture, exatamente para provar que a API os REJEITA
 *      (whitelist/forbidNonWhitelisted). Referenciá-los ali é o próprio teste.
 *
 *   3. platform-profiles/providers/spotify-artist-profile.provider.ts —
 *      chama `parseSpotifyArtistId(url)` (utilitário puro, ver exceção 5) só
 *      para obter o ID que `SoundchartsService.resolveArtistByPlatform`
 *      exige; o ID nunca sai do escopo da função, nunca vai para
 *      `raw_payload` nem para nenhuma coluna de `artists`.
 *
 *   4. platform-profiles/soundcharts-canonical-candidates.util.ts — resolve a
 *      cadeia canônica spotify→youtube→deezer→soundcloud para a Soundcharts;
 *      usa `parseSpotifyArtistId` (exceção 5) e a função local
 *      `extractYouTubeChannelId` (regex pura, só reconhece um id UC… já
 *      explícito na URL — resolução de @handle continua isolada dentro de
 *      YouTubeArtistProfileProvider, que usa a YouTube Data API, não este
 *      util). Nenhum dos dois IDs é persistido — servem só para montar
 *      `{ platform, externalId }` e chamar a Soundcharts.
 *
 *   5. integrations/spotify/spotify-url.util.ts (+ seu spec) — o parser em si
 *      (`parseSpotifyArtistId`), function pura sem I/O, compartilhada
 *      DELIBERADAMENTE pelas exceções 3/4 (Soundcharts) e por
 *      integrations/spotify/spotify.service.ts (OAuth de conexão de conta
 *      Spotify — domínio de Integrations, não toca ArtistEntity). Fora do
 *      domínio Artista por definição — nunca lê/escreve `artists`.
 *
 *   6. integrations/spotify/spotify.service.ts — serviço de OAuth
 *      (getAuthUrl/handleCallback/disconnect/getValidToken) sobre
 *      OAuthConnectionEntity, não ArtistEntity; usa `parseSpotifyArtistId`
 *      só para `extractArtistId()`/`syncArtistMetrics()` (endpoint próprio
 *      de Integrations, sem qualquer escrita em `artists` ou
 *      `artist_platform_profiles`). Fora do domínio Artista.
 *      OBSERVAÇÃO (não corrigida aqui — fora do escopo desta tarefa):
 *      `syncArtistMetrics()` duplica parcialmente a responsabilidade de
 *      `SpotifyArtistProfileProvider.resolve()` (ambos buscam dados públicos
 *      de artista no Spotify), mas por rotas e para consumidores diferentes —
 *      não persiste em `artist_platform_profiles`, então não ameaça a regra
 *      protegida por este guard. Investigar se ainda tem consumidor real é
 *      uma decisão de produto separada, não uma correção de código morto
 *      óbvia.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..', '..');
const THIS_FILE = path.resolve(__filename);

function resolveInSrc(relativePath: string): string {
  return path.resolve(SRC_ROOT, relativePath);
}

const ALL_EXCEPTIONS = new Set([
  resolveInSrc('modules/artists/platform-profiles/artist-external-profile-sync.service.ts'),
  resolveInSrc('modules/artists/dto/create-artist.dto.spec.ts'),
  resolveInSrc('modules/artists/platform-profiles/providers/spotify-artist-profile.provider.ts'),
  resolveInSrc('modules/artists/platform-profiles/soundcharts-canonical-candidates.util.ts'),
  resolveInSrc('modules/integrations/spotify/spotify-url.util.ts'),
  resolveInSrc('modules/integrations/spotify/spotify-url.util.spec.ts'),
  resolveInSrc('modules/integrations/spotify/spotify.service.ts'),
]);

// Formas reais que os campos removidos assumiriam se vazassem para uma coluna
// de banco, propriedade de DTO, header de export/import ou payload de API —
// TUDO neste codebase usa snake_case para esses contextos (ver ArtistEntity,
// CreateArtistDto, ReportEntityDefinition). CamelCase é adicional só para
// cobrir identificadores de código (variável/propriedade TS).
const FORBIDDEN_SNAKE = [
  /spotify_artist_id/i,
  /youtube_artist_id/i,
  /youtube_channel_id/i,
];

const FORBIDDEN_CAMEL = [
  /spotifyArtistId/i,
  /youtubeArtistId/i,
  /youtubeChannelId/i,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      // Migrations de rollback (down()) são a exceção explícita da regra 7 —
      // recriam colunas legadas de propósito para reverter a migração de drop.
      if (full === path.resolve(SRC_ROOT, 'database/migrations')) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('Guarda permanente: domínio Artista só usa foto_url/spotify_url/youtube_url', () => {
  const allFiles = walk(SRC_ROOT).filter((f) => f !== THIS_FILE);

  it('nenhum arquivo (exceto migrations/down e exceções documentadas) contém as formas snake_case dos campos removidos', () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      if (ALL_EXCEPTIONS.has(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_SNAKE) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(SRC_ROOT, file)} — matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('nenhum arquivo (exceto exceções documentadas) contém as formas camelCase dos campos removidos', () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      if (ALL_EXCEPTIONS.has(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_CAMEL) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(SRC_ROOT, file)} — matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('NENHUMA exceção de extração-por-ID persiste ou expõe a forma snake_case (o ID fica só em memória)', () => {
    // Generalização (Plataformas 17): antes só a exceção 1 era verificada assim.
    // Agora as 6 exceções de "extrai ID em memória para chamar API externa"
    // passam pela MESMA prova — se qualquer uma delas deixar a forma
    // snake_case vazar para dentro do arquivo (a forma que um campo
    // persistido/exposto assumiria), o guard falha mesmo sendo exceção.
    // create-artist.dto.spec.ts fica de fora de propósito: é o ÚNICO caso onde
    // a forma snake_case DEVE aparecer — a fixture manda esses campos exatos
    // para provar que a API os rejeita (ver teste dedicado logo abaixo).
    const dtoRegressionSpec = resolveInSrc('modules/artists/dto/create-artist.dto.spec.ts');
    for (const exceptionFile of ALL_EXCEPTIONS) {
      if (exceptionFile === dtoRegressionSpec) continue;
      const content = fs.readFileSync(exceptionFile, 'utf8');
      for (const pattern of FORBIDDEN_SNAKE) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('create-artist.dto.spec.ts contém a forma snake_case só como fixture de rejeição, nunca como valor aceito', () => {
    const content = fs.readFileSync(resolveInSrc('modules/artists/dto/create-artist.dto.spec.ts'), 'utf8');
    expect(content).toMatch(/rejeita payload/i);
    expect(content).toMatch(/errors\.length\)\.toBeGreaterThan\(0\)/);
  });

  it('a exceção do sync service mantém a extração como método privado (não exposto na API pública da classe)', () => {
    const content = fs.readFileSync(
      resolveInSrc('modules/artists/platform-profiles/artist-external-profile-sync.service.ts'),
      'utf8',
    );
    expect(content).toMatch(/private\s+extractSpotifyArtistId/);
    // find-eb3c5c45-class: extractYouTubeChannelId was renamed to
    // resolveYoutubeRef and now delegates to youtube-ref.util.ts's
    // parseYoutubeRef (the single canonical YouTube ref parser) — still a
    // private, in-memory-only method, same exception category.
    expect(content).toMatch(/private\s+resolveYoutubeRef/);
  });

  it('nenhuma exceção documentada persiste o ID em artist_platform_profiles.raw_payload ou em qualquer coluna de artists', () => {
    // O único dado real que pode sobreviver ao fim da função é o UUID da
    // Soundcharts (raw_payload.soundcharts_uuid) — nunca o id/handle da
    // própria plataforma de origem (spotify/youtube).
    for (const relativePath of [
      'modules/artists/platform-profiles/providers/spotify-artist-profile.provider.ts',
      'modules/artists/platform-profiles/soundcharts-canonical-candidates.util.ts',
    ]) {
      const content = fs.readFileSync(resolveInSrc(relativePath), 'utf8');
      expect(content).not.toMatch(/raw_payload\s*:\s*\{[^}]*spotify_?[Aa]rtist_?[Ii]d/);
      expect(content).not.toMatch(/raw_payload\s*:\s*\{[^}]*youtube_?[Cc]hannel_?[Ii]d/);
    }
  });
});
