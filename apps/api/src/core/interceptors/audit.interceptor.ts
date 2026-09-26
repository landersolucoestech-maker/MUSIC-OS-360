/**
 * core/interceptors/audit.interceptor.ts
 *
 * AuditInterceptor — intercepta rotas decoradas com @Audit('entidade.acao')
 * e regista a mutação no AuditService após a resposta.
 *
 * Captura automática:
 *  - before: SELECT da entidade por (tenant_id, id) antes do handler
 *  - after:  resposta do handler
 *  - diff:   calculado pelo AuditService a partir de before + after
 *  - correlation_id: lido do CorrelationContext (FASE 3 AsyncLocalStorage)
 *  - http_method / http_path: do request
 *  - actor_role: do JWT (orgRole)
 *  - session_id: do header X-Session-Id
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable }        from 'rxjs';
import { tap }               from 'rxjs/operators';
import { Reflector }         from '@nestjs/core';
import { DataSource }        from 'typeorm';
import { AuditService }      from '../audit/audit.service';
import { DATA_SOURCE }       from '../../database/database.module';
import { CorrelationContext } from '../events/correlation.context';
import { redactUrl }         from '../security/redact';

export const AUDIT_KEY = 'audit_action';

/** Decorator para marcar uma rota para auditoria. */
export const Audit = (action: string) => SetMetadata(AUDIT_KEY, action);

// ── Sanitization for audit storage ───────────────────────────────────────────
// Audit rows are queryable by support/admins; never persist secrets or signed
// URL query strings (X-Amz-Credential leaks R2_ACCESS_KEY plaintext, etc.).

const REDACT_KEYS = new Set([
  'presignedurl', 'signedurl', 'downloadurl', 'uploadurl',
  'token', 'access_token', 'refresh_token', 'jwt',
  'password', 'secret', 'apikey', 'api_key',
  'x-amz-credential', 'x-amz-signature',
]);

const SIGNED_URL_HOSTS = /\bX-Amz-(Signature|Credential|Algorithm|Date|Expires|SignedHeaders)=/i;

function stripSignedQuery(url: string): string {
  if (typeof url !== 'string') return url;
  const qIdx = url.indexOf('?');
  if (qIdx < 0) return url;
  if (!SIGNED_URL_HOSTS.test(url)) return url;
  return url.slice(0, qIdx) + '?[REDACTED]';
}

export function sanitizeForAudit(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeForAudit);
  if (typeof value === 'string') return stripSignedQuery(value);
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (REDACT_KEYS.has(lower)) {
      out[k] = '[REDACTED]';
      continue;
    }
    // Keep `url` only if it doesn't carry signed-URL fingerprint
    if (lower === 'url' && typeof v === 'string' && SIGNED_URL_HOSTS.test(v)) {
      out[k] = stripSignedQuery(v);
      continue;
    }
    out[k] = sanitizeForAudit(v);
  }
  return out;
}

// ── Entity table map ─────────────────────────────────────────────────────────
/**
 * Maps the entity prefix of an action (e.g. "contract" from "contract.updated")
 * to its TypeORM table name for the before-snapshot SELECT.
 */
const ENTITY_TABLE_MAP: Record<string, string> = {
  contract:    'contracts',
  release:     'releases',
  artist:      'artists',
  transaction: 'transactions',
  invoice:     'invoices',
  campaign:    'campaigns',
  upload:      'uploads',
  setting:     'tenants',
  user:        'org_members',
  billing:     'billing_subscriptions',
  lead:        'leads',
  client:      'clients',
  ticket:      'support_tickets',
  role:        'roles',
  conversation: 'conversations',
};

/** Request shape expected inside the interceptor */
interface AuditRequest {
  auth?:        { userId?: string; orgRole?: string };
  /** tenant is a TypeORM entity — fields are snake_case */
  tenant?:      { id?: string; orgId?: string; org_id?: string };
  ip?:          string;
  requestId?:   string;
  method?:      string;
  url?:         string;
  params?:      Record<string, string>;
  headers?:     Record<string, string>;
  body?:        Record<string, unknown>;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector:    Reflector,
    private readonly auditService: AuditService,
    @Optional() @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_KEY, context.getHandler());
    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest<AuditRequest>();

    // Derive entity name from the action prefix (e.g. "contract.updated" → "contract")
    const entityName = action.split('.')[0];
    const tenantId   = request.tenant?.id  ?? null;

    // Generalised entity-id extraction:
    //  1. Prefer params.id (most common REST pattern)
    //  2. Fallback to any first route param (handles fileId, contractId, …)
    //  3. Fallback to body.id (POST mutations that embed the id in the payload)
    const params = request.params ?? {};
    const entityId: string | null =
      params['id'] ??
      (Object.values(params)[0] as string | undefined) ??
      (request.body?.['id'] as string | undefined) ??
      null;

    // Snapshot captured before the handler fires
    let beforeSnapshot: Record<string, unknown> | null = null;

    const captureBeforeAndHandle = async (): Promise<Observable<unknown>> => {
      // Attempt to load the entity state before the mutation (PATCH / DELETE).
      // Using ds.query() with positional params returns real column names (no alias prefix),
      // which is required for computeDiff to produce a correct before/after diff.
      if (entityId && tenantId && this.ds) {
        const table = ENTITY_TABLE_MAP[entityName];
        if (table) {
          try {
            const rows = await this.ds.query(
              `SELECT * FROM "${table}" WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
              [entityId, tenantId],
            ) as Record<string, unknown>[];
            beforeSnapshot = rows[0] ?? null;
          } catch {
            // Non-critical — proceed without before snapshot
          }
        }
      }

      return next.handle().pipe(
        tap(async (result: unknown) => {
          try {
            const resultObj = result as Record<string, unknown> | null;

            const afterEntityId =
              entityId ??
              (resultObj?.['id'] as string | undefined) ??
              ((resultObj?.['data'] as Record<string, unknown> | undefined)?.['id'] as string | undefined) ??
              null;

            const requestId    = request.requestId ?? request.headers?.['x-request-id'] ?? null;
            const correlationId = CorrelationContext.get() ?? null;
            const sessionId    = request.headers?.['x-session-id'] ?? null;
            const actorRole    = request.auth?.orgRole ?? null;
            // tenant is a TypeORM entity — fields are snake_case (org_id, not orgId)
            const orgId = (request.tenant?.['org_id'] as string | undefined) ?? null;

            await this.auditService.log({
              tenantId:       tenantId,
              orgId,
              userId:         request.auth?.userId ?? null,
              actorRole,
              action,
              entity:         entityName,
              entityId:       afterEntityId,
              before:         sanitizeForAudit(beforeSnapshot),
              after:          sanitizeForAudit(result),
              ip:             request.ip         ?? null,
              userAgent:      request.headers?.['user-agent'] ?? null,
              requestId,
              correlationId,
              sessionId,
              httpMethod:     request.method     ?? null,
              httpPath:       request.url ? redactUrl(request.url) : null,
            });
          } catch {
            // AuditInterceptor must never throw — swallow all errors
          }
        }),
      );
    };

    // Return a synchronous Observable that bridges the async setup
    return new Observable(subscriber => {
      captureBeforeAndHandle().then(obs => {
        obs.subscribe({
          next:     v => subscriber.next(v),
          error:    e => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      }).catch(e => subscriber.error(e));
    });
  }
}
