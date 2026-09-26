import { Injectable, Inject } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { DataSource }         from 'typeorm';
import { DATA_SOURCE }        from '../../../database/database.module';
import { EncryptionService }  from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';

const META_API = 'https://graph.facebook.com/v19.0';
const PROVIDER = 'instagram';
const SCOPES   = 'instagram_basic,instagram_manage_insights,pages_show_list';

@Injectable()
export class InstagramService extends IntegrationBaseService {
  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
    private readonly config: ConfigService,
  ) {
    super(ds, enc);
  }

  isConfigured(): boolean {
    return !!(this.config.get('META_APP_ID') && this.config.get('META_APP_SECRET'));
  }

  getAuthUrl(tenantId: string, userId: string): string {
    const appId       = this.config.get<string>('META_APP_ID')       ?? '';
    const redirectUri = this.config.get<string>('META_REDIRECT_URI') ?? '';
    const state       = this.buildSignedState({ tenantId, userId, provider: PROVIDER });
    const params      = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, scope: SCOPES, response_type: 'code', state });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const payload     = this.verifySignedState(state);
    const { tenantId, userId } = payload;
    const appId       = this.config.get<string>('META_APP_ID')       ?? '';
    const appSecret   = this.config.get<string>('META_APP_SECRET')   ?? '';
    const redirectUri = this.config.get<string>('META_REDIRECT_URI') ?? '';

    const tokenRes   = await this.fetch(`${META_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`);
    const shortToken = await tokenRes.json() as any;
    if (shortToken.error) throw new Error(shortToken.error.message);

    const longRes   = await this.fetch(`${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken.access_token}`);
    const longToken = await longRes.json() as any;
    if (longToken.error) throw new Error(longToken.error.message);

    await this.saveOAuthTokens({ tenantId, userId, provider: PROVIDER, accessToken: longToken.access_token, expiresIn: longToken.expires_in ?? 5_184_000, scopes: SCOPES });
    this.logger.log(`Instagram OAuth: ${userId}@${tenantId} conectado`);
  }

  async getProviderStatus(tenantId: string, userId: string, provider: string = PROVIDER) {
    return this.getOAuthStatus(tenantId, userId, provider);
  }

  /**
   * Disconnects and tries to revoke the token on Meta's side (best-effort — DELETE
   * /me/permissions). Revocation never blocks the local disconnect: if the Meta
   * API is unavailable, the user can still disconnect.
   */
  async disconnectProvider(tenantId: string, userId: string, provider: string = PROVIDER): Promise<void> {
    const conn = await this.getOAuthConnection(tenantId, userId, provider);
    if (conn?.accessToken) {
      try {
        await this.fetch(`${META_API}/me/permissions?access_token=${conn.accessToken}`, { method: 'DELETE' });
      } catch (err) {
        this.logger.warn(`Instagram/Meta: falha ao revogar token no Meta (${userId}@${tenantId}, ${provider}) — ${String(err)}`);
      }
    }
    await this.disconnectOAuth(tenantId, userId, provider);
  }

  /**
   * Renews the long-lived token by re-exchanging the still-valid token through the
   * `fb_exchange_token` grant (Meta issues no separate refresh_token — the
   * 60-day token itself, while still valid, can be re-exchanged for a
   * new 60-day one). Used both by on-demand access (getAccountMetrics)
   * and by the renewal cron (instagram-token-refresh.scheduler.ts).
   * On failure, marks the connection as needs_reauth instead of leaving it
   * silently stale.
   */
  async refreshLongLivedToken(tenantId: string, userId: string, provider: string = PROVIDER): Promise<boolean> {
    const conn = await this.getOAuthConnection(tenantId, userId, provider);
    if (!conn) return false;

    const appId     = this.config.get<string>('META_APP_ID')     ?? '';
    const appSecret = this.config.get<string>('META_APP_SECRET') ?? '';

    try {
      const res  = await this.fetch(`${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${conn.accessToken}`);
      const json = await res.json() as any;
      if (json.error) throw new Error(json.error.message);

      await this.saveOAuthTokens({
        tenantId, userId, provider,
        accessToken: json.access_token,
        expiresIn:   json.expires_in ?? 5_184_000,
        scopes:      conn.scopes ?? SCOPES,
      });
      this.logger.log(`Instagram/Meta: token renovado (${userId}@${tenantId}, ${provider})`);
      return true;
    } catch (err) {
      await this.markOAuthNeedsReauth(tenantId, userId, provider);
      this.logger.warn(`Instagram/Meta: falha ao renovar token (${userId}@${tenantId}, ${provider}) — ${String(err)}`);
      return false;
    }
  }

  async getAccountMetrics(tenantId: string, userId: string) {
    let conn = await this.getOAuthConnection(tenantId, userId, PROVIDER);
    if (!conn) return { error: 'Instagram não conectado' };

    const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // renova a partir de 7 dias antes de expirar
    const expiringSoon = !!conn.expires_at && conn.expires_at.getTime() - Date.now() < REFRESH_WINDOW_MS;
    if (expiringSoon) {
      const refreshed = await this.refreshLongLivedToken(tenantId, userId, PROVIDER);
      conn = refreshed ? await this.getOAuthConnection(tenantId, userId, PROVIDER) : conn;
    }
    if (!conn) return { error: 'Instagram não conectado' };
    const token = conn.accessToken;

    const pagesRes = await this.fetch(`${META_API}/me/accounts?access_token=${token}`);
    const pages    = await pagesRes.json() as any;
    if (pages.error) {
      if (pages.error.code === 190) await this.markOAuthNeedsReauth(tenantId, userId, PROVIDER);
      return { error: pages.error.message };
    }

    const pageData = pages.data?.[0];
    if (!pageData) return { error: 'Nenhuma página Facebook encontrada' };

    const igRes  = await this.fetch(`${META_API}/${pageData.id}?fields=instagram_business_account&access_token=${pageData.access_token}`);
    const igData = await igRes.json() as any;
    const igId   = igData.instagram_business_account?.id;
    if (!igId) return { error: 'Conta Instagram Business não encontrada' };

    const metricsRes = await this.fetch(`${META_API}/${igId}?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${pageData.access_token}`);
    const metrics    = await metricsRes.json() as any;
    return {
      instagramId: igId, username: metrics.username ?? '', name: metrics.name ?? '',
      biography: metrics.biography ?? '', followers: metrics.followers_count ?? 0,
      following: metrics.follows_count ?? 0, mediaCount: metrics.media_count ?? 0,
      profilePicture: metrics.profile_picture_url ?? '', syncedAt: new Date().toISOString(),
    };
  }
}
