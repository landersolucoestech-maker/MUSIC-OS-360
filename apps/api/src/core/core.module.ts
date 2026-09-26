/**
 * core/core.module.ts
 *
 * CoreModule — aggregates all cross-cutting infrastructure services:
 *   - EncryptionService  (AES-256-GCM for PII fields)
 *   - AuditService       (audit_logs Drizzle)
 *   - AuditInterceptor   (automatic recording via @Audit())
 *   - RateLimitService   (Upstash sliding window)
 *   - RateLimitGuard     (injectable guard)
 *   - MailService        (Resend — transactional email)
 *   - PostHogService     (server-side product analytics)
 *
 * It is @Global() — import it once in AppModule.
 */

import { Global, Module }            from '@nestjs/common';
import { EncryptionService }          from './security/encryption.service';
import { TokenVerifierService }       from './security/token-verifier.service';
import { SecurityStartupService }     from './security/security-startup.service';
import { AuditService }               from './audit/audit.service';
import { AuditInterceptor }           from './interceptors/audit.interceptor';
import { ETagInterceptor }            from './interceptors/etag.interceptor';
import { IdempotencyStore }           from './interceptors/idempotency.store';
import { IdempotencyInterceptor }     from './interceptors/idempotency.interceptor';
import { CircuitBreakerRegistry }     from './resilience/circuit-breaker.registry';
import { RateLimitService }           from './security/rate-limit.service';
import { RateLimitGuard }             from './guards/rate-limit.guard';
import { MailService }                from './mail/mail.service';
import { PostHogService }             from './analytics/posthog.service';
import { ExternalDataProviderRegistry } from './external-data/external-data-provider-registry.service';
import { ExternalDataExchangeService }  from './external-data/external-data-exchange.service';

@Global()
@Module({
  providers: [
    EncryptionService,
    TokenVerifierService,
    SecurityStartupService,
    AuditService,
    AuditInterceptor,
    ETagInterceptor,
    IdempotencyStore,
    IdempotencyInterceptor,
    CircuitBreakerRegistry,
    RateLimitService,
    RateLimitGuard,
    MailService,
    PostHogService,
    ExternalDataProviderRegistry,
    ExternalDataExchangeService,
  ],
  exports: [
    EncryptionService,
    TokenVerifierService,
    SecurityStartupService,
    AuditService,
    AuditInterceptor,
    ETagInterceptor,
    IdempotencyStore,
    IdempotencyInterceptor,
    CircuitBreakerRegistry,
    RateLimitService,
    RateLimitGuard,
    MailService,
    PostHogService,
    ExternalDataProviderRegistry,
    ExternalDataExchangeService,
  ],
})
export class CoreModule {}
