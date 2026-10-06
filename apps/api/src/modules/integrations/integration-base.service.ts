import { Injectable, Inject, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { redactForStorage } from '../../core/filters/redact-diagnostic';
import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { IntegrationEntity, OAuthConnectionEntity } from '../../database/entities';
import { EncryptionService } from '../../core/security/encryption.service';
import { CircuitBreaker } from '../../core/resilience/circuit-breaker';
import { resilientFetch, DEFAULT_TIMEOUT_MS } from '../../core/resilience/resilient-fetch';
import { IntegrationStatus } from '@music-os-360/types';

@Injectable()
export class IntegrationBaseService {
  protected readonly logger = new Logger(IntegrationBaseService.name);
  private readonly integRepo: Repository<IntegrationEntity>    | null = null;
  private readonly oauthRepo: Repository<OAuthConnectionEntity> | null = null;

  // Each concrete service gets its own circuit breaker instance.
  // Call this.cb.execute(() => ...) or this.fetch() for guarded HTTP calls.
  protected readonly cb: CircuitBreaker;

  constructor(
    @Inject(DATA_SOURCE) protected readonly ds: DataSource | null,
    protected readonly enc: EncryptionService,
  ) {
    if (ds) {
      this.integRepo = ds.getRepository(IntegrationEntity);
      this.oauthRepo = ds.getRepository(OAuthConnectionEntity);
    }
    this.cb = new CircuitBreaker({ name: this.constructor.name });
  }

  /**
   * Guarded fetch — applies circuit breaker + 10s timeout to any external HTTP call.
   * Use this instead of raw `fetch()` in all integration subclasses.
   */
  protected fetch(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
    return resilientFetch(this.cb, url, init, timeoutMs);
  }

  // ── Credentials ─────────────────────────────────────────────────────────────

  /**
   * Stores the credentials. With a `verify` probe (a real authenticated call to the provider) the integration
   * is connected only when the probe succeeds; on failure it is left in error with the redacted reason and the
   * caller gets a failure. Without a probe the integration keeps the previous "saved" behaviour but is recorded
   * as not verified, so the status never claims a test that did not happen.
   */
  async saveCredentials(
    tenantId: string,
    provider: string,
    creds: Record<string, string>,
    verify?: () => Promise<void>,
  ): Promise<void> {
    const credentials_encrypted = this.enc.encrypt(JSON.stringify(creds));
    const existing = await this.integRepo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider })
      .getOne();

    // Snapshot before anything is written: it is what a failed verification restores.
    const previous = existing
      ? { credentials_encrypted: existing.credentials_encrypted, status: existing.status, verified: (existing.metadata ?? {})['verified'] === true }
      : null;
    const status = verify ? IntegrationStatus.CONNECTING : IntegrationStatus.CONNECTED;
    const metadata = { ...(existing?.metadata ?? {}), last_attempt_at: new Date().toISOString(), verified: false };
    if (existing) {
      await this.integRepo!.update({ id: existing.id } as any, { credentials_encrypted, status, failure_count: 0, metadata, updated_at: new Date() } as any);
    } else {
      const entity = this.integRepo!.create({ tenant_id: tenantId, provider, status, credentials_encrypted, metadata });
      await this.integRepo!.save(entity);
    }
    if (!verify) return;

    try {
      await verify();
    } catch (error) {
      const reason = redactForStorage(error instanceof Error ? error.message : String(error));
      // A mistyped re-configuration must not destroy a working connection: the previous credentials and status
      // come back, and only the failure is recorded.
      let restoreFailed = false;
      if (previous) {
        try {
          await this.restoreCredentials(tenantId, provider, previous.credentials_encrypted, previous.status);
        } catch {
          restoreFailed = true; // the caller still gets the validation failure; the state records that the restore did not happen
        }
      }
      try {
        await this.recordConnectionState(tenantId, provider, previous && !restoreFailed ? previous.status : IntegrationStatus.ERROR, {
          verified: previous && !restoreFailed ? previous.verified : false,
          ...(restoreFailed ? { restore_failed: true } : {}),
          last_failure_at: new Date().toISOString(),
          last_failure_reason: reason,
        });
      } catch (recordError) {
        // The caller still gets the validation failure; the store failure is logged, never swallowed.
        this.logger.error(`${provider}: could not record the failed connection test: ${redactForStorage(String(recordError))}`);
      }
      throw new BadRequestException({
        code: 'INTEGRATION_CONNECTION_TEST_FAILED',
        message: `Não foi possível validar a conexão com ${provider}: ${reason}`,
      });
    }
    await this.recordConnectionState(tenantId, provider, IntegrationStatus.CONNECTED, {
      verified: true,
      last_success_at: new Date().toISOString(),
      last_failure_at: null,
      last_failure_reason: null,
    });
  }

  private async restoreCredentials(
    tenantId: string,
    provider: string,
    credentials_encrypted: string | null,
    status: IntegrationStatus,
  ): Promise<void> {
    const row = await this.integRepo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider })
      .getOne();
    if (!row) return;
    await this.integRepo!.update({ id: row.id } as any, { credentials_encrypted, status, updated_at: new Date() } as any);
  }

  private async recordConnectionState(
    tenantId: string,
    provider: string,
    status: IntegrationStatus,
    metadataPatch: Record<string, unknown>,
  ): Promise<void> {
    const row = await this.integRepo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider })
      .getOne();
    if (!row) return;
    await this.integRepo!.update(
      { id: row.id } as any,
      { status, metadata: { ...(row.metadata ?? {}), ...metadataPatch }, updated_at: new Date() } as any,
    );
  }

  async loadCredentials<T = Record<string, string>>(tenantId: string, provider: string): Promise<T | null> {
    const row = await this.integRepo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider })
      .getOne();
    if (!row?.credentials_encrypted) return null;
    try { return JSON.parse(this.enc.decrypt(row.credentials_encrypted)) as T; } catch { return null; }
  }

  async getStatus(tenantId: string, provider: string): Promise<{
    connected: boolean;
    status: string;
    verified: boolean;
    last_sync_at: Date | null;
    last_attempt_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
  }> {
    const row = await this.integRepo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider })
      .getOne();
    const meta = (row?.metadata ?? {}) as Record<string, unknown>;
    const text = (key: string): string | null => (typeof meta[key] === 'string' ? (meta[key] as string) : null);
    return {
      connected: row?.status === 'connected',
      status: row?.status ?? IntegrationStatus.DISCONNECTED,
      verified: meta['verified'] === true,
      last_sync_at: row?.last_sync_at ?? null,
      last_attempt_at: text('last_attempt_at'),
      last_success_at: text('last_success_at'),
      last_error: text('last_failure_reason'),
    };
  }

  async disconnect(tenantId: string, provider: string): Promise<void> {
    const row = await this.integRepo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider })
      .getOne();
    if (row) {
      await this.integRepo!.update({ id: row.id } as any, { status: 'disconnected', credentials_encrypted: null, updated_at: new Date() } as any);
    }
  }

  // ── OAuth tokens ─────────────────────────────────────────────────────────────

  async saveOAuthTokens(params: {
    tenantId: string; userId: string; provider: string;
    accessToken: string; refreshToken?: string; expiresIn?: number; scopes?: string;
  }): Promise<void> {
    const expiresAt = params.expiresIn ? new Date(Date.now() + params.expiresIn * 1000) : null;
    const existing  = await this.oauthRepo!
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId AND o.user_id = :userId AND o.provider = :provider', {
        tenantId: params.tenantId, userId: params.userId, provider: params.provider,
      })
      .getOne();

    const payload = {
      access_token_encrypted:  this.enc.encrypt(params.accessToken),
      refresh_token_encrypted: params.refreshToken ? this.enc.encrypt(params.refreshToken) : null,
      expires_at:  expiresAt,
      scopes:      params.scopes ?? null,
      updated_at:  new Date(),
    };

    if (existing) {
      await this.oauthRepo!.update({ id: existing.id } as any, {
        ...payload,
        refresh_token_encrypted: params.refreshToken
          ? this.enc.encrypt(params.refreshToken)
          : existing.refresh_token_encrypted,
      } as any);
    } else {
      const entity = this.oauthRepo!.create({ tenant_id: params.tenantId, user_id: params.userId, provider: params.provider, ...payload });
      await this.oauthRepo!.save(entity);
    }
  }

  async getOAuthConnection(tenantId: string, userId: string, provider: string) {
    const conn = await this.oauthRepo!
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId AND o.user_id = :userId AND o.provider = :provider', { tenantId, userId, provider })
      .getOne();
    if (!conn) return null;
    return { ...conn, accessToken: this.enc.decrypt(conn.access_token_encrypted), refreshToken: conn.refresh_token_encrypted ? this.enc.decrypt(conn.refresh_token_encrypted) : null };
  }

  async disconnectOAuth(tenantId: string, userId: string, provider: string): Promise<void> {
    await this.oauthRepo!
      .createQueryBuilder()
      .delete()
      .from(OAuthConnectionEntity)
      .where('tenant_id = :tenantId AND user_id = :userId AND provider = :provider', { tenantId, userId, provider })
      .execute();
  }

  async getOAuthStatus(tenantId: string, userId: string, provider: string): Promise<{ connected: boolean; needs_reauth?: boolean }> {
    const conn = await this.oauthRepo!
      .createQueryBuilder('o')
      .select(['o.id', 'o.metadata'])
      .where('o.tenant_id = :tenantId AND o.user_id = :userId AND o.provider = :provider', { tenantId, userId, provider })
      .getOne();
    if (!conn) return { connected: false };
    return { connected: true, needs_reauth: conn.metadata?.['needs_reauth'] === true };
  }

  /**
   * Marks an OAuth connection as needing re-authorization — used when
   * an automatic refresh attempt fails (e.g. an expired/revoked Meta long-lived
   * token). Does not delete the row: preserves history and lets
   * the user see "needs reconnecting" instead of "never connected".
   */
  async markOAuthNeedsReauth(tenantId: string, userId: string, provider: string): Promise<void> {
    const conn = await this.oauthRepo!
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId AND o.user_id = :userId AND o.provider = :provider', { tenantId, userId, provider })
      .getOne();
    if (!conn) return;
    await this.oauthRepo!.update({ id: conn.id } as any, {
      metadata: { ...conn.metadata, needs_reauth: true, needs_reauth_at: new Date().toISOString() },
      updated_at: new Date(),
    } as any);
  }

  /**
   * Merges non-sensitive metadata into the OAuth connection (never tokens — those
   * live encrypted in their own columns). Used to cache data only the
   * provider can supply after consent, e.g. DocuSign's account_id/base_uri,
   * which come from /oauth/userinfo and not from the token endpoint.
   */
  async saveOAuthMetadata(
    tenantId: string, userId: string, provider: string, patch: Record<string, unknown>,
  ): Promise<void> {
    const conn = await this.oauthRepo!
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId AND o.user_id = :userId AND o.provider = :provider', { tenantId, userId, provider })
      .getOne();
    if (!conn) return;
    await this.oauthRepo!.update({ id: conn.id } as any, {
      metadata:   { ...conn.metadata, ...patch },
      updated_at: new Date(),
    } as any);
  }

  // ── Signed OAuth state ───────────────────────────────────────────────────────

  private static readonly STATE_TTL_MS = 10 * 60 * 1_000;

  buildSignedState(payload: Record<string, string>): string {
    const full    = { ...payload, iat: String(Date.now()) };
    const json    = JSON.stringify(full);
    const b64     = Buffer.from(json).toString('base64url');
    const hmacKey = this.enc.getKeyBytes();
    const sig     = crypto.createHmac('sha256', hmacKey).update(b64).digest('base64url');
    return `${b64}.${sig}`;
  }

  verifySignedState(state: string): Record<string, string> {
    if (typeof state !== 'string' || state.length > 2048) throw new UnauthorizedException('Autorização da integração inválida. Tente conectar novamente.');
    const dot = state.lastIndexOf('.');
    if (dot === -1 || dot === 0 || dot === state.length - 1) throw new UnauthorizedException('Autorização da integração inválida. Tente conectar novamente.');
    const b64 = state.slice(0, dot);
    const sig  = state.slice(dot + 1);
    const hmacKey  = this.enc.getKeyBytes();
    const expected = crypto.createHmac('sha256', hmacKey).update(b64).digest('base64url');
    const sigBuf = Buffer.from(sig,      'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) throw new UnauthorizedException('OAuth state com assinatura inválida');
    let parsed: Record<string, string>;
    try { parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8')) as Record<string, string>; }
    catch { throw new UnauthorizedException('Autorização da integração inválida. Tente conectar novamente.'); }
    const iat = Number(parsed['iat'] ?? 0);
    if (!iat || Date.now() - iat > IntegrationBaseService.STATE_TTL_MS) throw new UnauthorizedException('A autorização da integração expirou. Tente conectar novamente.');
    return parsed;
  }
}
