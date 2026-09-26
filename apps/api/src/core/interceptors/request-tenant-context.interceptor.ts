/**
 * core/interceptors/request-tenant-context.interceptor.ts
 *
 * PHASE 3J — Establishes the database tenant context for EVERY authenticated HTTP
 * request, transparently (no service/controller needs to change).
 *
 * Flow: the guards already populate `request.tenant` (TenantGuard). This interceptor —
 * registered as the OUTERMOST APP_INTERCEPTOR — wraps the handler in
 * `DatabaseContextService.runInTenantContext`, which opens a transaction, runs
 * `set_config('app.current_tenant_id', …)` and binds the EntityManager to
 * AsyncLocalStorage. The DATA_SOURCE Proxy then routes every query
 * (including global repos captured in constructors) to that connection/context.
 *
 * Result: `private_get_tenant_id()` now returns the correct tenant during
 * any HTTP controller — fixing the PHASE 3I finding without touching RLS,
 * policies, migrations, schema or the business services.
 *
 * Compatibility: gated by `DatabaseContextService.isEnabled`
 * (DATABASE_SESSION_CONTEXT_ENABLED=true). Requests without a tenant (public routes,
 * health) pass straight through. Workers/jobs/schedulers keep using
 * runInTenantContext directly — unchanged.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { DatabaseContextService } from '../../database/database-context.service';

interface TenantRequest {
  tenant?: { id?: string; org_id?: string; orgId?: string } | null;
  currentMember?: { role?: string } | null;
  auth?: { orgId?: string; orgRole?: string } | null;
}

@Injectable()
export class RequestTenantContextInterceptor implements NestInterceptor {
  constructor(@Optional() private readonly dbContext?: DatabaseContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // HTTP only, and only with the context primitive enabled.
    if (context.getType() !== 'http' || !this.dbContext?.isEnabled) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<TenantRequest>();
    const tenantId = req?.tenant?.id ?? null;
    if (!tenantId) {
      // Public route / no resolved tenant → no context (current behavior).
      return next.handle();
    }

    const orgId = req?.tenant?.org_id ?? req?.tenant?.orgId ?? req?.auth?.orgId ?? null;
    const role = req?.currentMember?.role ?? req?.auth?.orgRole ?? null;

    // Wraps the WHOLE rest of the chain (inner interceptors + handler) in the
    // contextualized transaction. Errors propagate → automatic rollback.
    return from(
      this.dbContext.runInTenantContext({ tenantId, orgId, role }, () =>
        lastValueFrom(next.handle()),
      ),
    );
  }
}
