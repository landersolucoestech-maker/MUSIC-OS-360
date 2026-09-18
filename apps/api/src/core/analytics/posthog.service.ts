/**
 * core/analytics/posthog.service.ts
 *
 * PostHogService — product analytics server-side.
 * Envia eventos de forma assíncrona (fire-and-forget).
 * Se POSTHOG_API_KEY não estiver configurada, todos os métodos são no-op.
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService }                        from '@nestjs/config';

function isPostHogPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  // PostHog keys start with phc_ ; placeholder template "phc_YOUR_POSTHOG_KEY"
  return /YOUR_|PLACEHOLDER|phc_YOUR/i.test(value);
}

@Injectable()
export class PostHogService implements OnModuleDestroy {
  private readonly logger  = new Logger(PostHogService.name);
  private readonly apiKey?: string;
  private readonly host:    string;
  private client: any = null;

  constructor(private readonly config?: ConfigService) {
    this.apiKey = config?.get<string>('POSTHOG_API_KEY') ?? process.env.POSTHOG_API_KEY;
    this.host   = config?.get<string>('POSTHOG_HOST') ?? process.env.POSTHOG_HOST ?? 'https://app.posthog.com';

    if (this.apiKey && !isPostHogPlaceholder(this.apiKey)) {
      this.initClient().catch(err => this.logger.warn(`PostHog init falhou: ${String(err)}`));
    } else if (this.apiKey && isPostHogPlaceholder(this.apiKey)) {
      this.logger.log('PostHogService: monitoring disabled — placeholder detected (POSTHOG_API_KEY looks unconfigured)');
    } else {
      this.logger.log('PostHogService: POSTHOG_API_KEY não configurada — analytics desativado');
    }
  }

  private async initClient(): Promise<void> {
    const { PostHog } = await import('posthog-node');
    this.client = new PostHog(this.apiKey!, {
      host:             this.host,
      flushAt:          20,
      flushInterval:    10_000,
      disableGeoip:     false,
    });
    this.logger.log(`PostHog inicializado — host: ${this.host}`);
  }

  /** Estado real de configuração — usado por analytics-tracking para nunca fingir cobertura de um provedor não configurado. */
  isConfigured(): boolean {
    return this.client !== null;
  }

  // ─── Identify ─────────────────────────────────────────────────────────────

  identify(userId: string, properties: Record<string, unknown>): void {
    if (!this.client) return;
    try {
      this.client.identify({ distinctId: userId, properties });
    } catch (err) {
      this.logger.warn(`PostHog identify erro: ${String(err)}`);
    }
  }

  // ─── Capture (evento) ─────────────────────────────────────────────────────

  capture(params: {
    userId:     string;
    tenantId?:  string;
    event:      string;
    properties?: Record<string, unknown>;
  }): void {
    if (!this.client) return;
    try {
      this.client.capture({
        distinctId:  params.userId,
        event:       params.event,
        properties:  {
          ...params.properties,
          ...(params.tenantId ? { tenant_id: params.tenantId } : {}),
          platform: 'api',
        },
      });
    } catch (err) {
      this.logger.warn(`PostHog capture erro: ${String(err)}`);
    }
  }

  // ─── Group (tenant como org) ──────────────────────────────────────────────

  groupIdentify(tenantId: string, properties: Record<string, unknown>): void {
    if (!this.client) return;
    try {
      this.client.groupIdentify({ groupType: 'tenant', groupKey: tenantId, properties });
    } catch (err) {
      this.logger.warn(`PostHog groupIdentify erro: ${String(err)}`);
    }
  }

  // ─── Feature Flags ────────────────────────────────────────────────────────

  async isFeatureEnabled(flagKey: string, userId: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.isFeatureEnabled(flagKey, userId);
      return result === true;
    } catch {
      return false;
    }
  }

  // ─── Eventos de domínio ───────────────────────────────────────────────────

  trackAIUsage(userId: string, tenantId: string, skill: string, provider: string, costUsd: number): void {
    this.capture({ userId, tenantId, event: 'ai_usage', properties: { skill, provider, cost_usd: costUsd } });
  }

  trackIntegrationConnected(userId: string, tenantId: string, provider: string): void {
    this.capture({ userId, tenantId, event: 'integration_connected', properties: { provider } });
  }

  trackContractSigned(userId: string, tenantId: string, contractId: string): void {
    this.capture({ userId, tenantId, event: 'contract_signed', properties: { contract_id: contractId } });
  }

  trackReleaseCreated(userId: string, tenantId: string, releaseType: string): void {
    this.capture({ userId, tenantId, event: 'release_created', properties: { release_type: releaseType } });
  }

  // ─── Shutdown graceful ────────────────────────────────────────────────────

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
      this.logger.log('PostHog: flush e shutdown concluídos');
    }
  }
}
