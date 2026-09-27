/**
 * core/security/security-startup.service.ts
 *
 * Validates the security configuration at application boot.
 * In production, terminates the process if critical keys are missing or
 * have insecure default values.
 * In development, emits warnings without blocking the boot.
 */

import { Optional, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isProdLike } from '../config/runtime-environment';

const ZERO_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

interface SecurityCheck {
  name:    string;
  fatal:   boolean;
  check:   () => boolean;
  message: string;
}

@Injectable()
export class SecurityStartupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SecurityStartupService.name);

  constructor(@Optional() private readonly config?: ConfigService) {}

  private getConfig(key: string): string | undefined {
    return this.config?.get<string>(key) ?? process.env[key];
  }

  onApplicationBootstrap(): void {
    const prodLike = isProdLike(this.getConfig('NODE_ENV'));
    const checks: SecurityCheck[] = [
      {
        name:    'ENCRYPTION_KEY present',
        fatal:   true,
        check:   () => Boolean(this.getConfig('ENCRYPTION_KEY')),
        message: 'ENCRYPTION_KEY not set — PII will be encrypted with the zero key (INSECURE)',
      },
      {
        name:    'ENCRYPTION_KEY is not the zero key',
        fatal:   true,
        check:   () => this.getConfig('ENCRYPTION_KEY') !== ZERO_KEY,
        message: 'ENCRYPTION_KEY is the default zero key — replace it with a 64-hex-char key before deploying',
      },
      {
        name:    'SUPABASE_URL present',
        fatal:   true,
        check:   () => Boolean(this.getConfig('SUPABASE_URL')),
        message: 'SUPABASE_URL not set — JWT authentication will not work',
      },
      {
        name:    'DATABASE_URL present',
        fatal:   false,
        check:   () => Boolean(this.getConfig('DATABASE_URL')),
        message: 'DATABASE_URL not set — API in standalone mode without persistence',
      },
      {
        name:    'SUPABASE_SERVICE_ROLE_KEY present in production',
        fatal:   true,
        check:   () => !prodLike || Boolean(this.getConfig('SUPABASE_SERVICE_ROLE_KEY')),
        message: 'SUPABASE_SERVICE_ROLE_KEY not set — Supabase admin operations will not work',
      },
      {
        name:    'STRIPE_WEBHOOK_SECRET present when Stripe is enabled',
        fatal:   true,
        check:   () => {
          if (!prodLike) return true;
          const stripeActive = Boolean(this.getConfig('STRIPE_SECRET_KEY'));
          return !stripeActive || Boolean(this.getConfig('STRIPE_WEBHOOK_SECRET'));
        },
        message: 'STRIPE_WEBHOOK_SECRET not set — Stripe webhooks will be rejected in production',
      },
      {
        name:    'SENTRY_DSN present in production',
        fatal:   true,
        check:   () => !prodLike || Boolean(this.getConfig('SENTRY_DSN')),
        message: 'SENTRY_DSN not set in production — errors will not be reported to Sentry',
      },
      {
        name:    'RESEND_API_KEY present in production',
        fatal:   false,
        check:   () => !prodLike || Boolean(this.getConfig('RESEND_API_KEY')),
        message: 'RESEND_API_KEY not set in production — transactional e-mails will not be sent',
      },
      {
        name:    'AUTH/MOCK bypass disabled in prod-like environments',
        fatal:   true,
        check:   () =>
          !prodLike ||
          !['AUTH_DISABLED', 'MOCK_MODE', 'USE_MOCK', 'VITE_MOCK_MODE'].some(
            (key) => this.getConfig(key) === 'true',
          ),
        message: 'AUTH_DISABLED/MOCK_MODE/USE_MOCK/VITE_MOCK_MODE cannot be active in staging/production',
      },
      {
        name:    'METRICS_TOKEN present in prod-like environments',
        fatal:   true,
        check:   () => !prodLike || Boolean(this.getConfig('METRICS_TOKEN')),
        message: 'METRICS_TOKEN not set - /metrics must require a token in staging/production',
      },
    ];

    let hasFatal = false;
    for (const item of checks) {
      if (!item.check()) {
        if (item.fatal && prodLike) {
          this.logger.error(`[FATAL SECURITY] ${item.name}: ${item.message}`);
          hasFatal = true;
        } else {
          this.logger.warn(`[SECURITY] ${item.name}: ${item.message}`);
        }
      } else {
        this.logger.debug(`[SECURITY] ✓ ${item.name}`);
      }
    }

    if (hasFatal) {
      this.logger.error('[SECURITY] Invalid security configuration — terminating process.');
      setTimeout(() => process.exit(1), 200);
    } else {
      this.logger.log('[SECURITY] Security configuration validated.');
    }
  }
}
