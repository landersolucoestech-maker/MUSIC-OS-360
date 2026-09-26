/**
 * core/realtime/realtime.service.ts
 *
 * RealtimeService — replaces the Socket.IO WsGateway (core/websocket/) with
 * Supabase Realtime Broadcast, since Vercel Functions cannot hold a
 * persistent WebSocket connection between invocations.
 *
 * Every broadcast is sent server-side using the service_role key, which
 * bypasses RLS entirely — no client is ever authorized to publish a domain
 * event. Clients receive broadcasts by subscribing to the same topic names
 * this service uses (`tenant:<org_id>`, `user:<user_id>`) as PRIVATE
 * channels; whether a given client's JWT is allowed to join that topic is
 * decided by Postgres via the RLS policies added in
 * 20260801000001_RealtimeBroadcastAuthorization — this service has no
 * authorization logic of its own, matching how WsGateway's room-join
 * decision used to live in the gateway, not the emitters.
 *
 * Every caller across the codebase passes `tenants.id` (the PK) to
 * sendToTenant/sendToUser — never `tenants.org_id`, even though the RLS
 * policy and the frontend subscription (ws-client.ts) both key the topic on
 * `org_id`. Rather than touch every caller in every module, this service
 * resolves `tenants.id -> org_id` internally (cached) before building the
 * topic string, so the public API keeps accepting the tenant id every
 * caller already has in scope, and the topic published always matches what
 * RLS/the frontend actually authorize/subscribe to.
 *
 * If SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are unset (e.g. some local/test
 * setups), every method is a silent no-op — mirrors WsGateway's tolerance of
 * a missing Redis adapter (single-instance mode) rather than crashing.
 */

import { Injectable, Inject, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE, ADMIN_DATA_SOURCE } from '../../database/database.module';
import { TenantEntity } from '../../database/entities';
import { tenantAls } from '../../database/tenant-als';

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly client: SupabaseClient | null;
  private readonly tenantRepo: Repository<TenantEntity> | null = null;
  /** tenants.id -> tenants.org_id — org_id never changes for a given tenant row. */
  private readonly orgIdCache = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    @Inject(DATA_SOURCE) ds: DataSource | null,
    @Optional() @Inject(ADMIN_DATA_SOURCE) adminDs?: DataSource | null,
  ) {
    const url            = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (url && serviceRoleKey) {
      this.client = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      this.client = null;
      this.logger.warn(
        'RealtimeService: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — broadcasts desativados (no-op)',
      );
    }
    // find-c703b56c (class find-b4201eb2): `tenants` is FORCE RLS (org_isolation). This lookup
    // runs deliberately OUTSIDE any tenant context (tenantAls.exit below), so
    // through the app role (NOBYPASSRLS) it found no row and EVERY tenant
    // broadcast was skipped in production. The Supabase service_role only
    // applies to the broadcast client, not to this DB read: use the owner
    // read-only ADMIN_DATA_SOURCE for the tenant -> org mapping.
    const lookupDs = adminDs ?? ds;
    if (lookupDs) {
      this.tenantRepo = lookupDs.getRepository(TenantEntity);
    }
  }

  /**
   * Resolve tenants.id -> tenants.org_id (o identificador real do tópico RLS/frontend).
   *
   * broadcastToTenant() dispara isto fire-and-forget (nunca aguardado pelo
   * caller) — se o caller estiver dentro de RequestTenantContextInterceptor /
   * DatabaseContextService.runInTenantContext (DATABASE_SESSION_CONTEXT_ENABLED=true),
   * o QueryRunner request-scoped pode já ter sido liberado (finally do
   * runInTenantContext) antes desta query assíncrona terminar, lançando
   * QueryRunnerAlreadyReleasedError. A consulta usa ADMIN_DATA_SOURCE (owner,
   * somente leitura) — o service_role do Supabase vale só para o broadcast,
   * não para esta leitura no Postgres.
   * `tenantAls.exit()` garante que o Proxy de DATA_SOURCE (tenant-als.ts) NUNCA
   * veja um store ativo aqui, então esta query sempre usa uma conexão própria
   * do pool, independente do ciclo de vida de qualquer QueryRunner de request.
   */
  private async resolveOrgId(tenantId: string): Promise<string | null> {
    const cached = this.orgIdCache.get(tenantId);
    if (cached) return cached;
    if (!this.tenantRepo) return null;

    const tenant = await tenantAls.exit(() =>
      this.tenantRepo!.findOne({ where: { id: tenantId } as any, select: ['org_id'] as any }),
    );
    if (!tenant) {
      this.logger.warn(`RealtimeService: tenant ${tenantId} não encontrado — broadcast pulado`);
      return null;
    }
    this.orgIdCache.set(tenantId, tenant.org_id);
    return tenant.org_id;
  }

  /** Publica em `tenant:<org_id>`, resolvendo tenantId -> org_id primeiro. */
  private broadcastToTenant(tenantId: string, event: string, payload: unknown): void {
    if (!this.client) return;
    void this.resolveOrgId(tenantId).then((orgId) => {
      if (orgId) this.broadcast(`tenant:${orgId}`, event, payload);
    });
  }

  onModuleDestroy(): void {
    this.client?.removeAllChannels();
  }

  /** Publishes one broadcast message to a topic, then tears the channel back down. */
  private broadcast(topic: string, event: string, payload: unknown): void {
    if (!this.client) return;
    const client = this.client;

    const channel = client.channel(topic, { config: { private: true } });
    channel.subscribe((status: string, err?: Error) => {
      if (status === 'SUBSCRIBED') {
        channel
          .send({ type: 'broadcast', event, payload })
          .catch((sendErr: unknown) => {
            this.logger.warn(`RealtimeService: falha ao publicar em "${topic}" — ${String(sendErr)}`);
          })
          .finally(() => {
            client.removeChannel(channel);
          });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.logger.warn(`RealtimeService: falha ao conectar em "${topic}" (${status}) — ${err?.message ?? ''}`);
        client.removeChannel(channel);
      }
    });
  }

  /** Emite evento para todos os clientes do tenant. */
  sendToTenant(tenantId: string, event: string, data: unknown): void {
    this.broadcastToTenant(tenantId, event, data);
  }

  /**
   * Emite evento para um utilizador específico E para o tenant — preserva o
   * comportamento dual do WsGateway original (`.to(tenant).to(user).emit()`),
   * já que dashboards a observar o canal do tenant também esperavam ver
   * notificações individuais.
   */
  sendToUser(tenantId: string, userId: string, event: string, data: unknown): void {
    this.broadcast(`user:${userId}`, event, data);
    this.broadcastToTenant(tenantId, event, data);
  }

  /**
   * Emite evento SOMENTE para o utilizador — sem o fan-out para o canal do
   * tenant que sendToUser() faz. Usar para eventos privados ponto-a-ponto
   * (ex.: chat interno) onde o próprio ID da conversa/mensagem não deve ser
   * visível para membros do tenant que não participam dela.
   */
  sendToUserOnly(userId: string, event: string, data: unknown): void {
    this.broadcast(`user:${userId}`, event, data);
  }

  /**
   * Notifica o tenant que um recurso foi alterado.
   * O frontend invalida a query correspondente ao receber este evento.
   */
  notifyDataChanged(tenantId: string, entity: string, id: string): void {
    this.broadcastToTenant(tenantId, 'data:changed', { entity, id });
  }
}
