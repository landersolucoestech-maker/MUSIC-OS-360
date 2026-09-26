import { Injectable, Logger, Inject, Optional, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { DATA_SOURCE } from '../../../database/database.module';
import { OAuthConnectionEntity } from '../../../database/entities';
import { EncryptionService } from '../../../core/security/encryption.service';
import { CircuitBreakerRegistry } from '../../../core/resilience/circuit-breaker.registry';
import { assertAllowedHost, assertSafePathSegment } from '../../../core/resilience/safe-url';
import { QUEUE_NAMES, SPOTIFY_JOB_NAMES } from '../../../queues/queue.constants';
import { DatabaseContextService } from '../../../database/database-context.service';
import { parseSpotifyArtistId } from './spotify-url.util';

const PROVIDER = 'spotify';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';
const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_HOSTS = ['api.spotify.com'] as const;
const STATE_TTL_MS = 10 * 60 * 1000;

interface SpotifyOAuthState {
  tenantId: string;
  userId: string;
  nonce: string;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly repo: Repository<OAuthConnectionEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly encryption: EncryptionService,
    private readonly cbRegistry: CircuitBreakerRegistry,
    @Optional()
    @InjectQueue(QUEUE_NAMES.STREAMING_SYNC) private readonly syncQueue: Queue | null,
    // find-b4201eb2: the GET callback is @Public (no tenant context); the write to
    // oauth_connections (FORCE RLS) was denied in production.
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) this.repo = ds.getRepository(OAuthConnectionEntity);
  }

  private fetch(url: string, init?: RequestInit): Promise<Response> {
    return this.cbRegistry.fetch(PROVIDER, url, init);
  }

  private requireRepo(): Repository<OAuthConnectionEntity> {
    if (!this.repo) throw new ServiceUnavailableException('OAuth persistence unavailable');
    return this.repo;
  }

  private getStateSecret(): string {
    const secret = process.env['SPOTIFY_OAUTH_STATE_SECRET'] ?? process.env['ENCRYPTION_KEY'] ?? '';
    if (!secret || /^0+$/.test(secret)) {
      throw new ServiceUnavailableException('Spotify OAuth state secret unavailable');
    }
    return secret;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.getStateSecret()).update(payload).digest('base64url');
  }

  private createState(tenantId: string, userId: string): string {
    const state: SpotifyOAuthState = {
      tenantId,
      userId,
      nonce: randomUUID(),
      exp: Date.now() + STATE_TTL_MS,
    };
    const payload = base64UrlEncode(JSON.stringify(state));
    const signature = this.sign(payload);
    return `${payload}.${signature}`;
  }

  private verifyState(rawState: string): SpotifyOAuthState {
    const [payload, signature] = rawState.split('.');
    if (!payload || !signature) {
      throw new BadRequestException('Invalid Spotify OAuth state');
    }

    const expected = this.sign(payload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new BadRequestException('Invalid Spotify OAuth state signature');
    }

    let state: SpotifyOAuthState;
    try {
      state = JSON.parse(base64UrlDecode(payload)) as SpotifyOAuthState;
    } catch {
      throw new BadRequestException('Invalid Spotify OAuth state payload');
    }

    if (!state.tenantId || !state.userId || !state.nonce || !state.exp) {
      throw new BadRequestException('Incomplete Spotify OAuth state');
    }

    if (state.exp < Date.now()) {
      throw new BadRequestException('Expired Spotify OAuth state');
    }

    return state;
  }

  isConfigured(): boolean {
    return !!(process.env['SPOTIFY_CLIENT_ID'] && process.env['SPOTIFY_CLIENT_SECRET']);
  }

  getAuthUrl(tenantId: string, userId: string): string {
    const clientId = process.env['SPOTIFY_CLIENT_ID'] ?? '';
    const redirectUri = process.env['SPOTIFY_REDIRECT_URI'] ?? '';
    if (!clientId || !redirectUri) {
      throw new ServiceUnavailableException('Spotify OAuth not configured');
    }

    const state = this.createState(tenantId, userId);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'user-read-private user-read-email',
      redirect_uri: redirectUri,
      state,
    });
    return `${SPOTIFY_ACCOUNTS}/authorize?${params}`;
  }

  private async getClientCredentialsToken(): Promise<string> {
    const clientId = process.env['SPOTIFY_CLIENT_ID'] ?? '';
    const clientSecret = process.env['SPOTIFY_CLIENT_SECRET'] ?? '';
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Spotify client credentials unavailable');
    }

    const res = await this.fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    const data = await res.json() as any;
    return data.access_token as string;
  }

  extractArtistId(spotifyUrl: string): string | null {
    return parseSpotifyArtistId(spotifyUrl);
  }

  async handleCallback(code: string, state: string): Promise<void> {
    if (!code) throw new BadRequestException('Spotify authorization code missing');
    const verifiedState = this.verifyState(state);
    const { tenantId, userId } = verifiedState;

    const clientId = process.env['SPOTIFY_CLIENT_ID'] ?? '';
    const clientSecret = process.env['SPOTIFY_CLIENT_SECRET'] ?? '';
    const redirectUri = process.env['SPOTIFY_REDIRECT_URI'] ?? '';

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Spotify OAuth not configured');
    }

    const tokenRes = await this.fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });

    const tokens = await tokenRes.json() as any;
    // tenantId/userId come from the server-signed state (verifyState), never from
    // a free parameter. Reuses the context when the call is already authenticated
    // (POST /spotify/callback); otherwise opens one for that tenant.
    const persist = () => this.upsertConnection(tenantId, userId, tokens);
    await (this.dbContext
      ? this.dbContext.ensureTenantContext({ tenantId, orgId: null, role: null }, persist)
      : persist());

    // find-721c845e: 'spotify:sync' has no handler in any streaming-sync processor
    // (it used to fall into ExternalDataProcessor's default branch and was marked
    // completed without work). Semantics undefined (pending a product decision)
    // — it is not enqueued; the OAuth connection is already persisted above
    // (oauth_connections).
    void this.syncQueue;
    this.logger.warn(
      `[streaming-sync] job '${SPOTIFY_JOB_NAMES.ACCOUNT_SYNC}' NOT enqueued: no consumer/defined semantics ` +
      `(find-721c845e, pending a product decision) tenant=${tenantId}`,
    );
    this.logger.log(`Spotify OAuth: ${userId}@${tenantId} connected`);
  }

  async syncArtistMetrics(tenantId: string, spotifyUrlOrId: string): Promise<{ listeners: number | null; popularity: number; name: string; image: string | null } | null> {
    if (!this.isConfigured()) return null;

    const artistId = parseSpotifyArtistId(spotifyUrlOrId);

    if (!artistId) {
      this.logger.warn(`Spotify: invalid link — ${spotifyUrlOrId}`);
      return null;
    }

    const token = await this.getClientCredentialsToken();
    const id = assertSafePathSegment(artistId, 'artistId');
    const url = assertAllowedHost(`${SPOTIFY_API}/artists/${encodeURIComponent(id)}`, SPOTIFY_HOSTS);
    const res = await this.fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json() as any;
    this.logger.log(`Spotify: ${data.name} returned a public profile; monthly listeners not available on this endpoint`);
    return {
      listeners: null,
      popularity: data.popularity ?? 0,
      name: data.name ?? '',
      image: data.images?.[0]?.url ?? null,
    };
  }

  private async upsertConnection(tenantId: string, userId: string, tokens: any): Promise<void> {
    const repo = this.requireRepo();
    const expiresAt = new Date(Date.now() + (tokens.expires_in as number) * 1000);
    const existing = await repo
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId AND o.user_id = :userId AND o.provider = :provider', { tenantId, userId, provider: 'spotify' })
      .getOne();

    if (existing) {
      await repo.update({ id: existing.id } as any, {
        access_token_encrypted: this.encryption.encrypt(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token ? this.encryption.encrypt(tokens.refresh_token) : existing.refresh_token_encrypted,
        expires_at: expiresAt,
        updated_at: new Date(),
      } as any);
    } else {
      const entity = repo.create({
        tenant_id: tenantId,
        user_id: userId,
        provider: 'spotify',
        expires_at: expiresAt,
        access_token_encrypted: this.encryption.encrypt(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token ? this.encryption.encrypt(tokens.refresh_token) : null,
        scopes: 'user-read-private user-read-email',
      });
      await repo.save(entity);
    }
  }

  async getValidToken(tenantId: string): Promise<string | null> {
    const repo = this.requireRepo();
    const conn = await repo
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId AND o.provider = :provider', { tenantId, provider: 'spotify' })
      .getOne();
    if (!conn) return null;

    if (conn.expires_at && conn.expires_at < new Date()) {
      return this.refreshToken(conn);
    }
    return this.encryption.decrypt(conn.access_token_encrypted);
  }

  private async refreshToken(conn: OAuthConnectionEntity): Promise<string> {
    const repo = this.requireRepo();
    const clientId = process.env['SPOTIFY_CLIENT_ID'] ?? '';
    const clientSecret = process.env['SPOTIFY_CLIENT_SECRET'] ?? '';
    const refreshToken = this.encryption.decrypt(conn.refresh_token_encrypted ?? '');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new ServiceUnavailableException('Spotify refresh credentials unavailable');
    }

    const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    const data = await res.json() as any;

    await repo.update({ id: conn.id } as any, {
      access_token_encrypted: this.encryption.encrypt(data.access_token),
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      updated_at: new Date(),
    } as any);

    return data.access_token as string;
  }

  async disconnect(tenantId: string, userId: string): Promise<void> {
    const repo = this.requireRepo();
    await repo
      .createQueryBuilder()
      .delete()
      .from(OAuthConnectionEntity)
      .where('tenant_id = :tenantId AND user_id = :userId AND provider = :provider', { tenantId, userId, provider: 'spotify' })
      .execute();
  }
}
