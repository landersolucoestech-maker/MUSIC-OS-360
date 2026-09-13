import { Injectable, Logger } from '@nestjs/common';
import { assertAllowedHost, assertSafePathSegment, assertSafeLimit } from '../../../core/resilience/safe-url';
import { CircuitBreaker } from '../../../core/resilience/circuit-breaker';
import { resilientFetch } from '../../../core/resilience/resilient-fetch';

const DEEZER_API = 'https://api.deezer.com';
const DEEZER_HOSTS = ['api.deezer.com'] as const;

@Injectable()
export class DeezerService {
  private readonly logger = new Logger(DeezerService.name);
  // find-fec66ce8: guarded fetch (10s timeout + circuit breaker) — this
  // service doesn't extend IntegrationBaseService (no DB/credentials), so it
  // carries its own breaker instance rather than raw global fetch().
  private readonly cb = new CircuitBreaker({ name: DeezerService.name });
  private fetch(url: string, init?: RequestInit): Promise<Response> {
    return resilientFetch(this.cb, url, init);
  }

  isConfigured(): boolean {
    return true; // API pública, sem chave necessária
  }

  async getArtistStats(artistId: string) {
    const id = assertSafePathSegment(artistId, 'artistId');
    const url = assertAllowedHost(`${DEEZER_API}/artist/${encodeURIComponent(id)}`, DEEZER_HOSTS);
    const res = await this.fetch(url);
    if (!res.ok) return { error: `Deezer API error: ${res.status}` };
    const d = await res.json() as any;
    return {
      artistId: String(d.id),
      name:     d.name ?? '',
      fans:     d.nb_fan ?? 0,
      albums:   d.nb_album ?? 0,
      picture:  d.picture_medium ?? '',
      link:     d.link ?? '',
      syncedAt: new Date().toISOString(),
    };
  }

  async getTopTracks(artistId: string, limit = 10) {
    const id = assertSafePathSegment(artistId, 'artistId');
    const lim = assertSafeLimit(limit);
    const url = assertAllowedHost(`${DEEZER_API}/artist/${encodeURIComponent(id)}/top?limit=${lim}`, DEEZER_HOSTS);
    const res = await this.fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.data ?? []).map((t: any) => ({
      id:       String(t.id),
      title:    t.title ?? '',
      rank:     t.rank ?? 0,
      duration: t.duration ?? 0,
      preview:  t.preview ?? '',
      album:    t.album?.title ?? '',
      cover:    t.album?.cover_medium ?? '',
    }));
  }

  async getAlbum(albumId: string) {
    const id = assertSafePathSegment(albumId, 'albumId');
    const url = assertAllowedHost(`${DEEZER_API}/album/${encodeURIComponent(id)}`, DEEZER_HOSTS);
    const res = await this.fetch(url);
    if (!res.ok) return { error: `Deezer API error: ${res.status}` };
    const d = await res.json() as any;
    return {
      albumId:   String(d.id),
      title:     d.title ?? '',
      artistName: d.artist?.name ?? '',
      cover:     d.cover_medium ?? '',
      releaseDate: d.release_date ?? '',
      trackCount: d.nb_tracks ?? 0,
      fans:       d.fans ?? 0,
      syncedAt:  new Date().toISOString(),
    };
  }

  async searchArtist(query: string, limit = 5) {
    const res = await this.fetch(`${DEEZER_API}/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.data ?? []).map((a: any) => ({
      id:      String(a.id),
      name:    a.name ?? '',
      fans:    a.nb_fan ?? 0,
      picture: a.picture_medium ?? '',
      link:    a.link ?? '',
    }));
  }
}
