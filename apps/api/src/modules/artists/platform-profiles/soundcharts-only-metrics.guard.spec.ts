import * as fs from 'fs';
import * as path from 'path';

/**
 * soundcharts-only-metrics.guard.spec.ts
 *
 * Guarda permanente (auditoria 2026-08-31): TODAS as métricas de plataforma
 * do card do artista devem vir exclusivamente da Soundcharts — nunca de
 * YouTube Data API / Spotify API / SoundCloud API / Meta Graph API / TikTok
 * API / Deezer API / Apple Music API diretas. Achado real corrigido nesta
 * auditoria: YouTubeArtistProfileProvider buscava total_views/total_videos
 * via `channels?part=statistics` da YouTube Data API, enquanto subscribers
 * já vinha da Soundcharts — dois motores de métrica concorrentes no mesmo
 * card. A Soundcharts `/audience/youtube` já devolve followerCount, postCount
 * e viewCount no MESMO item, então a chamada de estatísticas foi removida
 * (ver SoundchartsService.getYouTubeAudience). Este guard escaneia o código
 * fonte real dos 7 providers para nunca deixar essa regressão voltar
 * silenciosamente — falha em CI/local, não depende de alguém lembrar de
 * atualizar um teste com mock.
 */
const PROVIDERS_DIR = path.resolve(__dirname, 'providers');

const PROVIDER_FILES = [
  'spotify-artist-profile.provider.ts',
  'youtube-artist-profile.provider.ts',
  'deezer-artist-profile.provider.ts',
  'soundcloud-artist-profile.provider.ts',
  'instagram-artist-profile.provider.ts',
  'tiktok-artist-profile.provider.ts',
  'apple-music-artist-profile.provider.ts',
];

function readProvider(file: string): string {
  return fs.readFileSync(path.join(PROVIDERS_DIR, file), 'utf8');
}

/**
 * Remove comentários `//` e `/* *‍/` antes de escanear — os próprios
 * providers documentam em prosa o que NÃO usam mais (ex.: "não depende mais
 * de SOUNDCLOUD_CLIENT_ID"), o que faria um grep ingênuo acusar uma menção
 * histórica como se fosse uma chamada real. O guard deve escanear código
 * executável, não a explicação do código.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Padrões que só fazem sentido como CHAMADA DE MÉTRICA de provider direto —
// nunca aparecem em resolução de identidade (id/handle lookup) legítima.
// Verificados contra CÓDIGO (comentários já removidos), não prosa.
const METRIC_ONLY_PATTERNS = [
  /part=statistics/, // YouTube Data API — estatísticas de canal (views/videos/subscribers)
  /subscriberCount/,
  /\.statistics\??\./, // acesso ao objeto `statistics` da resposta da YouTube Data API
  /SOUNDCLOUD_CLIENT_ID/,
  /nb_fan/, // campo de métrica da API pública do Deezer
  /graph\.facebook\.com|graph\.instagram\.com/,
  /open\.tiktokapis\.com/,
  /api\.spotify\.com/,
  /api\.deezer\.com/,
  /itunes\.apple\.com|api\.music\.apple\.com/,
];

describe('SOUNDCHARTS ONLY — no platform metric provider calls a direct API', () => {
  it.each(PROVIDER_FILES)('%s: nenhum padrão de métrica de API direta presente no código executável', (file) => {
    const src = stripComments(readProvider(file));
    for (const pattern of METRIC_ONLY_PATTERNS) {
      expect(src).not.toMatch(pattern);
    }
  });

  it('YouTubeArtistProfileProvider: the YouTube Data API is referenced only for IDENTITY RESOLUTION (part=id / search), never for metrics', () => {
    const src = readProvider('youtube-artist-profile.provider.ts');
    // As duas únicas chamadas de rede diretas permitidas: resolução de
    // channelId por handle/username (part=id) e busca por nome (search).
    const fetchCalls = [...src.matchAll(/fetch\(\s*`\$\{YOUTUBE_API\}([^`]*)`/g)].map((m) => m[1]);
    expect(fetchCalls.length).toBeGreaterThan(0);
    for (const call of fetchCalls) {
      const isIdentityLookup = call.includes('part=id') || call.startsWith('/search');
      expect(isIdentityLookup).toBe(true);
    }
    // subscribers/total_views/total_videos devem vir todos de UMA chamada Soundcharts.
    expect(src).toContain('getYouTubeAudience');
    expect(src).not.toContain('getYouTubeSubscribers');
    expect(src).not.toContain('fetchChannelStatistics');
  });

  it('all 7 providers depend on SoundchartsService for the metric shown on the card', () => {
    for (const file of PROVIDER_FILES) {
      const src = readProvider(file);
      expect(src).toContain('SoundchartsService');
    }
  });

  it('SoundchartsService: metric methods only target customer.api.soundcharts.com/account.soundcharts.com hosts', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../integrations/soundcharts/soundcharts.service.ts'),
      'utf8',
    );
    expect(src).toContain("'account.soundcharts.com', 'customer.api.soundcharts.com'");
  });
});
