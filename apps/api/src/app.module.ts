/**
 * app.module.ts
 *
 * Módulo raiz do MUSIC OS 360 API.
 * Infraestrutura:
 *   - PostgreSQL (TypeORM / node-postgres)
 *   - Cache em memória (InMemoryCacheClient)
 *   - Cloudflare R2 (file storage)
 *   - BullMQ + Redis (filas assíncronas)
 *   - JWT (autenticação)
 */

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './core/interceptors/audit.interceptor';
import { RequestTenantContextInterceptor } from './core/interceptors/request-tenant-context.interceptor';
import { RequestIdMiddleware }  from './core/middleware/request-id.middleware';
import { CorrelationMiddleware } from './core/middleware/correlation.middleware';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { validateEnv } from './core/config/env.schema';
import { DatabaseModule }       from './database/database.module';
import { CacheModule }          from './cache/cache.module';
import { StorageModule }        from './storage/storage.module';
import { HealthModule }         from './modules/health/health.module';
import { QueueModule }          from './queues/queue.module';
import { AuthModule }           from './modules/auth/auth.module';
import { CompanySettingsModule } from './modules/company-settings/company-settings.module';
import { CoreModule }           from './core/core.module';
import { AutomationModule }     from './core/automation/automation.module';
import { MetricsModule }        from './core/metrics/metrics.module';
import { AdminQueuesModule }    from './core/admin/admin-queues.module';
import { PlanLimitModule }      from './core/billing/plan-limit.module';
import { ArtistsModule }        from './modules/artists/artists.module';
import { WorksModule }          from './modules/works/works.module';
import { PhonogramsModule }     from './modules/phonograms/phonograms.module';
import { ContractsModule }      from './modules/contracts/contracts.module';
import { TransactionsModule }   from './modules/transactions/transactions.module';
import { RealtimeModule }       from './core/realtime/realtime.module';
import { NotificationsModule }     from './modules/notifications/notifications.module';
import { UploadsModule }           from './modules/uploads/uploads.module';
import { ContractTemplatesModule } from './modules/contract-templates/contract-templates.module';
import { ContractServiceTypesModule } from './modules/contract-service-types/contract-service-types.module';
import { InvoicesModule }          from './modules/invoices/invoices.module';
import { ClientsModule }           from './modules/clients/clients.module';
import { LeadsModule }             from './modules/leads/leads.module';
import { LeadInteractionsModule }  from './modules/lead-interactions/lead-interactions.module';
import { ContactsModule }          from './modules/contacts/contacts.module';
import { ContactTimelineModule }   from './modules/contact-timeline/contact-timeline.module';
import { OperationalListsModule }  from './modules/operational-lists/operational-lists.module';
import { ContactAttachmentsModule } from './modules/contact-attachments/contact-attachments.module';
import { ContactContractsModule }  from './modules/contact-contracts/contact-contracts.module';
import { CampaignsModule }         from './modules/campaigns/campaigns.module';
import { MarketingModule }         from './modules/marketing/marketing.module';
import { BriefingsModule }         from './modules/briefings/briefings.module';
import { EventsModule }            from './modules/events/events.module';
import { ProjectsModule }          from './modules/projects/projects.module';
import { TakedownsModule }         from './modules/takedowns/takedowns.module';
import { SharesModule }            from './modules/shares/shares.module';
import { ReleasesModule }          from './modules/releases/releases.module';
import { UsersModule }             from './modules/users/users.module';
import { AuditLogModule }          from './modules/audit-log/audit-log.module';
import { ActivityLogsModule }       from './modules/activity-logs/activity-logs.module';
import { SupportTicketsModule }    from './modules/support-tickets/support-tickets.module';
import { SupportRequestsModule }   from './modules/support-requests/support-requests.module';
import { KnowledgeBaseModule }     from './modules/knowledge-base/knowledge-base.module';
import { AdminUsersModule }        from './modules/admin-users/admin-users.module';
import { IntegrationsModule }      from './modules/integrations/integrations.module';
import { AIModule }                from './modules/ai/ai.module';
import { BillingModule }           from './modules/billing/billing.module';
import { ArtistGoalsModule }       from './modules/artist-goals/artist-goals.module';
import { ContentDetectionsModule } from './modules/content-detections/content-detections.module';
import { EcadReportsModule }       from './modules/ecad-reports/ecad-reports.module';
import { HrModule }                from './modules/hr/hr.module';
import { DomainEventsModule }     from './core/events/events.module';
import { SkillsModule }           from './core/skills/skills.module';
import { AssetsModule }           from './modules/assets/assets.module';
import { WorkflowModule }         from './core/workflow/workflow.module';
import { ConversationsModule }    from './modules/conversations/conversations.module';
import { InternalChatModule }     from './modules/internal-chat/internal-chat.module';
import { PlatformContactModule }  from './modules/platform-contact/platform-contact.module';
import { AnalyticsModule }        from './modules/analytics/analytics.module';
import { InventoryModule }        from './modules/inventory/inventory.module';
import { LicensingModule }        from './modules/licensing/licensing.module';
import { FinancialRulesModule }   from './modules/financial-rules/financial-rules.module';
import { FinancialCategoriesModule } from './modules/financial-categories/financial-categories.module';
import { FinanceCategoryRulesModule } from './modules/finance-category-rules/finance-category-rules.module';
import { AudiovisualModule }      from './modules/audiovisual/audiovisual.module';
import { RegistryModule }         from './modules/registry/registry.module';
import { ReportsModule }          from './modules/reports/reports.module';
import { JwtAuthGuard }    from './core/guards/auth.guard';
import { MustChangePasswordGuard } from './core/guards/must-change-password.guard';
import { TenantGuard }     from './core/guards/tenant.guard';
import { BillingEnforcementGuard } from './core/guards/billing-enforcement.guard';
import { RolesGuard }      from './core/guards/roles.guard';
import { PermissionsGuard } from './core/guards/permissions.guard';
import { RateLimitGuard }  from './core/guards/rate-limit.guard';

@Module({
  imports: [
    // ── Ambiente ─────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // main.ts (loadLocalEnv) já popula process.env a partir de apps/api/.env.development
      // ANTES do bootstrap; reler o arquivo aqui duplicava a carga e podia
      // divergir. Estratégia única: process.env é a fonte de verdade.
      ignoreEnvFile: true,
    }),

    // ── PostgreSQL (TypeORM / node-postgres) ──────────────────────────────────
    DatabaseModule,

    // ── Cache em memória ─────────────────────────────────────────────────────
    CacheModule,

    // ── Cloudflare R2 (file storage) ──────────────────────────────────────────
    StorageModule,

    // ── Domain Events (pub/sub, event-log, correlation) ──────────────────────
    DomainEventsModule,

    // ── Core (EncryptionService, AuditService, RateLimitService) ─────────────
    CoreModule,

    // ── Metrics (Prometheus /metrics + HTTP interceptor) ──────────────────────
    MetricsModule,

    // ── Plan Limit Enforcement (global — quota checks before create) ──────────
    PlanLimitModule,

    // ── Auth (JWT) ────────────────────────────────────────────────────────────
    AuthModule,
    CompanySettingsModule,

    // ── Filas (BullMQ) — só quando Redis ioredis está disponível ─────────────
    QueueModule.register(),

    // ── BullBoard admin dashboard (/admin/queues, basic-auth) ─────────────────
    AdminQueuesModule.register(),

    // ── Realtime (Supabase Realtime Broadcast — replaces Socket.IO WsGateway) ──
    RealtimeModule,

    // ── Módulos de domínio ────────────────────────────────────────────────────
    HealthModule,
    ArtistsModule,
    WorksModule,
    PhonogramsModule,
    ContractsModule,
    TransactionsModule,
    NotificationsModule,
    UploadsModule,

    // ── Módulos FASE 3 ────────────────────────────────────────────────────────
    ContractTemplatesModule,
    ContractServiceTypesModule,
    InvoicesModule,
    ClientsModule,
    LeadsModule,
    OperationalListsModule,
    LeadInteractionsModule,
    ContactsModule,
    ContactTimelineModule,
    ContactAttachmentsModule,
    ContactContractsModule,
    CampaignsModule,
    MarketingModule,
    BriefingsModule,
    EventsModule,
    ProjectsModule,
    TakedownsModule,
    SharesModule,
    ReleasesModule,
    UsersModule,
    AuditLogModule,
    ActivityLogsModule,
    SupportTicketsModule,
    SupportRequestsModule,
    KnowledgeBaseModule,
    AdminUsersModule,

    // ── Módulos FASE 7 — Integrações Reais ───────────────────────────────────
    IntegrationsModule,

    // ── Módulos FASE 8 — AI Gateway ──────────────────────────────────────────
    AIModule,

    // ── Módulos FASE 6 — Stripe Billing ──────────────────────────────────────
    BillingModule,

    // ── Módulos FASE 10 — Artist Goals / Content Detections / ECAD / HR ──────
    ArtistGoalsModule,
    ContentDetectionsModule,
    EcadReportsModule,
    HrModule,

    // ── Skills runtime + Modelo central de assets (Fatia 1) ───────────────────
    SkillsModule,
    AssetsModule,

    // ── Automações nativas event-driven (project.completed → project-planning) ─
    AutomationModule,

    // ── Workflow Engine (state machine global) ────────────────────────────────
    WorkflowModule,

    // ── Phase 9 — Conversations/Inbox ─────────────────────────────────────────
    ConversationsModule,
    InternalChatModule,

    // Phase 12 — Forms & Submissions removido (DropGenericFormsModule20260822000005):
    // decisão de produto — nenhum Form Builder genérico.

    // ── Platform Commercial Contact — contato institucional da landing ────────
    PlatformContactModule,

    // ── Phase 13 — Analytics & AI Governance ──────────────────────────────────
    AnalyticsModule,

    // ── Novos módulos — Inventory / Licensing / Financial Rules ──────────────
    InventoryModule,
    LicensingModule,
    FinancialRulesModule,
    FinancialCategoriesModule,
    FinanceCategoryRulesModule,

    // ── Audiovisual / Video Production
    AudiovisualModule,

    // ── Registry (ABRAMUS/ECAD) — rights holders & external identifiers
    RegistryModule,

    // ── Reports — inventário entity-driven (FASE 1: metadata)
    ReportsModule,
  ],
  providers: [
    // FASE 3J — Interceptor global OUTERMOST: estabelece app.current_tenant_id por
    // request (transparente). Deve vir ANTES do AuditInterceptor para que as
    // leituras de auditoria também rodem dentro do contexto de tenant.
    {
      provide:  APP_INTERCEPTOR,
      useClass: RequestTenantContextInterceptor,
    },
    // Interceptor global — processa @Audit() em todas as rotas com DI completo
    {
      provide:  APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // Guards globais aplicados a TODAS as rotas
    // Ordem: RateLimitGuard → JwtAuthGuard → TenantGuard → RolesGuard → PermissionsGuard
    Reflector,
    {
      provide:  APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide:  APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide:  APP_GUARD,
      useClass: MustChangePasswordGuard,
    },
    {
      provide:  APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide:  APP_GUARD,
      useClass: BillingEnforcementGuard,
    },
    {
      provide:  APP_GUARD,
      useClass: RolesGuard,
    },
    // FASE 6 — autorização por permissão (resource:action), após o RolesGuard.
    // Não substitui o RolesGuard; só atua em rotas com @RequirePermission e respeita a
    // RBAC_PERSISTED_AUTHORITY controla o modo (default SHADOW = observação).
    {
      provide:  APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, CorrelationMiddleware).forRoutes('*');
  }
}
