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
 * Renova proativamente tokens de longa duração do Meta/Instagram antes de
 * expirarem (~60 dias). Sem isto, a única renovação acontecia sob-demanda em
 * InstagramService.getAccountMetrics() — suficiente para o uso orgânico
 * (acedido com frequência), mas insuficiente para conexões corporativas que
 * podem ficar semanas sem serem acedidas e perder o token silenciosamente.
 */
@Injectable()
export class InstagramTokenRefreshScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(InstagramTokenRefreshScheduler.name);
  private readonly repo: Repository<OAuthConnectionEntity> | null = null;

  /**
   * find-b4201eb2: oauth_connections é FORCE RLS. Com o DATA_SOURCE (role
   * NOBYPASSRLS) e sem contexto de tenant, a varredura cross-tenant retornava
   * 0 linhas (provado em Postgres real) e nenhum token era renovado. Padrão
   * canônico dos schedulers (contract-expiry / invoice-overdue / dunning):
   * enumerar via ADMIN_DATA_SOURCE (owner, somente leitura) e processar cada
   * conexão dentro do contexto do seu tenant.
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
        this.logger.warn(`InstagramTokenRefreshScheduler: falha em ${row.tenant_id}/${row.user_id}/${row.provider} — ${String(err)}`);
      }
    }
    this.logger.log(`InstagramTokenRefreshScheduler: ${rows.length} verificados, ${refreshed} renovados, ${failed} falhas`);
    return { checked: rows.length, refreshed, failed };
  }
}
