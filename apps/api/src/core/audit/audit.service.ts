/**
 * core/audit/audit.service.ts
 *
 * AuditService — append-only audit trail for MUSIC OS 360.
 * Silently ignores errors so it never breaks the main operation.
 *
 * Guarantees:
 *  - No UPDATE or DELETE ever issued on audit_logs.
 *  - Every write uses repo.save() on a freshly created entity.
 *  - Diff is computed automatically when before+after are provided.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource, Repository }     from 'typeorm';
import { DATA_SOURCE }                from '../../database/database.module';
import { AuditLogEntity }             from '../../database/entities';

export interface AuditParams {
  /** Tenant isolation key */
  tenantId?:      string | null;
  /** Organisation owning the tenant */
  orgId?:         string | null;
  userId?:        string | null;
  /** OWNER | ADMIN | EDITOR | VIEWER | system */
  actorRole?:     string | null;
  action:         string;
  entity:         string;
  entityId?:      string | null;
  /** Pre-mutation snapshot */
  before?:        unknown;
  /** Post-mutation snapshot / response body */
  after?:         unknown;
  /** Explicitly computed diff — if omitted, computed from before+after */
  diff?:          Record<string, unknown> | null;
  ip?:            string | null;
  userAgent?:     string | null;
  /** X-Request-Id / request correlation */
  requestId?:     string | null;
  /** From PHASE 3 CorrelationContext AsyncLocalStorage */
  correlationId?: string | null;
  /** Client-provided session id (X-Session-Id header) */
  sessionId?:     string | null;
  httpMethod?:    string | null;
  httpPath?:      string | null;
}

/**
 * Compute the diff between two plain objects.
 * Returns an object where each changed key maps to { from, to }.
 */
function computeDiff(
  before: Record<string, unknown>,
  after:  Record<string, unknown>,
): Record<string, unknown> | null {
  const changed: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const bv = before[k];
    const av = after[k];
    // Simple JSON comparison — good enough for audit purposes
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      changed[k] = { from: bv, to: av };
    }
  }
  return Object.keys(changed).length > 0 ? changed : null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly repo: Repository<AuditLogEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(AuditLogEntity);
  }

  async log(params: AuditParams): Promise<void> {
    if (!this.repo) return;

    try {
      const beforeObj = (params.before ?? null) as Record<string, unknown> | null;
      const afterObj  = (params.after  ?? null) as Record<string, unknown> | null;

      let diff = params.diff ?? null;
      if (diff === undefined || diff === null) {
        if (beforeObj && afterObj) {
          diff = computeDiff(beforeObj, afterObj);
        }
      }

      const entry = this.repo.create({
        tenant_id:     params.tenantId     ?? null,
        org_id:        params.orgId        ?? null,
        user_id:       params.userId       ?? null,
        actor_role:    params.actorRole    ?? null,
        action:        params.action,
        entity:        params.entity,
        entity_id:     params.entityId     ?? null,
        before:        beforeObj,
        after:         afterObj,
        diff,
        ip_address:    params.ip           ?? null,
        user_agent:    params.userAgent    ?? null,
        request_id:    params.requestId    ?? null,
        correlation_id: params.correlationId ?? null,
        session_id:    params.sessionId    ?? null,
        http_method:   params.httpMethod   ?? null,
        http_path:     params.httpPath     ?? null,
      });

      await this.repo.save(entry);
    } catch (err) {
      this.logger.warn(`AuditService.log failed silently: ${String(err)}`);
    }
  }
}
