/**
 * database/database-context.service.ts
 *
 * P2-2 — Runtime session-context primitive for RLS defense-in-depth.
 *
 * Provides `runInTenantContext()`, which executes a unit of work with the
 * portable RLS session variables (defined by migration
 * 20260612000001_PortableRlsTenantContext) bound to the connection:
 *
 *   app.current_tenant_id · app.current_org_id · app.current_role
 *
 * Safety model (pool-correct):
 *   - Variables are set with `set_config(key, value, true)` — the `true` flag
 *     makes them **transaction-local** (`SET LOCAL`), so they are automatically
 *     discarded on COMMIT/ROLLBACK. A pooled connection can therefore NEVER leak
 *     tenant context into a later request.
 *   - A dedicated QueryRunner is acquired, used inside a single transaction, and
 *     always released in `finally`.
 *
 * Flag behaviour:
 *   - DATABASE_SESSION_CONTEXT_ENABLED=false (default) → pass-through: the work
 *     runs against the default manager with NO transaction and NO context. This
 *     is byte-for-byte the current behaviour (zero regression).
 *   - DATABASE_SESSION_CONTEXT_ENABLED=true → the work runs inside the
 *     context-bound transaction described above.
 *
 * This is an OPT-IN primitive. Wiring individual services / a per-request
 * interceptor to route their queries through the returned EntityManager is an
 * incremental rollout (see P2-2 rollout plan) and is intentionally NOT done
 * globally here to avoid an uncontrolled refactor of 130+ repository call sites.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from './database.tokens';
import { runWithTenantManager, currentTenantManager } from './tenant-als';

export interface TenantDbContext {
  tenantId?: string | null;
  orgId?: string | null;
  role?: string | null;
}

@Injectable()
export class DatabaseContextService {
  private readonly logger = new Logger('DatabaseContextService');
  private readonly flagEnabled: boolean;

  constructor(
    @Optional() @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    @Optional() private readonly config?: ConfigService,
  ) {
    this.flagEnabled =
      (this.config?.get<string>('DATABASE_SESSION_CONTEXT_ENABLED') ?? 'false') === 'true';
  }

  /** True only when the feature flag is ON and a DataSource is available. */
  get isEnabled(): boolean {
    return this.flagEnabled && !!this.ds;
  }

  /**
   * Runs `work` with tenant/org/role session context applied (when enabled).
   *
   * @param ctx   tenant/org/role to bind. Missing values are bound as '' →
   *              the portable helpers treat '' as "unset" → fail-closed deny.
   * @param work  receives the EntityManager that MUST be used for the work to be
   *              covered by the session context (when enabled).
   */
  /**
   * find-b4201eb2 (classe: escrita/leitura tenant-scoped a partir de caminho
   * sem contexto — rota @Public, callback OAuth, scheduler). Se já existe um
   * contexto ativo (requisição autenticada / job já contextualizado), executa
   * `work` NESSE contexto — `runInTenantContext` não aninha: abriria outra
   * conexão/transação, quebrando atomicidade com a transação externa. Caso
   * contrário abre um contexto para `ctx.tenantId`. Com contexto externo de
   * outro tenant, o WITH CHECK do RLS continua negando a escrita (fail-closed).
   */
  async ensureTenantContext<T>(ctx: TenantDbContext, work: () => Promise<T>): Promise<T> {
    if (currentTenantManager()) return work();
    return this.runInTenantContext(ctx, () => work());
  }

  async runInTenantContext<T>(
    ctx: TenantDbContext,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    // Flag OFF (or no DB) → preserve current behaviour exactly.
    if (!this.isEnabled || !this.ds) {
      return work(this.ds ? this.ds.manager : (undefined as unknown as EntityManager));
    }

    const queryRunner = this.ds.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Parameterised + transaction-local (is_local = true) → injection-safe and
      // automatically cleared when the transaction ends.
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [
        ctx.tenantId ?? '',
      ]);
      await queryRunner.query(`SELECT set_config('app.current_org_id', $1, true)`, [
        ctx.orgId ?? '',
      ]);
      await queryRunner.query(`SELECT set_config('app.current_role', $1, true)`, [
        ctx.role ?? '',
      ]);

      // Liga o manager contextualizado ao ALS: assim, repositórios GLOBAIS usados
      // dentro de `work` (inclusive os capturados no construtor dos services, via
      // o Proxy de DATA_SOURCE) executam nesta MESMA transação com o contexto de
      // tenant aplicado — sem cada service precisar receber o manager manualmente.
      const result = await runWithTenantManager(queryRunner.manager, () => work(queryRunner.manager));
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      // Returns the connection to the pool. SET LOCAL is already gone with the tx.
      await queryRunner.release();
    }
  }
}
