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
        name:    'ENCRYPTION_KEY presente',
        fatal:   true,
        check:   () => Boolean(this.getConfig('ENCRYPTION_KEY')),
        message: 'ENCRYPTION_KEY não definida — dados PII serão cifrados com chave zero (INSEGURO)',
      },
      {
        name:    'ENCRYPTION_KEY não é zero-key',
        fatal:   true,
        check:   () => this.getConfig('ENCRYPTION_KEY') !== ZERO_KEY,
        message: 'ENCRYPTION_KEY é a chave zero padrão — substituir por chave de 64 hex chars antes do deploy',
      },
      {
        name:    'SUPABASE_URL presente',
        fatal:   true,
        check:   () => Boolean(this.getConfig('SUPABASE_URL')),
        message: 'SUPABASE_URL não definida — autenticação JWT não funcionará',
      },
      {
        name:    'DATABASE_URL presente',
        fatal:   false,
        check:   () => Boolean(this.getConfig('DATABASE_URL')),
        message: 'DATABASE_URL não definida — API em modo standalone sem persistência',
      },
      {
        name:    'SUPABASE_SERVICE_ROLE_KEY presente em produção',
        fatal:   true,
        check:   () => !prodLike || Boolean(this.getConfig('SUPABASE_SERVICE_ROLE_KEY')),
        message: 'SUPABASE_SERVICE_ROLE_KEY não definida — operações admin Supabase não funcionarão',
      },
      {
        name:    'STRIPE_WEBHOOK_SECRET presente quando Stripe activo',
        fatal:   true,
        check:   () => {
          if (!prodLike) return true;
          const stripeActive = Boolean(this.getConfig('STRIPE_SECRET_KEY'));
          return !stripeActive || Boolean(this.getConfig('STRIPE_WEBHOOK_SECRET'));
        },
        message: 'STRIPE_WEBHOOK_SECRET não definido — webhooks Stripe serão rejeitados em produção',
      },
      {
        name:    'SENTRY_DSN presente em produção',
        fatal:   true,
        check:   () => !prodLike || Boolean(this.getConfig('SENTRY_DSN')),
        message: 'SENTRY_DSN não definido em produção — erros não serão reportados ao Sentry',
      },
      {
        name:    'RESEND_API_KEY presente em produção',
        fatal:   false,
        check:   () => !prodLike || Boolean(this.getConfig('RESEND_API_KEY')),
        message: 'RESEND_API_KEY não definida em produção — emails transacionais não serão enviados',
      },
      {
        name:    'AUTH/MOCK bypass desativado em prod-like',
        fatal:   true,
        check:   () =>
          !prodLike ||
          !['AUTH_DISABLED', 'MOCK_MODE', 'USE_MOCK', 'VITE_MOCK_MODE'].some(
            (key) => this.getConfig(key) === 'true',
          ),
        message: 'AUTH_DISABLED/MOCK_MODE/USE_MOCK/VITE_MOCK_MODE nao podem estar ativos em staging/production',
      },
      {
        name:    'METRICS_TOKEN presente em prod-like',
        fatal:   true,
        check:   () => !prodLike || Boolean(this.getConfig('METRICS_TOKEN')),
        message: 'METRICS_TOKEN nao definido - /metrics deve exigir token em staging/production',
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
