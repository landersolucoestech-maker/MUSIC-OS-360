import { Injectable, Logger, OnApplicationBootstrap, Inject, Optional } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { ADMIN_DATA_SOURCE } from '../../../database/database.tokens';
import { DatabaseContextService } from '../../../database/database-context.service';
import { OAuthConnectionEntity } from '../../../database/entities';
import { InstagramService } from './instagram.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_WINDOW_DAYS = 7;
const META_PROVIDERS = ['instagram', 'corp_instagram', 'meta_business', 'meta_ads'];

/**
 * Proactively renews long-lived Meta/Instagram tokens before they expire
 * (~60 days). Without this, the only renewal happened on demand in
 * InstagramService.getAccountMetrics() — enough for organic use (accessed
 * often), but not for corporate connections that can go weeks without access
 * and silently lose the token.
 */
@Injectable()
export class InstagramTokenRefreshScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(InstagramTokenRefreshScheduler.name);
  private readonly repo: Repository<OAuthConnectionEntity> | null = null;

  /**
   * find-b4201eb2: oauth_connections is FORCE RLS. With DATA_SOURCE (a
   * NOBYPASSRLS role) and no tenant context, the cross-tenant scan returned
   * 0 rows (proven against a real Postgres) and no token was renewed.
   * Canonical scheduler pattern (contract-expiry / invoice-overdue / dunning):
   * enumerate via ADMIN_DATA_SOURCE (owner, read-only) and process each
   * connection inside its own tenant's context.
   */
  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly instagram: InstagramService,
    @Inject(ADMIN_DATA_SOURCE) @Optional() adminDs?: DataSource | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    const enumDs = adminDs ?? ds;
    if (enumDs) this.repo = enumDs.getRepository(OAuthConnectionEntity);
  }

  onApplicationBootstrap(): void {
    if (!this.repo) return;

    this.runCheck().catch((err: unknown) =>
      this.logger.warn(`InstagramTokenRefreshScheduler initial run failed: ${String(err)}`),
    );
    setInterval(() => {
      this.runCheck().catch((err: unknown) =>
        this.logger.warn(`InstagramTokenRefreshScheduler daily run failed: ${String(err)}`),
      );
    }, DAY_MS);
  }

  async runCheck(): Promise<{ checked: number; refreshed: number; failed: number }> {
    if (!this.repo) return { checked: 0, refreshed: 0, failed: 0 };

    const horizon = new Date(Date.now() + REFRESH_WINDOW_DAYS * DAY_MS);
    const rows = await this.repo
      .createQueryBuilder('o')
      .where('o.provider IN (:...providers)', { providers: META_PROVIDERS })
      .andWhere('o.expires_at IS NOT NULL')
      .andWhere('o.expires_at <= :horizon', { horizon })
      .getMany();

    let refreshed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const refresh = () => this.instagram.refreshLongLivedToken(row.tenant_id, row.user_id, row.provider);
        const ok = this.dbContext
          ? await this.dbContext.runInTenantContext({ tenantId: row.tenant_id, orgId: null, role: null }, refresh)
          : await refresh();
        if (ok) refreshed++; else failed++;
      } catch (err) {
        failed++;
        this.logger.warn(`InstagramTokenRefreshScheduler: failure for ${row.tenant_id}/${row.user_id}/${row.provider} — ${String(err)}`);
      }
    }
    this.logger.log(`InstagramTokenRefreshScheduler: ${rows.length} checked, ${refreshed} refreshed, ${failed} failures`);
    return { checked: rows.length, refreshed, failed };
  }
}
