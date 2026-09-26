/**
 * modules/reports/report-table-guard.service.ts
 *
 * Security guard of the Reports Center: ensures an entity is only
 * exported/imported when its physical table EXISTS in the database. Entities
 * declared (ALL_ENTITIES) but without a materialized table (e.g. crm_contacts,
 * pipelines — schema only in the consolidated dump) no longer return 500 and instead
 * return a controlled 422 error (UnprocessableEntity), without a stack trace.
 *
 * The list of existing tables is queried only once and cached (read-only,
 * information_schema). When the DataSource is unavailable, the guard degrades
 * safely (it does not block wrongly — the engine already handles a missing database).
 */
import { Injectable, Inject, Optional, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import type { EntityReport } from './entity-metadata.types';
import { REPORT_MODULE_REGISTRY_BY_TABLE } from './report-module-registry';

@Injectable()
export class ReportTableGuardService {
  private cache: Promise<Set<string> | null> | null = null;

  constructor(@Inject(DATA_SOURCE) @Optional() private readonly ds: DataSource | null) {}

  /** Set of physical tables of the public schema (cached). `null` when unavailable. */
  existingTables(): Promise<Set<string> | null> {
    if (this.cache) return this.cache;
    this.cache = this.load();
    return this.cache;
  }

  /** Clears the cache (after migrations, in tests). */
  invalidate(): void {
    this.cache = null;
  }

  private async load(): Promise<Set<string> | null> {
    if (!this.ds) return null;
    try {
      const rows = (await this.ds.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      )) as { tablename: string }[];
      return new Set(rows.map((r) => r.tablename));
    } catch {
      // An introspection failure must not mask the flow; degrade safely.
      return null;
    }
  }

  /**
   * Validates that the entity can be exported/imported safely.
   * Throws 422 (no 500/stack trace) when:
   *  - the entity metadata does not exist;
   *  - the physical table does not exist in the database;
   *  - the entity is multi-tenant but the table has no tenant_id column.
   */
  async assertTableUsable(tableName: string, report: EntityReport | undefined): Promise<void> {
    if (!report) {
      throw new UnprocessableEntityException(
        `Entidade "${tableName}" não possui metadados registrados e não pode ser processada.`,
      );
    }
    // Computed report (e.g. Contabilidade/accounting_summary): has no
    // physical table of its own — the "table exists" validation does not apply.
    if (REPORT_MODULE_REGISTRY_BY_TABLE.get(tableName)?.computed) return;

    const tables = await this.existingTables();
    if (!tables) return; // could not be verified — does not block (the engine handles a missing DB)

    if (!tables.has(tableName)) {
      throw new UnprocessableEntityException(
        `A entidade "${tableName}" está registrada mas não possui tabela física no banco. ` +
          `Exportação/importação indisponível até a tabela ser criada por migration.`,
      );
    }

    if (report.hasTenantId) {
      const hasTenantColumn = report.columns.some((c) => c.isTenantId);
      if (!hasTenantColumn) {
        throw new UnprocessableEntityException(
          `A entidade multi-tenant "${tableName}" não possui coluna tenant_id e não pode ser isolada com segurança.`,
        );
      }
    }
  }
}
