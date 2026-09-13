import { Injectable, Inject } from '@nestjs/common';
import * as crypto              from 'crypto';
import { DataSource }           from 'typeorm';
import { DATA_SOURCE }          from '../../../database/database.module';
import { EncryptionService }    from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';
import {
  assertAllowedHost,
  assertSafePathSegment,
  assertSafeStorefront,
  assertSafeTypes,
  assertSafeLimit,
  assertSafeQueryValue,
} from '../../../core/resilience/safe-url';

const APPLE_API = 'https://api.music.apple.com/v1';
const APPLE_HOSTS = ['api.music.apple.com'] as const;
const APPLE_SEARCH_TYPES = ['artists', 'albums', 'songs', 'playlists', 'music-videos', 'stations'] as const;
const PROVIDER  = 'apple_music';

interface AppleCreds {
  team_id:     string;
  key_id:      string;
  private_key: string;
}

@Injectable()
export class AppleMusicService extends IntegrationBaseService {
  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
  ) {
    super(ds, enc);
  }

  isConfigured(): boolean { return true; }

  async configure(tenantId: string, teamId: string, keyId: string, privateKey: string): Promise<void> {
    await this.saveCredentials(tenantId, PROVIDER, { team_id: teamId, key_id: keyId, private_key: privateKey });
  }

  async getProviderStatus(tenantId: string) { return this.getStatus(tenantId, PROVIDER); }
  async disconnectProvider(tenantId: string): Promise<void> { await this.disconnect(tenantId, PROVIDER); }

  private buildDeveloperToken(creds: AppleCreds): string {
    const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: creds.key_id })).toString('base64url');
    const now     = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ iss: creds.team_id, iat: now, exp: now + 15_777_000 })).toString('base64url');
    const signingInput = `${header}.${payload}`;
    const sign = crypto.createSign('SHA256');
    sign.update(signingInput);
    const signature = sign.sign({ key: creds.private_key, dsaEncoding: 'ieee-p1363' }, 'base64url');
    return `${signingInput}.${signature}`;
  }

  private async getToken(tenantId: string): Promise<string | null> {
    const creds = await this.loadCredentials<AppleCreds>(tenantId, PROVIDER);
    if (!creds) return null;
    try { return this.buildDeveloperToken(creds); } catch { return null; }
  }

  async getArtistFromCatalog(tenantId: string, artistId: string, storefront = 'br') {
    const token = await this.getToken(tenantId);
    if (!token) return { error: 'Apple Music não configurado' };
    const sf = assertSafeStorefront(storefront);
    const id = assertSafePathSegment(artistId, 'artistId');
    const url = assertAllowedHost(`${APPLE_API}/catalog/${encodeURIComponent(sf)}/artists/${encodeURIComponent(id)}`, APPLE_HOSTS);
    const res = await this.fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { error: `Apple Music API error: ${res.status}` };
    const d    = await res.json() as any;
    const attr = d.data?.[0]?.attributes ?? {};
    return {
      artistId, name: attr.name ?? '', genreNames: attr.genreNames ?? [], url: attr.url ?? '',
      editorialNotes: attr.editorialNotes?.short ?? '',
      artwork: attr.artwork?.url?.replace('{w}x{h}', '400x400') ?? '',
      syncedAt: new Date().toISOString(),
    };
  }

  async searchCatalog(tenantId: string, term: string, types = 'artists,albums', storefront = 'br', limit = 10) {
    const token = await this.getToken(tenantId);
    if (!token) return { error: 'Apple Music não configurado' };
    const sf = assertSafeStorefront(storefront);
    const safeTerm = assertSafeQueryValue(term, 'term');
    const safeTypes = assertSafeTypes(types, APPLE_SEARCH_TYPES);
    const lim = assertSafeLimit(limit);
    const qs = new URLSearchParams({ term: safeTerm, types: safeTypes, limit: String(lim) }).toString();
    const url = assertAllowedHost(`${APPLE_API}/catalog/${encodeURIComponent(sf)}/search?${qs}`, APPLE_HOSTS);
    const res = await this.fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { error: `Apple Music API error: ${res.status}` };
    return res.json();
  }
}
