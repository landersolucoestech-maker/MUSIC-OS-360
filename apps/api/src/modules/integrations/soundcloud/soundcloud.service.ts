import { Injectable, Inject } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { DataSource }         from 'typeorm';
import { DATA_SOURCE }        from '../../../database/database.module';
import { EncryptionService }  from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';
import { assertAllowedHost, assertSafePathSegment, assertSafeLimit, assertSafeQueryValue } from '../../../core/resilience/safe-url';

import { integrationFailure, codeForUpstreamStatus } from '../integration-failure';
const SC_API = 'https://api.soundcloud.com';
const SC_HOSTS = ['api.soundcloud.com'] as const;

@Injectable()
export class SoundCloudService extends IntegrationBaseService {
  private readonly PROVIDER = 'soundcloud';

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
    private readonly config: ConfigService,
  ) {
    super(ds, enc);
  }

  isConfigured(): boolean { return !!(this.config.get('SOUNDCLOUD_CLIENT_ID')); }
  private get clientId(): string { return this.config.get<string>('SOUNDCLOUD_CLIENT_ID') ?? ''; }

  async configure(tenantId: string, clientId: string, clientSecret: string): Promise<void> {
    // Connected only after SoundCloud resolves a public profile with this client id.
    await this.saveCredentials(tenantId, this.PROVIDER, { client_id: clientId, client_secret: clientSecret }, async () => {
      const qs = new URLSearchParams({ url: 'https://soundcloud.com/soundcloud', client_id: clientId }).toString();
      const res = await this.fetch(assertAllowedHost(`${SC_API}/resolve?${qs}`, SC_HOSTS));
      if (!res.ok) throw new Error(`SoundCloud rejected the client id (status ${res.status})`);
    });
  }

  async getProviderStatus(tenantId: string) { return this.getStatus(tenantId, this.PROVIDER); }
  async disconnectProvider(tenantId: string): Promise<void> { await this.disconnect(tenantId, this.PROVIDER); }

  async resolveUser(url: string) {
    const cid = this.clientId;
    if (!cid) return integrationFailure(this.logger, 'PROVIDER_NOT_CONFIGURED');
    const safeResolveUrl = assertSafeQueryValue(url, 'url', 512);
    const qs = new URLSearchParams({ url: safeResolveUrl, client_id: cid }).toString();
    const safeUrl = assertAllowedHost(`${SC_API}/resolve?${qs}`, SC_HOSTS);
    const res = await this.fetch(safeUrl);
    if (!res.ok) return integrationFailure(this.logger, codeForUpstreamStatus(res.status), `upstream status ${res.status}`);
    const d = await res.json() as any;
    return {
      id: String(d.id), username: d.username ?? '', displayName: d.full_name ?? d.username ?? '',
      followers: d.followers_count ?? 0, following: d.followings_count ?? 0,
      tracksCount: d.track_count ?? 0, avatar: d.avatar_url ?? '', permalink: d.permalink_url ?? '',
    };
  }

  async getTrackStats(trackId: string) {
    const cid = this.clientId;
    if (!cid) return integrationFailure(this.logger, 'PROVIDER_NOT_CONFIGURED');
    const id = assertSafePathSegment(trackId, 'trackId');
    const qs = new URLSearchParams({ client_id: cid }).toString();
    const safeUrl = assertAllowedHost(`${SC_API}/tracks/${encodeURIComponent(id)}?${qs}`, SC_HOSTS);
    const res = await this.fetch(safeUrl);
    if (!res.ok) return integrationFailure(this.logger, codeForUpstreamStatus(res.status), `upstream status ${res.status}`);
    const d = await res.json() as any;
    return {
      id: String(d.id), title: d.title ?? '', plays: d.playback_count ?? 0, likes: d.likes_count ?? 0,
      reposts: d.reposts_count ?? 0, comments: d.comment_count ?? 0, duration: d.duration ?? 0,
      genre: d.genre ?? '', artworkUrl: d.artwork_url ?? '', permalinkUrl: d.permalink_url ?? '',
      syncedAt: new Date().toISOString(),
    };
  }

  async searchTracks(query: string, limit = 10) {
    const cid = this.clientId;
    if (!cid) return [];
    const safeQuery = assertSafeQueryValue(query, 'query');
    const lim = assertSafeLimit(limit);
    const qs = new URLSearchParams({ q: safeQuery, limit: String(lim), client_id: cid }).toString();
    const safeUrl = assertAllowedHost(`${SC_API}/tracks?${qs}`, SC_HOSTS);
    const res = await this.fetch(safeUrl);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (Array.isArray(data) ? data : []).map((t: any) => ({
      id: String(t.id), title: t.title ?? '', username: t.user?.username ?? '',
      plays: t.playback_count ?? 0, artworkUrl: t.artwork_url ?? '', permalinkUrl: t.permalink_url ?? '',
    }));
  }
}
