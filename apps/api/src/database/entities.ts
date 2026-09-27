/**
 * database/entities.ts
 *
 * TypeORM entity classes for MUSIC OS 360 API.
 * Status fields are typed with enums from @music-os-360/types.
 * Key domain relations declared via @ManyToOne / @OneToMany.
 */

import {
  Entity, PrimaryGeneratedColumn, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
  ManyToOne, OneToMany, ManyToMany, JoinColumn, JoinTable, Relation,
} from 'typeorm';

import {
  TenantPlan,
  BillingStatus,
  SystemRole,
  ArtistStatus,
  ArtistStatusCadastro,
  ContractStatus,
  WorkStatus,
  PhonogramStatus,
  ReleaseStatus,
  ShareStatus,
  TransactionType,
  TransactionStatus,
  InvoiceStatus,
  ClientStatus,
  LeadStatus,
  CampaignStatus,
  BriefingStatus,
  EventStatus,
  ProjectStatus,
  TakedownStatus,
  ContentDetectionStatus,
  SupportTicketStatus,
  SupportTicketPriority,
  UploadStatus,
  IntegrationStatus,
  WebhookEventStatus,
  AIJobStatus,
  EcadReportStatus,
  EmployeeStatus,
  PayrollStatus,
  LeaveRequestStatus,
  ArtistGoalStatus,
  NotificationType,
  IdentifierType,
  RegistrableEntityType,
  SocietyDriver,
  SocietySubmissionStatus,
} from '@music-os-360/types';
import { UserEntity } from '../modules/users/entities/user.entity';

export { UserEntity } from '../modules/users/entities/user.entity';

// ─── Organizations ────────────────────────────────────────────────────────────
@Entity('organizations')
@Index(['external_auth_org_id'])
@Index(['slug'])
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true }) external_auth_org_id: string | null;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 100, unique: true }) slug: string;
  @Column({ type: 'varchar', length: 50, default: TenantPlan.STARTER }) plan: TenantPlan;
  @Column({ type: 'varchar', length: 50, default: BillingStatus.TRIAL }) billing_status: BillingStatus;
  @Column({ type: 'varchar', length: 100, default: 'gravadora' }) industry: string;
  @Column({ type: 'text', nullable: true }) cnpj_encrypted: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) phone: string | null;
  @Column({ type: 'jsonb', default: {} }) address: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) config: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  /** Marks the institutional tenant-zero (LANDER RECORDS). Never read by RLS/RBAC/billing — see tenant-zero.constants.ts. */
  @Column({ type: 'boolean', default: false }) is_system_tenant: boolean;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// ─── Tenants ──────────────────────────────────────────────────────────────────
@Entity('tenants')
@Index(['external_auth_org_id'])
@Index(['slug'])
@Index(['org_id'])
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true }) external_auth_org_id: string | null;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 100, unique: true }) slug: string;
  @Column({ type: 'varchar', length: 50, default: TenantPlan.STARTER }) plan: TenantPlan;
  @Column({ type: 'jsonb', default: {} }) features: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) settings: Record<string, unknown>;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'boolean', default: true }) allow_public_registration: boolean;
  @Column({ type: 'boolean', default: false }) public_registration_blocked: boolean;
  @Column({ type: 'timestamptz', nullable: true }) public_registration_revoked_at: Date | null;
  @Column({ type: 'integer', default: 0 }) public_registration_access_count: number;
  @Column({ type: 'integer', default: 0 }) public_registration_conversion_count: number;
  /** Marks the institutional tenant-zero (LANDER RECORDS). Never read by RLS/RBAC/billing — see tenant-zero.constants.ts. */
  @Column({ type: 'boolean', default: false }) is_system_tenant: boolean;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// ─── Org Members ──────────────────────────────────────────────────────────────
@Entity('org_members')
@Index(['tenant_id', 'auth_user_id'], { unique: true })
@Index(['tenant_id'])
@Index(['auth_user_id'])
@Index(['role_id'])
@Index(['department_id'])
@Index(['position_id'])
export class OrgMemberEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) auth_user_id: string;
  @Column({ type: 'varchar', length: 255 }) email: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) full_name: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone: string | null;
  /** Role stored as a string — LEGACY source, kept during the RBAC transition. */
  @Column({ type: 'varchar', length: 50, default: SystemRole.VIEWER }) role: string;
  /** Enterprise RBAC (PHASE 4) — additive nullable columns; coexist with `role`. */
  @Column({ type: 'uuid', nullable: true }) role_id: string | null;
  @Column({ type: 'uuid', nullable: true }) department_id: string | null;
  @Column({ type: 'uuid', nullable: true }) position_id: string | null;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'timestamp', nullable: true }) joined_at: Date | null;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

// ─── Enterprise RBAC (PHASE 4) — Authorization, Org Chart and Functions ──────────
// Department / Position / JobFunction do NOT grant permission (no role/permission FK).
// Only Role grants permission (via role_permissions). Permission is a global catalog.

// ─── Permission groups (GLOBAL catalog — domain for UX + governance) ──────────
@Entity('permission_groups')
@Index(['domain'])
export class PermissionGroupEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, unique: true }) key: string;
  @Column({ type: 'varchar', length: 64 }) domain: string;
  @Column({ type: 'varchar', length: 160 }) label: string;
  @Column({ type: 'integer', default: 0 }) sort_order: number;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('permissions')
@Index(['resource', 'action'], { unique: true })
@Index(['resource'])
@Index(['group_id'])
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64 }) resource: string;
  @Column({ type: 'varchar', length: 64 }) action: string;
  @Column({ type: 'varchar', length: 160, unique: true }) key: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  /** FK → permission_groups. NULLABLE until the backfill (PHASE 4) populates the link. */
  @Column({ type: 'uuid', nullable: true }) group_id: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) label: string | null;
  @Column({ type: 'integer', default: 1 }) since_version: number;
  @Column({ type: 'timestamptz', nullable: true }) deprecated_at: Date | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) replaced_by_key: string | null;
  @Column({ type: 'boolean', default: true }) is_assignable: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

// ─── Permission aliases (GLOBAL catalog — legacy vocabulary → new) ────────────
@Entity('permission_aliases')
export class PermissionAliasEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 160, unique: true }) legacy_key: string;
  @Column({ type: 'varchar', length: 160 }) new_key: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('role_templates')
@Index(['key'], { unique: true })
@Index(['deleted_at'])
export class RoleTemplateEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64 }) key: string;
  @Column({ type: 'varchar', length: 160 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ type: 'boolean', default: true }) is_system: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('role_template_permissions')
@Index(['template_id', 'permission_id'], { unique: true })
@Index(['template_id'])
@Index(['permission_id'])
export class RoleTemplatePermissionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) template_id: string;
  @Column({ type: 'uuid' }) permission_id: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('permission_dependencies')
@Index(['permission_id', 'depends_on_permission_id'], { unique: true })
@Index(['permission_id'])
@Index(['depends_on_permission_id'])
export class PermissionDependencyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) permission_id: string;
  @Column({ type: 'uuid' }) depends_on_permission_id: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('permission_conflicts')
@Index(['permission_id', 'conflicts_with_permission_id'], { unique: true })
@Index(['permission_id'])
@Index(['conflicts_with_permission_id'])
export class PermissionConflictEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) permission_id: string;
  @Column({ type: 'uuid' }) conflicts_with_permission_id: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('roles')
@Index(['tenant_id'])
@Index(['hierarchy_level'])
@Index(['is_system'])
@Index(['archived_at'])
@Index(['created_by'])
@Index(['updated_by'])
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** NULL = role global/sistema; non-null = role custom do tenant. */
  @Column({ type: 'uuid', nullable: true }) tenant_id: string | null;
  /** Alias → canonical role (e.g. artista→artist, tenant_owner→owner). */
  @Column({ type: 'uuid', nullable: true }) canonical_role_id: string | null;
  @Column({ type: 'varchar', length: 64 }) slug: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'integer', default: 0 }) hierarchy_level: number;
  @Column({ type: 'boolean', default: false }) is_system: boolean;
  @Column({ type: 'boolean', default: true }) is_assignable: boolean;
  @Column({ type: 'timestamptz', nullable: true }) archived_at: Date | null;
  @Column({ type: 'integer', default: 1 }) current_version: number;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('role_inheritance')
@Index(['tenant_id'])
@Index(['child_role_id'])
@Index(['parent_role_id'])
@Index(['child_role_id', 'parent_role_id'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index(['tenant_id', 'child_role_id'], { where: '"deleted_at" IS NULL' })
@Index(['tenant_id', 'parent_role_id'], { where: '"deleted_at" IS NULL' })
export class RoleInheritanceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenant_id: string | null;
  @Column({ type: 'uuid' }) child_role_id: string;
  @Column({ type: 'uuid' }) parent_role_id: string;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Relation<TenantEntity> | null;

  @ManyToOne(() => RoleEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_role_id' })
  childRole: Relation<RoleEntity>;

  @ManyToOne(() => RoleEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_role_id' })
  parentRole: Relation<RoleEntity>;
}

@Entity('role_permissions')
@Index(['role_id', 'permission_id'], { unique: true })
@Index(['permission_id'])
export class RolePermissionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) role_id: string;
  @Column({ type: 'uuid' }) permission_id: string;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('departments')
@Index(['tenant_id'])
@Index(['parent_department_id'])
export class DepartmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) parent_department_id: string | null;
  @Column({ type: 'varchar', length: 64 }) slug: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'integer', default: 0 }) sort_order: number;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('positions')
@Index(['tenant_id'])
@Index(['department_id'])
export class PositionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) department_id: string | null;
  @Column({ type: 'varchar', length: 64 }) slug: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'integer', default: 0 }) sort_order: number;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('job_functions')
@Index(['tenant_id'])
export class JobFunctionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 64 }) slug: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) category: string | null;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('membership_job_functions')
@Index(['membership_id', 'job_function_id'], { unique: true })
@Index(['tenant_id'])
@Index(['job_function_id'])
export class MembershipJobFunctionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) membership_id: string;
  @Column({ type: 'uuid' }) job_function_id: string;
  @Column({ type: 'uuid', nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

// ─── Billing Subscriptions ────────────────────────────────────────────────────
@Entity('billing_subscriptions')
@Index(['org_id'])
export class BillingSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenant_id: string | null;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true }) stripe_customer_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true }) stripe_sub_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true }) stripe_subscription_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) stripe_price_id: string | null;
  @Column({ type: 'varchar', length: 50, default: TenantPlan.STARTER }) plan: TenantPlan;
  @Column({ type: 'varchar', length: 50, default: BillingStatus.TRIAL }) status: BillingStatus;
  @Column({ type: 'timestamp', nullable: true }) trial_ends_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) current_period_start: Date | null;
  @Column({ type: 'timestamp', nullable: true }) current_period_end: Date | null;
  @Column({ type: 'boolean', default: false }) cancel_at_period_end: boolean;
  @Column({ type: 'timestamp', nullable: true }) grace_until: Date | null;
  @Column({ type: 'timestamp', nullable: true }) suspended_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) resumed_at: Date | null;
  @Column({ type: 'integer', default: 3 }) seats: number;
  @Column({ type: 'integer', default: 1 }) seats_used: number;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
}

@Entity('tenant_billing_state')
@Index(['tenant_id'], { unique: true })
@Index(['status'])
export class TenantBillingStateEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 50, default: 'trial' }) status: string;
  @Column({ type: 'timestamp', nullable: true }) last_payment_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) next_payment_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) grace_until: Date | null;
  @Column({ type: 'timestamp', nullable: true }) suspended_at: Date | null;
  @Column({ type: 'boolean', default: false }) manual_override: boolean;
  @Column({ type: 'text', nullable: true }) manual_override_reason: string | null;
  @Column({ type: 'timestamp', nullable: true }) manual_override_until: Date | null;
  @Column({ type: 'timestamptz' }) status_changed_at: Date;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
}

@Entity('payment_events')
@Index(['stripe_event_id'], { unique: true })
@Index(['tenant_id'])
@Index(['event_type'])
export class PaymentEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255, unique: true }) stripe_event_id: string;
  @Column({ type: 'uuid', nullable: true }) tenant_id: string | null;
  @Column({ type: 'varchar', length: 100 }) event_type: string;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ type: 'timestamp', nullable: true }) processed_at: Date | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('billing_settings')
@Index(['key'], { unique: true })
export class BillingSettingsEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 120, unique: true }) key: string;
  @Column({ type: 'jsonb' }) value: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
}

// Plans are the PRIMARY source (admin/database); Stripe only receives the sync.
@Entity('billing_plans')
@Index(['active'])
export class BillingPlanEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 60, unique: true }) slug: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  /** Value in cents. */
  @Column({ type: 'integer' }) amount: number;
  @Column({ type: 'varchar', length: 3, default: 'brl' }) currency: string;
  @Column({ type: 'varchar', length: 10, default: 'month' }) interval: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  // List of labels displayed on the plan card (never a map of flags) — the
  // admin form and the billing/landing screens always treat it as an array
  // (.map/.push/.filter). Column default fixed from {} to [] (Part 84 —
  // it caused "features.map is not a function" in Settings/Billing);
  // BillingPlansService.list()/get() defensively normalizes legacy rows
  // that already persisted {}.
  @Column({ type: 'jsonb', default: [] }) features: unknown[];
  @Column({ type: 'jsonb', default: {} }) limits: Record<string, unknown>;
  /** Commercial slugs included in the plan (entitlements). Dynamic list. */
  @Column({ type: 'jsonb', default: [] }) integrations: string[];
  @Column({ type: 'varchar', length: 255, nullable: true }) stripe_product_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) stripe_price_id: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
}

// ─── Artists ──────────────────────────────────────────────────────────────────
@Entity('artists')
@Index(['tenant_id'])
@Index(['tenant_id', 'status'])
@Index(['tenant_id', 'deleted_at'])
export class ArtistEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) nome_artistico: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) nome_civil: string | null;
  @Column({ type: 'varchar', length: 50, default: ArtistStatus.IN_NEGOTIATION }) status: ArtistStatus;
  @Column({ type: 'varchar', length: 50, default: ArtistStatusCadastro.ACTIVE }) status_cadastro: ArtistStatusCadastro;
  @Column({ type: 'varchar', length: 100, nullable: true }) music_genre: string | null;
  @Column({ type: 'text', nullable: true }) email_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) telefone_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) cpf_cnpj_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) foto_url: string | null;
  @Column({ type: 'jsonb', default: [] }) galeria_urls: unknown[];
  @Column({ type: 'jsonb', default: [] }) documents: unknown[];
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) manager_nome: string | null;
  @Column({ type: 'text', nullable: true }) manager_contato_encrypted: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) produtor_executivo: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) agencia_booking: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) label_parceira: string | null;
  @Column({ type: 'jsonb', default: [] }) especialidades: unknown[];
  @Column({ type: 'text', nullable: true }) spotify_url: string | null;
  @Column({ type: 'text', nullable: true }) youtube_url: string | null;
  @Column({ type: 'text', nullable: true }) deezer_url: string | null;
  @Column({ type: 'text', nullable: true }) apple_music_url: string | null;
  @Column({ type: 'text', nullable: true }) soundcloud_url: string | null;
  @Column({ type: 'uuid', nullable: true }) contrato_id: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @OneToMany(() => PhonogramEntity, (p) => p.artist)
  phonograms: Relation<PhonogramEntity[]>;

  @OneToMany(() => WorkEntity, (w) => w.artist)
  works: Relation<WorkEntity[]>;

  @OneToMany(() => ReleaseEntity, (r) => r.artist)
  releases: Relation<ReleaseEntity[]>;

  @OneToMany(() => ContractEntity, (c) => c.artist)
  contracts: Relation<ContractEntity[]>;
}

@Entity('artist_platform_profiles')
@Index(['tenant_id', 'artist_id'])
@Index(['tenant_id', 'platform'])
@Index(['tenant_id', 'sync_status'])
@Index(['tenant_id', 'artist_id', 'platform'], { unique: true })
export class ArtistPlatformProfileEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) artist_id: string;
  @Column({ type: 'varchar', length: 50 }) platform: string;
  @Column({ type: 'text', nullable: true }) external_id: string | null;
  @Column({ type: 'text', nullable: true }) external_url: string | null;
  @Column({ type: 'text', nullable: true }) display_name: string | null;
  @Column({ type: 'text', nullable: true }) username: string | null;
  @Column({ type: 'text', nullable: true }) profile_url: string | null;
  @Column({ type: 'text', nullable: true }) image_url: string | null;
  @Column({ type: 'integer', nullable: true }) followers: number | null;
  @Column({ type: 'integer', nullable: true }) subscribers: number | null;
  @Column({ type: 'integer', nullable: true }) monthly_listeners: number | null;
  @Column({ type: 'integer', nullable: true }) popularity: number | null;
  @Column({ type: 'bigint', nullable: true }) total_views: string | null;
  @Column({ type: 'integer', nullable: true }) total_videos: number | null;
  @Column({ type: 'integer', nullable: true }) total_tracks: number | null;
  @Column({ type: 'integer', nullable: true }) total_albums: number | null;
  @Column({ type: 'jsonb', default: {} }) raw_payload: Record<string, unknown>;
  @Column({ type: 'varchar', length: 50, default: 'pending' }) sync_status: string;
  @Column({ type: 'timestamptz', nullable: true }) last_synced_at: Date | null;
  @Column({ type: 'text', nullable: true }) last_error: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;

  @ManyToOne(() => ArtistEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: Relation<ArtistEntity>;
}

/**
 * Phase 2 — append-only historical series per (artist, platform, metric,
 * observed_at). `artist_platform_profiles` above remains the
 * current-state projection; this table is the temporal truth that feeds it. Never
 * UPDATE/DELETE by the app (grants in 20260831000001_CreateArtistMetricSnapshots) —
 * the uniqueness below is the idempotency key of the same observed point.
 */
@Entity('artist_metric_snapshots')
@Index(['tenant_id'])
@Index(['observed_at'])
@Index(['tenant_id', 'artist_id', 'platform', 'metric', 'observed_at'], { unique: true })
export class ArtistMetricSnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) artist_id: string;
  @Column({ type: 'varchar', length: 50 }) platform: string;
  @Column({ type: 'varchar', length: 100 }) metric: string;
  @Column({ type: 'numeric' }) value: string;
  @Column({ type: 'varchar', length: 20, default: 'count' }) unit: string;
  @Column({ type: 'varchar', length: 50, default: 'soundcharts' }) source_provider: string;
  @Column({ type: 'text', nullable: true }) registered_identifier: string | null;
  @Column({ type: 'text', nullable: true }) provider_entity_id: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) primary_identity_status: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) cross_platform_status: string | null;
  @Column({ type: 'timestamptz' }) observed_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) fetched_at: Date | null;
  @Column({ type: 'timestamptz' }) recorded_at: Date;
  @Column({ type: 'smallint', default: 1 }) normalizer_version: number;
  @Column({ type: 'jsonb', default: {} }) raw_payload: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;

  @ManyToOne(() => ArtistEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: Relation<ArtistEntity>;
}

/**
 * Phase 3 — append-only result of the Career Stage Engine. Each computation writes
 * a new row (never UPDATE/DELETE by the app — grants in
 * 20260831000002_CreateAnalyticsSnapshots); engine_version changes without deleting
 * previous results.
 */
@Entity('career_stage_snapshots')
@Index(['tenant_id', 'artist_id'])
@Index(['calculated_at'])
export class CareerStageSnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) artist_id: string;
  @Column({ type: 'varchar', length: 20 }) engine_version: string;
  @Column({ type: 'varchar', length: 30 }) status: string;
  @Column({ type: 'numeric', precision: 3, scale: 1, nullable: true }) score: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) classification: string | null;
  @Column({ type: 'smallint', nullable: true }) confidence: number | null;
  @Column({ type: 'numeric', precision: 4, scale: 3, nullable: true }) coverage: string | null;
  @Column({ type: 'jsonb', default: [] }) dimensions: unknown[];
  @Column({ type: 'jsonb', default: [] }) positive_factors: unknown[];
  @Column({ type: 'jsonb', default: [] }) bottlenecks: unknown[];
  @Column({ type: 'jsonb', default: [] }) input_provenance: unknown[];
  @Column({ type: 'timestamptz' }) calculated_at: Date;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;

  @ManyToOne(() => ArtistEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: Relation<ArtistEntity>;
}

/**
 * Phase 3 — append-only result of the Market Benchmark Engine. Same
 * append-only pattern as CareerStageSnapshotEntity.
 */
@Entity('market_benchmark_snapshots')
@Index(['tenant_id', 'artist_id'])
@Index(['calculated_at'])
export class MarketBenchmarkSnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) artist_id: string;
  @Column({ type: 'varchar', length: 20 }) engine_version: string;
  @Column({ type: 'varchar', length: 30 }) status: string;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) score: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) label: string | null;
  @Column({ type: 'jsonb', default: {} }) cohort_definition: Record<string, unknown>;
  @Column({ type: 'smallint', default: 0 }) sample_size: number;
  @Column({ type: 'smallint', nullable: true }) fallback_level: number | null;
  @Column({ type: 'jsonb', default: [] }) metrics: unknown[];
  @Column({ type: 'timestamptz' }) calculated_at: Date;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;

  @ManyToOne(() => ArtistEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_id' })
  artist: Relation<ArtistEntity>;
}

/**
 * Phase 3.1 — technical cache of metrics of EXTERNAL artists (market
 * candidates discovered via Soundcharts /related), deliberately WITHOUT
 * tenant_id/RLS — it is not data owned by any tenant, it is shared public
 * reference data (see 20260831000003_CreateMarketReferenceMetrics).
 * Never exposed directly by a tenant-scoped endpoint.
 */
@Entity('market_reference_metrics')
@Index(['candidate_uuid'])
@Index(['fetched_at'])
@Index(['candidate_uuid', 'metric'], { unique: true })
export class MarketReferenceMetricEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text' }) candidate_uuid: string;
  @Column({ type: 'text', nullable: true }) candidate_name: string | null;
  @Column({ type: 'varchar', length: 2, nullable: true }) candidate_country_code: string | null;
  @Column({ type: 'varchar', length: 100 }) metric: string;
  @Column({ type: 'numeric', nullable: true }) value: string | null;
  @Column({ type: 'varchar', length: 20, default: 'count' }) unit: string;
  @Column({ type: 'timestamptz', nullable: true }) observed_at: Date | null;
  @Column({ type: 'timestamptz' }) fetched_at: Date;
  @Column({ type: 'varchar', length: 50, default: 'soundcharts' }) source_provider: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

// ─── Works (obras) ────────────────────────────────────────────────────────────
@Entity('works')
@Index(['tenant_id'])
@Index(['tenant_id', 'status'])
@Index(['isrc'])
@Index(['iswc'])
export class WorkEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  // `compositores`/`letristas` are derived from `participantes` (now work_participants)
  // and persisted for fast reads in lists/reports without a join — technical
  // justification (2026-07-18 audit). `co_compositores`/`detentores` removed: no
  // active writer (migration WorkParticipantsNormalization20260718000011).
  // `compositor` (singular) REMAINS despite looking equally dead from the real
  // form/DTO: it is a `col()` (importable) in WORKS_CONTRACT, and the Reports
  // bulk-import engine writes INSERT SQL directly against
  // importableColumns, bypassing CreateWorkDto entirely -- a real
  // writer (naming-closure Phase 2 almost removed this column by mistake; see
  // work-participants-normalization.spec.ts, which already documented that writer).
  @Column({ type: 'varchar', length: 255, nullable: true }) compositor: string | null;
  @Column({ type: 'jsonb', nullable: true }) compositores: unknown[] | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) editora: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) isrc: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) iswc: string | null;
  // Renamed from `cod_abramus` (20260718000017) — the value may be a code
  // at ABRAMUS, UBC, SOCINPRO or another collective management society; the physical
  // column was already recreated with this name by the migration, the entity was out of date.
  @Column({ type: 'varchar', length: 100, nullable: true }) cod_entidade: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) cod_ecad: string | null;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) music_genre: string | null;
  @Column({ type: 'varchar', length: 50, default: WorkStatus.PENDING }) status: WorkStatus;
  @Column({ type: 'varchar', length: 20, nullable: true }) duration_text: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) origem_externa: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) origem_externa_id: string | null;
  @Column({ type: 'timestamp', nullable: true }) origem_externa_sincronizado_em: Date | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;

  // ── Registry fields (migration 20260601000001_RegistryFieldsPhase1) ──────────
  @Column({ type: 'jsonb', nullable: true }) alternative_titles: unknown[] | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) language: string | null;
  @Column({ type: 'text', nullable: true }) lyrics: string | null;
  @Column({ type: 'boolean', nullable: true }) is_instrumental: boolean | null;
  @Column({ type: 'integer', nullable: true }) duration_seconds: number | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) registry_status: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) external_reference: string | null;
  @Column({ type: 'boolean', nullable: true }) ai_used: boolean | null;
  @Column({ type: 'jsonb', nullable: true }) ai_tools: unknown[] | null;
  @Column({ type: 'jsonb', nullable: true }) ai_prompts: unknown[] | null;

  // ── Form fields (1 column per field — EXACT name of the form key) ──────────────
  @Column({ type: 'varchar', length: 20, nullable: true }) idioma: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) instrumental: string | null;
  @Column({ type: 'boolean', nullable: true }) criada_por_ia: boolean | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) tipo_ia: string | null;
  @Column({ type: 'jsonb', nullable: true }) ia_harmonia: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) ia_melodia: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) ia_letra: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) outros_titulos: unknown[] | null;
  @Column({ type: 'jsonb', nullable: true }) referencias_conexas: unknown[] | null;
  @Column({ type: 'text', nullable: true }) letra_completa: string | null;
  // `participantes` normalized into work_participants (migration
  // WorkParticipantsNormalization20260718000011) — no longer a jsonb column.
  @Column({ type: 'jsonb', nullable: true }) letristas: unknown[] | null;
  @Column({ type: 'uuid', nullable: true }) project_id: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) tipo_obra: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @ManyToOne(() => ArtistEntity, (a) => a.works, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'artist_id' })
  artist: Relation<ArtistEntity> | null;

  @OneToMany(() => PhonogramEntity, (p) => p.work)
  phonograms: Relation<PhonogramEntity[]>;

  @OneToMany(() => ShareEntity, (s) => s.work)
  shares: Relation<ShareEntity[]>;

  @ManyToMany(() => ReleaseEntity, (r) => r.works)
  releases: Relation<ReleaseEntity[]>;

  @OneToMany(() => WorkParticipantEntity, (p) => p.work)
  participantes_rel: Relation<WorkParticipantEntity[]>;
}

// ─── Work Participants (migration 20260718000011) ─────────────────────────────
// Normalized child table for `works` authorship — replaces the old jsonb
// column `works.participantes`. A participant never needs to be a registered
// entity (the real form does not link to `artists`); `nome` is free text.
@Entity('work_participants')
@Index(['tenant_id', 'work_id'])
export class WorkParticipantEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) work_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 100 }) classe_funcao: string;
  @Column({ type: 'text', nullable: true }) link: string | null;
  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true }) percentual: string | null;
  @Column({ type: 'integer', default: 0 }) sort_order: number;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;

  @ManyToOne(() => WorkEntity, (w) => w.participantes_rel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_id' })
  work: Relation<WorkEntity>;
}

// ─── Phonograms (legacy PT: fonogramas) ─────────────────────────────────────────
export interface PhonogramParticipant {
  id?: string;
  name?: string;
  percentual?: string;
  artist_id?: string;
}

export interface PhonogramParticipation {
  produtorFonografico?: PhonogramParticipant[];
  interprete?: PhonogramParticipant[];
  musicoAcompanhante?: PhonogramParticipant[];
}

@Entity('phonograms')
@Index(['tenant_id'])
@Index(['work_id'])
@Index(['artist_id'])
@Index(['isrc'])
export class PhonogramEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'uuid', nullable: true }) work_id: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) isrc: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) duration_text: string | null;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 50, default: PhonogramStatus.PENDING }) status: PhonogramStatus;
  // compositores/interpretes/produtores (legacy free-text columns) removed
  // (naming-closure Phase 2, 20260923000002_DropDeadPhonogramsLegacyParticipantColumns)
  // -- zero writers in the whole repository (not even accepted by
  // CreatePhonogramDto), superseded by `participacao` (structured jsonb,
  // below, which is what the real Phonogram form actually writes).
  @Column({ type: 'varchar', length: 255, nullable: true }) gravadora: string | null;
  // Renamed from `cod_abramus` (20260718000017) — the value may be a code
  // at ABRAMUS, UBC, SOCINPRO or another collective management society; the physical
  // column was already recreated with this name by the migration, the entity was out of date.
  @Column({ type: 'varchar', length: 100, nullable: true }) cod_entidade: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) cod_ecad: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) origem_externa: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) origem_externa_id: string | null;
  @Column({ type: 'timestamp', nullable: true }) origem_externa_sincronizado_em: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;

  // ── Registry fields (migration 20260601000001_RegistryFieldsPhase1) ──────────
  @Column({ type: 'varchar', length: 255, nullable: true }) version_title: string | null;
  @Column({ type: 'timestamp', nullable: true }) recording_date: Date | null;
  @Column({ type: 'timestamp', nullable: true }) release_date: Date | null;
  @Column({ type: 'uuid', nullable: true }) phonographic_producer_id: string | null;
  @Column({ type: 'uuid', nullable: true }) main_artist_id: string | null;
  @Column({ type: 'uuid', nullable: true }) label_id: string | null;
  @Column({ type: 'integer', nullable: true }) copyright_year: number | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) copyright_owner: string | null;
  @Column({ type: 'varchar', length: 2, nullable: true }) country_of_recording: string | null;
  @Column({ type: 'uuid', nullable: true }) audio_file_id: string | null;
  @Column({ type: 'integer', nullable: true }) duration_seconds: number | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) registry_status: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) external_reference: string | null;
  // migration 20260605000001_AddGenreToPhonograms
  @Column({ type: 'varchar', length: 100, nullable: true }) music_genre: string | null;

  // ── Form fields (1 column per field — EXACT name of the form key) ──────────────
  @Column({ type: 'varchar', length: 100, nullable: true }) agregadora: string | null;
  @Column({ type: 'varchar', length: 5, nullable: true }) isrc_pais: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) isrc_registrante: string | null;
  @Column({ type: 'varchar', length: 4, nullable: true }) isrc_ano: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) isrc_designacao: string | null;
  @Column({ type: 'boolean', nullable: true }) criada_por_ia: boolean | null;
  @Column({ type: 'boolean', nullable: true }) is_instrumental: boolean | null;
  @Column({ type: 'boolean', nullable: true }) nacional: boolean | null;
  @Column({ type: 'boolean', nullable: true }) pub_simultanea: boolean | null;
  @Column({ type: 'date', nullable: true }) emissao: string | null;
  @Column({ type: 'date', nullable: true }) gravacao_original: string | null;
  @Column({ type: 'date', nullable: true }) data_lancamento: string | null;
  @Column({ type: 'integer', nullable: true }) duracao_min: number | null;
  @Column({ type: 'integer', nullable: true }) duracao_seg: number | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) midia: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) classificacao: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) pais_origem: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) pais_publicacao: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  // Real shape: an object with 3 participant array categories
  // (produtorFonografico/interprete/musicoAcompanhante), not an array --
  // see ParticipacaoDto in modules/phonograms/dto/create-phonogram.dto.ts
  // (source of truth for the shape, confirmed against PhonogramFormModal.tsx).
  @Column({ type: 'jsonb', nullable: true }) participacao: PhonogramParticipation | null;
  @Column({ type: 'jsonb', nullable: true }) arquivo_audio: Record<string, unknown> | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  // Artist→Works navigation: Artist → phonograms → PhonogramEntity → work → WorkEntity
  @ManyToOne(() => ArtistEntity, (a) => a.phonograms, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'artist_id' })
  artist: Relation<ArtistEntity> | null;

  @ManyToOne(() => WorkEntity, (w) => w.phonograms, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'work_id' })
  work: Relation<WorkEntity> | null;
}

// ─── Contracts ────────────────────────────────────────────────────────────────
@Entity('contracts')
@Index(['tenant_id'])
@Index(['tenant_id', 'status'])
@Index(['artist_id'])
@Index(['end_date'])
export class ContractEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 50, default: ContractStatus.DRAFT }) status: ContractStatus;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'uuid', nullable: true }) client_id: string | null;
  @Column({ type: 'uuid', nullable: true }) release_id: string | null;
  @Column({ type: 'timestamp', nullable: true }) start_date: Date | null;
  @Column({ type: 'timestamp', nullable: true }) end_date: Date | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) fixed_value: string | null;
  @Column({ type: 'boolean', default: false }) exclusivo: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'text', nullable: true }) arquivo_url: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) autentique_doc_id: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) signing_platform: string | null;
  @Column({ type: 'jsonb', default: [] }) versoes: unknown[];
  // ── Form/wizard fields (1 column per field — exact name) ──────────────────────
  @Column({ type: 'uuid', nullable: true }) template_id: string | null;
  @Column({ type: 'jsonb', nullable: true }) signers: unknown[] | null;
  @Column({ type: 'jsonb', default: [] }) documents: unknown[];
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @ManyToOne(() => ArtistEntity, (a) => a.contracts, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'artist_id' })
  artist: Relation<ArtistEntity> | null;
}

// ─── Contract Templates ───────────────────────────────────────────────────────
@Entity('contract_templates')
@Index(['tenant_id'])
export class ContractTemplateEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 500 }) name: string;
  @Column({ type: 'varchar', length: 100 }) tipo_servico: string;
  @Column({ type: 'text' }) conteudo: string;
  @Column({ type: 'jsonb', default: [] }) variaveis: unknown[];
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'text', nullable: true }) variables_manifest: string | null;
  @Column({ type: 'text', nullable: true }) header_image: string | null;
  @Column({ type: 'text', nullable: true }) footer_image: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
}

// ─── Contract Service Types ───────────────────────────────────────────────────
@Entity('contract_service_types')
@Index(['tenant_id'])
@Index(['tenant_id', 'active', 'sort_order'])
export class ContractServiceTypeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255 }) slug: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) category: string | null;
  @Column({ type: 'jsonb', default: [] }) client_types: string[];
  @Column({ type: 'varchar', length: 50, default: 'valor_fixo' }) financial_model: string;
  @Column({ type: 'boolean', default: false }) requires_external_rights_terms: boolean;
  @Column({ type: 'boolean', default: false }) requires_fixed_value: boolean;
  @Column({ type: 'boolean', default: false }) requires_advance: boolean;
  @Column({ type: 'boolean', default: false }) requires_financial_support: boolean;
  @Column({ type: 'boolean', default: false }) allow_installments: boolean;
  @Column({ type: 'varchar', length: 100, nullable: true }) default_financial_category: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @Column({ type: 'text', nullable: true }) header_image_url: string | null;
  @Column({ type: 'text', nullable: true }) footer_image_url: string | null;
  @Column({ type: 'text', default: '' }) conteudo: string;
  @Column({ type: 'jsonb', default: [] }) participants: unknown;
  @Column({ type: 'jsonb', default: [] }) variables: unknown;
  @Column({ type: 'jsonb', nullable: true }) music_work: unknown;
  @Column({ type: 'jsonb', nullable: true }) signature_settings: unknown;
  @Column({ type: 'jsonb', nullable: true }) branding_settings: unknown;
  @Column({ type: 'varchar', length: 10, default: 'BRL' }) financial_currency: string;
  @Column({ type: 'varchar', length: 50, default: 'unico' }) financial_payment_frequency: string;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) financial_penalty_percentage: string | null;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) financial_interest_percentage: string | null;
  @Column({ type: 'int', nullable: true }) financial_due_days: number | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

// ─── Transactions ─────────────────────────────────────────────────────────────
@Entity('transactions')
@Index(['tenant_id'])
@Index(['tenant_id', 'data'])
@Index(['artist_id'])
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 50 }) type: TransactionType;
  @Column({ type: 'varchar', length: 100 }) categoria: string;
  @Column({ type: 'text', nullable: true }) descricao: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2 }) valor: string;
  @Column({ type: 'timestamp' }) data: Date;
  @Column({ type: 'varchar', length: 50, default: TransactionStatus.PENDING }) status: TransactionStatus;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'uuid', nullable: true }) contrato_id: string | null;
  @Column({ type: 'uuid', nullable: true }) project_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) referencia: string | null;
  @Column({ type: 'text', nullable: true }) comprovante_url: string | null;
  // Financial categorization (financial_categories table). A logical reference
  // — the transactions table has NO physical FK today (creating the FK is Phase 2). The
  // snapshot keeps the category materialized at the time of the entry (jsonb
  // NOT NULL DEFAULT '{}' in the database).
  @Column({ type: 'uuid', nullable: true }) financial_category_id: string | null;
  @Column({ type: 'jsonb', default: {} }) financial_category_snapshot: Record<string, unknown>;
  // ── Form fields (1 column per field — EXACT name of the form key) ──────────────
  @Column({ type: 'varchar', length: 50, nullable: true }) tipo_transacao: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) tipo_cliente: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) subcategoria: string | null;
  @Column({ type: 'date', nullable: true }) data_transacao: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) fornecedor_cliente: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) orgao_arrecadador: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) centro_custo: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) competencia: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) conta_origem: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) conta_destino: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) item_investimento: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) motivo_viagem: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) advertising_name: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) forma_pagamento: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) tipo_pagamento: string | null;
  @Column({ type: 'integer', nullable: true }) quantidade_parcelas: number | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) intervalo_parcelas: string | null;
  @Column({ type: 'date', nullable: true }) data_primeira_parcela: string | null;
  @Column({ type: 'text', nullable: true }) anexo_url: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) anexo_nome: string | null;
  @Column({ type: 'uuid', nullable: true }) evento_id: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
}

// ─── Invoices (Brazilian notas fiscais) ───────────────────────────────────────
@Entity('invoices')
@Index(['tenant_id'])
@Index(['tenant_id', 'status'])
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true }) stripe_invoice_id: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) numero: string | null;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 50, default: InvoiceStatus.PENDING }) status: InvoiceStatus;
  @Column({ type: 'integer', nullable: true }) amount_due: number | null;
  @Column({ type: 'integer', nullable: true }) amount_paid: number | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) currency: string | null;
  @Column({ type: 'timestamp', nullable: true }) due_date: Date | null;
  @Column({ type: 'text', nullable: true }) hosted_invoice_url: string | null;
  @Column({ type: 'text', nullable: true }) invoice_pdf: string | null;
  @Column({ type: 'integer', default: 0 }) attempt_count: number;
  @Column({ type: 'uuid', nullable: true }) prestador_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) tomador_nome: string | null;
  @Column({ type: 'text', nullable: true }) tomador_doc_encrypted: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2 }) legacy_amount: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'timestamp', nullable: true }) data_emissao: Date | null;
  @Column({ type: 'timestamp', nullable: true }) data_vencimento: Date | null;
  @Column({ type: 'text', nullable: true }) arquivo_url: string | null;
  // ── Invoice form fields (1 column per field — exact name) ─────────────────────
  @Column({ type: 'varchar', length: 20, nullable: true }) serie: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) tipo_nota: string | null;
  @Column({ type: 'uuid', nullable: true }) client_id: string | null;
  @Column({ type: 'uuid', nullable: true }) venda_id: string | null;
  @Column({ type: 'text', nullable: true }) url_pdf: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) natureza_operacao: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) codigo_servico_municipal: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) codigo_municipio: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) cfop: string | null;
  @Column({ type: 'text', nullable: true }) service_description: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) tomador_cnpj: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) tomador_razao_social: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) tomador_inscricao_estadual: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) tomador_inscricao_municipal: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) tomador_email: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) tomador_address: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) tomador_city: string | null;
  @Column({ type: 'varchar', length: 5, nullable: true }) tomador_uf: string | null;
  @Column({ type: 'varchar', length: 15, nullable: true }) tomador_cep: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) service_amount: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) deductions_amount: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) base_calculo: string | null;
  @Column({ type: 'decimal', precision: 7, scale: 4, nullable: true }) aliquota_iss: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) iss_amount: string | null;
  @Column({ type: 'boolean', nullable: true }) iss_retido: boolean | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) pis_amount: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) cofins_amount: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) inss_amount: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) ir_amount: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) csll_amount: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) net_amount: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) forma_pagamento: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) condicao_pagamento: string | null;
  @Column({ type: 'jsonb', nullable: true }) itens: unknown[] | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
}

// ─── Clients ──────────────────────────────────────────────────────────────────
@Entity('clients')
@Index(['tenant_id'])
@Index(['tenant_id', 'status'])
export class ClientEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 50, default: 'pessoa_juridica' }) tipo_pessoa: string;
  @Column({ type: 'varchar', length: 100 }) categoria: string;
  @Column({ type: 'varchar', length: 100 }) perfil: string;
  @Column({ type: 'varchar', length: 255 }) nome: string;
  @Column({ type: 'text', nullable: true }) foto: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) individual_name: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) razao_social: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) trade_name: string | null;
  @Column({ type: 'text', nullable: true }) cpf_cnpj_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) email_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) telefone_encrypted: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) instagram: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) funcao: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) logradouro: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) numero: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) complemento: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) bairro: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) city: string | null;
  @Column({ type: 'varchar', length: 2, nullable: true }) state: string | null;
  @Column({ type: 'varchar', length: 15, nullable: true }) cep: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) endereco_completo: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) status_contato: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) prioridade_contato: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) responsavel_nome: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) responsavel_email: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) responsavel_telefone: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) responsavel_cargo: string | null;
  @Column({ type: 'jsonb', nullable: true }) attachments: unknown[] | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', nullable: true }) interacoes: unknown[] | null;
  @Column({ type: 'varchar', length: 50, default: ClientStatus.ACTIVE }) status: ClientStatus;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
}

// ─── Client Attachments ─────────────────────────────────────────────────────────
// Part 80: real attachment metadata (never the binary — only the object key
// in Cloudflare R2 via StorageService). Distinct from the legacy jsonb column
// `attachments` in ClientEntity (never populated by any real
// flow; kept untouched, it is not the source of truth from here on).
@Entity('client_attachments')
@Index(['tenant_id'])
@Index(['tenant_id', 'client_id'])
export class ClientAttachmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) client_id: string;
  @Column({ type: 'varchar', length: 500 }) storage_key: string;
  @Column({ type: 'varchar', length: 255 }) filename: string;
  @Column({ type: 'varchar', length: 150 }) mime_type: string;
  @Column({ type: 'bigint' }) size_bytes: number;
  @Column({ type: 'varchar', length: 128, nullable: true }) checksum: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) uploaded_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// ─── Leads ────────────────────────────────────────────────────────────────────
@Entity('leads')
@Index(['tenant_id'])
@Index(['tenant_id', 'status'])
@Index(['client_id'])
export class LeadEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) client_id: string | null;
  @Column({ type: 'varchar', length: 255 }) nome: string;
  @Column({ type: 'text', nullable: true }) email_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) telefone_encrypted: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) empresa: string | null;
  @Column({ type: 'varchar', length: 50, default: LeadStatus.NEW }) status: LeadStatus;
  @Column({ type: 'varchar', length: 100, nullable: true }) fonte: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;

  // ── Real operational columns (PHASE 2B — leads reconciliation) ────────────────
  // Physical names preserved EXACTLY as they exist in the database (camelCase and
  // snake_case coexist by decision of this phase; normalization is left for a future phase).
  @Column({ type: 'varchar', length: 255, nullable: true }) nome_completo: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) nome_artistico: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) whatsapp: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) instagram: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) city: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) state: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) country: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) client_type: string | null;
  // `tipo_servico`/`tipo_cliente` (this one, above) were translated to English
  // (`service_type`/`client_type`) by the naming-normalization mission.
  // `origem_lead`/`responsavel`/`prioridade`/`temperatura`/`estimated_value`/
  // `probabilidade_fechamento`/`proximo_follow_up` were a second, dead physical
  // storage location for concepts real usage always wrote into
  // `dados_internos_crm` (jsonb) -- dropped by naming-closure Cluster E
  // (20260921000005_DropDeadLeadsCrmDualStorageColumns; 0 non-null rows on
  // all 7 columns, live data confirmed exclusively on the jsonb side).
  @Column({ type: 'varchar', length: 120, nullable: true }) service_type: string | null;
  @Column({ type: 'jsonb', default: {} }) payload_servico: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) dados_internos_crm: Record<string, unknown>;
  @Column({ type: 'text', array: true, default: () => "'{}'" }) tags: string[];
  // Lead form field (2026-07-12 rule: 1 column per field)
  @Column({ type: 'jsonb', nullable: true }) uploads: unknown[] | null;

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @OneToMany(() => LeadInteractionEntity, (i) => i.lead)
  interactions: Relation<LeadInteractionEntity[]>;
}

// ─── Lead Interactions ────────────────────────────────────────────────────────
@Entity('lead_interactions')
@Index(['tenant_id'])
@Index(['lead_id'])
export class LeadInteractionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) lead_id: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) data: Date;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;

  // ── Relations ───────────────────────────────────────────────────────────────
  @ManyToOne(() => LeadEntity, (l) => l.interactions, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Relation<LeadEntity>;
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
@Entity('campaigns')
@Index(['tenant_id'])
export class CampaignEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 50, default: CampaignStatus.DRAFT }) status: CampaignStatus;
  @Column({ type: 'text', nullable: true }) objetivo: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) orcamento: string | null;
  @Column({ type: 'timestamp', nullable: true }) start_date: Date | null;
  @Column({ type: 'timestamp', nullable: true }) end_date: Date | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @OneToMany(() => BriefingEntity, (b) => b.campaign)
  briefings: Relation<BriefingEntity[]>;
}

// ─── Briefings ────────────────────────────────────────────────────────────────
@Entity('briefings')
@Index(['tenant_id'])
export class BriefingEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) content: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'uuid', nullable: true }) campaign_id: string | null;
  @Column({ type: 'varchar', length: 50, default: BriefingStatus.DRAFT }) status: BriefingStatus;
  @Column({ type: 'timestamp', nullable: true }) prazo: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @ManyToOne(() => CampaignEntity, (c) => c.briefings, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Relation<CampaignEntity> | null;
}

// ─── Events (Agenda) ──────────────────────────────────────────────────────────
@Entity('events')
@Index(['tenant_id'])
@Index(['tenant_id', 'data'])
export class EventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 50, default: EventStatus.SCHEDULED }) status: EventStatus;
  @Column({ type: 'timestamp' }) data: Date;
  // C3/E1 (migration 20260716000001): future canonical event start column.
  // Nullable until phase E5; dual-written with `data` from phase E2 onwards.
  @Column({ type: 'timestamp', nullable: true }) starts_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) local: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  // ── Event form fields (1 column per field — exact name) ───────────────────────
  @Column({ type: 'timestamp', nullable: true }) end_date: Date | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) endereco: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) contato_local: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) fee_amount: string | null;
  @Column({ type: 'integer', nullable: true }) publico_esperado: number | null;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'jsonb', nullable: true }) participantes: unknown[] | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
}

// ─── Projects ─────────────────────────────────────────────────────────────────
@Entity('projects')
@Index(['tenant_id'])
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  // Renamed from `nome` (migration ProjectsFormFieldAlignment20260718000013) —
  // `title` is the real and only name sent by the active form.
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 50, default: ProjectStatus.PLANNING }) status: ProjectStatus;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) orcamento: string | null;
  // `description` is pure free text again — musicas[] normalized into project_tracks.
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) music_genre: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;

  @OneToMany(() => ProjectTrackEntity, (t) => t.project)
  musicas_rel: Relation<ProjectTrackEntity[]>;
}

// ─── Project Tracks (migration 20260718000013) ────────────────────────────────
// Normalized child table for the tracks in development of a project
// (album/EP/single) — replaces the old JSON serialization inside
// `projects.descricao`.
@Entity('project_tracks')
@Index(['tenant_id', 'project_id'])
export class ProjectTrackEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) project_id: string;
  @Column({ type: 'varchar', length: 500 }) name: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) solo_feat: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) original_remix: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) instrumental: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) duracao_min: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) duracao_seg: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) music_genre: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) idioma: string | null;
  @Column({ type: 'text', nullable: true }) letra: string | null;
  @Column({ type: 'text', nullable: true }) audio_url: string | null;
  @Column({ type: 'integer', default: 0 }) sort_order: number;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;

  @ManyToOne(() => ProjectEntity, (p) => p.musicas_rel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Relation<ProjectEntity>;

  @OneToMany(() => ProjectTrackParticipantEntity, (pp) => pp.track)
  participantes: Relation<ProjectTrackParticipantEntity[]>;
}

// ─── Project Track Participants (migration 20260718000013) ────────────────────
// composers/performers/producers of a track — same structure (free-text
// name, no link to a registered artist), differing only by role.
@Entity('project_track_participants')
@Index(['tenant_id', 'project_track_id'])
export class ProjectTrackParticipantEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) project_track_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 20 }) role: 'compositor' | 'interprete' | 'produtor';
  @Column({ type: 'integer', default: 0 }) sort_order: number;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;

  @ManyToOne(() => ProjectTrackEntity, (t) => t.participantes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_track_id' })
  track: Relation<ProjectTrackEntity>;
}

// ─── Releases ─────────────────────────────────────────────────────────────────
@Entity('releases')
@Index(['tenant_id'])
@Index(['artist_id'])
export class ReleaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'varchar', length: 100, default: 'single' }) type: string;
  @Column({ type: 'varchar', length: 50, default: ReleaseStatus.DRAFT }) status: ReleaseStatus;
  @Column({ type: 'varchar', length: 255, nullable: true }) distribuidora: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) upc: string | null;
  @Column({ type: 'timestamp', nullable: true }) data_lancamento: Date | null;
  @Column({ type: 'jsonb', default: [] }) plataformas: unknown[];
  @Column({ type: 'text', nullable: true }) capa_url: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  // ── Release form fields (1 column per field — exact name) ─────────────────────
  @Column({ type: 'varchar', length: 50, nullable: true }) isrc_global: string | null;
  @Column({ type: 'text', nullable: true }) notas_internas: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) gravadora: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) copyright: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) music_genre: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) idioma: string | null;
  @Column({ type: 'jsonb', nullable: true }) assets: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) cronograma: Record<string, unknown> | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @ManyToOne(() => ArtistEntity, (a) => a.releases, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'artist_id' })
  artist: Relation<ArtistEntity> | null;

  @ManyToMany(() => WorkEntity, (w) => w.releases)
  @JoinTable({
    name: 'release_works',
    joinColumn:        { name: 'release_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'work_id',    referencedColumnName: 'id' },
  })
  works: Relation<WorkEntity[]>;
}

// ─── Shares ───────────────────────────────────────────────────────────────────
@Entity('shares')
@Index(['tenant_id'])
@Index(['work_id'])
export class ShareEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) work_id: string | null;
  @Column({ type: 'uuid', nullable: true }) phonogram_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) holder_name: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) holder_document: string | null;
  @Column({ type: 'varchar', length: 100, default: 'autor' }) party_role: string;
  @Column({ type: 'decimal', precision: 7, scale: 4, nullable: true }) percentage: string | null;
  @Column({ type: 'varchar', length: 50, default: ShareStatus.ACTIVE }) status: ShareStatus;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;

  // ── Registry fields (migration 20260601000001_RegistryFieldsPhase1) ──────────
  @Column({ type: 'uuid', nullable: true }) rights_holder_id: string | null;
  @Column({ type: 'uuid', nullable: true }) publisher_id: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) role: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) territory: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) instrument: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) credited_name: string | null;
  @Column({ type: 'boolean', nullable: true }) is_primary: boolean | null;
  @Column({ type: 'boolean', nullable: true }) is_featured: boolean | null;
  @Column({ type: 'timestamp', nullable: true }) start_date: Date | null;
  @Column({ type: 'timestamp', nullable: true }) end_date: Date | null;

  // ── Share form fields (1 column per field — exact name) ───────────────────────
  @Column({ type: 'varchar', length: 30, nullable: true }) share_type: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) direction: string | null;
  @Column({ type: 'uuid', nullable: true }) release_id: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) music_title: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) holder: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) recipient: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) type: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) artista_externo: string | null;
  @Column({ type: 'uuid', nullable: true }) artista_project_id: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) pagador: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) pagador_contato: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) origem_acordo: string | null;
  @Column({ type: 'date', nullable: true }) data_prevista: string | null;
  @Column({ type: 'text', nullable: true }) documents: string | null;
  @Column({ type: 'text', nullable: true }) acordo_notas: string | null;
  @Column({ type: 'text', nullable: true }) acordo_url: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'integer', nullable: true }) versao: number | null;
  @Column({ type: 'jsonb', nullable: true }) historico: unknown[] | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) total_amount: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) settled_amount: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @ManyToOne(() => WorkEntity, (w) => w.shares, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'work_id' })
  work: Relation<WorkEntity> | null;
}

// ─── Takedowns ────────────────────────────────────────────────────────────────
@Entity('takedowns')
@Index(['tenant_id'])
@Index(['tenant_id', 'status'])
export class TakedownEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'varchar', length: 100 }) plataforma: string;
  @Column({ type: 'text', nullable: true }) url: string | null;
  @Column({ type: 'varchar', length: 50, default: TakedownStatus.PENDING }) status: TakedownStatus;
  @Column({ type: 'uuid', nullable: true }) work_id: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'text', nullable: true }) motivo: string | null;
  @Column({ type: 'text', nullable: true }) resposta: string | null;
  // ── Takedown form fields (1 column per field — exact name) ────────────────────
  @Column({ type: 'varchar', length: 30, nullable: true }) type: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) obra_afetada: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) artista: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) prioridade: string | null;
  @Column({ type: 'text', nullable: true }) url_infracao: string | null;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'text', nullable: true }) evidencias: string | null;
  @Column({ type: 'date', nullable: true }) data_identificacao: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
}

// ─── Support Tickets ──────────────────────────────────────────────────────────
@Entity('support_tickets')
@Index(['tenant_id'])
@Index(['status'])
export class SupportTicketEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 50, unique: true }) ticket_number: string;
  @Column({ type: 'varchar', length: 500 }) subject: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 50, default: SupportTicketStatus.OPEN }) status: SupportTicketStatus;
  @Column({ type: 'varchar', length: 50, default: SupportTicketPriority.MEDIUM }) priority: SupportTicketPriority;
  @Column({ type: 'varchar', length: 100, nullable: true }) category: string | null;
  @Column({ type: 'varchar', length: 255 }) created_by: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) assigned_to: string | null;
  @Column({ type: 'timestamp', nullable: true }) sla_deadline: Date | null;
  @Column({ type: 'timestamp', nullable: true }) resolved_at: Date | null;
  @Column({ type: 'jsonb', default: [] }) tags: unknown[];
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// GAP-04 (product-completion audit): thread of replies on a support ticket.
// Matches the frontend's SupportMessage contract exactly
// (apps/web/src/modules/support/types/index.ts).
@Entity('support_ticket_messages')
@Index(['tenant_id'])
@Index(['tenant_id', 'ticket_id'])
export class SupportTicketMessageEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) ticket_id: string;
  @Column({ type: 'varchar', length: 255 }) sender_id: string;
  @Column({ type: 'varchar', length: 255 }) sender_name: string;
  @Column({ type: 'varchar', length: 20, default: 'support' }) sender_role: 'user' | 'support' | 'admin';
  @Column({ type: 'text' }) message: string;
  @Column({ type: 'boolean', default: false }) internal_note: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

// GAP-05c (product-completion audit): feature-request/voting board.
// Matches the frontend's SupportRequest contract exactly
// (apps/web/src/modules/support/types/index.ts). Votes is a plain atomic
// counter — the frontend's own "voted" state is client-side-only (resets on
// reload, never persisted), so no per-user vote-uniqueness table is specified.
@Entity('support_requests')
@Index(['tenant_id'])
export class SupportRequestEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 20 }) type: 'feature' | 'bug' | 'question' | 'billing' | 'integration';
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', default: '' }) description: string;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: 'pending' | 'in_review' | 'approved' | 'done' | 'rejected';
  @Column({ type: 'varchar', length: 20, default: 'medium' }) priority: string;
  @Column({ type: 'int', default: 0 }) votes: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// ─── Knowledge Base (Support Center) ──────────────────────────────────────────
// Global content (not tenant-scoped) — Music OS 360 writes the platform
// documentation once, every tenant reads it. See 20260822000003_CreateKnowledgeBase.
@Entity('knowledge_categories')
export class KnowledgeCategoryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 80 }) slug: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 60, nullable: true }) icon: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) color: string | null;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

@Entity('knowledge_articles')
export class KnowledgeArticleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) category_id: string;
  @Column({ type: 'varchar', length: 300 }) title: string;
  @Column({ type: 'text', default: '' }) summary: string;
  @Column({ type: 'text', default: '' }) content: string;
  @Column({ type: 'varchar', length: 20, default: 'article' }) type: 'article' | 'faq' | 'tutorial' | 'internal_doc';
  @Column({ type: 'varchar', length: 20, default: 'draft' }) status: 'draft' | 'published' | 'archived';
  @Column({ type: 'boolean', default: false }) featured: boolean;
  @Column({ type: 'int', default: 0 }) views: number;
  @Column({ type: 'int', default: 0 }) helpful_count: number;
  @Column({ type: 'int', default: 1 }) read_time: number;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// ─── Notifications ────────────────────────────────────────────────────────────
@Entity('notifications')
@Index(['tenant_id', 'user_id'])
@Index(['tenant_id', 'user_id', 'read_at'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) user_id: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) body: string | null;
  /** Notification type — may be the generic enum (NotificationType) or an event identifier (e.g. 'contract:expiring') */
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) entity: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) entity_id: string | null;
  @Column({ type: 'timestamp', nullable: true }) read_at: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Notification settings (per-tenant, per-key) ──────────────────────────────
@Entity('notification_settings')
@Index(['tenant_id'])
@Index(['tenant_id', 'notification_key'], { unique: true })
export class NotificationSettingEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 100 }) notification_key: string;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @Column({ type: 'jsonb', default: {} }) config_json: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

// ─── Uploads ──────────────────────────────────────────────────────────────────
@Entity('uploads')
@Index(['tenant_id'])
@Index(['file_id'], { unique: true })
@Index(['entity', 'entity_id'])
export class UploadEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) user_id: string;
  @Column({ type: 'varchar', length: 255, unique: true }) file_id: string;
  @Column({ type: 'varchar', length: 500 }) original_name: string;
  @Column({ type: 'varchar', length: 255 }) mime_type: string;
  @Column({ type: 'integer' }) size_bytes: number;
  @Column({ type: 'text' }) r2_key: string;
  @Column({ type: 'varchar', length: 50 }) category: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) entity: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) entity_id: string | null;
  @Column({ type: 'varchar', length: 50, default: UploadStatus.PENDING }) status: UploadStatus;
  @Column({ type: 'timestamp', nullable: true }) confirmed_at: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// ─── Integrations ─────────────────────────────────────────────────────────────
@Entity('integrations')
@Index(['tenant_id', 'provider'], { unique: true })
export class IntegrationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 100 }) provider: string;
  @Column({ type: 'varchar', length: 50, default: IntegrationStatus.DISCONNECTED }) status: IntegrationStatus;
  @Column({ type: 'text', nullable: true }) credentials_encrypted: string | null;
  @Column({ type: 'jsonb', default: {} }) settings: Record<string, unknown>;
  @Column({ type: 'timestamp', nullable: true }) last_sync_at: Date | null;
  @Column({ type: 'integer', default: 0 }) failure_count: number;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// ─── OAuth Connections ────────────────────────────────────────────────────────
@Entity('oauth_connections')
@Index(['tenant_id', 'user_id', 'provider'], { unique: true })
@Index(['tenant_id'])
export class OAuthConnectionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) user_id: string;
  @Column({ type: 'varchar', length: 100 }) provider: string;
  @Column({ type: 'text' }) access_token_encrypted: string;
  @Column({ type: 'text', nullable: true }) refresh_token_encrypted: string | null;
  @Column({ type: 'timestamp', nullable: true }) expires_at: Date | null;
  @Column({ type: 'text', nullable: true }) scopes: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
}

// ─── Webhook Events ───────────────────────────────────────────────────────────
@Entity('webhook_events')
@Index(['provider', 'event_type'])
@Index(['status'])
export class WebhookEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenant_id: string | null;
  @Column({ type: 'varchar', length: 100 }) provider: string;
  @Column({ type: 'varchar', length: 100 }) event_type: string;
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true }) external_id: string | null;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ type: 'varchar', length: 50, default: WebhookEventStatus.PENDING }) status: WebhookEventStatus;
  @Column({ type: 'timestamp', nullable: true }) processed_at: Date | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'integer', default: 0 }) retry_count: number;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Operational List Items ─────────────────────────────────────────────────────
/**
 * find-9a9fb661 / find-e59566ca: `OperationalListsService` already imported
 * this entity (mismatched against nothing — it never existed), against a
 * real, RLS-scoped table already created by migration
 * `20260713000001_CreateOperationalListItems`. Everything else (controller,
 * service, DTOs, seed bootstrap, tests) was already built — only this
 * entity class and the module registration in `app.module.ts` were missing.
 */
@Entity('operational_list_items')
@Index(['tenant_id', 'kind', 'order'])
export class OperationalListItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 50 }) kind: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'varchar', length: 100 }) slug: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'integer', default: 0 }) order: number;
  @Column({ type: 'varchar', length: 100, nullable: true }) group: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

// ─── External Data Submissions ─────────────────────────────────────────────────
/**
 * find-bc7c20a6: server-side reverse lookup from (provider, submission_id) to
 * the tenant/entity that made the submission. `ExternalDataExchangeService
 * .ingestWebhook` resolves tenant scoping from THIS table, never from the
 * caller-supplied X-Tenant-ID header — the HMAC signature on a webhook only
 * proves the payload came from a holder of the shared per-provider secret,
 * it proves nothing about which tenant it belongs to.
 */
@Entity('external_data_submissions')
@Index(['provider', 'submission_id', 'entity_type', 'entity_id'], { unique: true })
@Index(['provider', 'submission_id'])
@Index(['tenant_id'])
export class ExternalDataSubmissionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 100 }) provider: string;
  @Column({ type: 'varchar', length: 30 }) entity_type: string;
  @Column({ type: 'uuid' }) entity_id: string;
  @Column({ type: 'varchar', length: 255 }) submission_id: string;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
/** Append-only — no soft-delete, no update */
@Entity('audit_logs')
@Index(['tenant_id'])
@Index(['tenant_id', 'entity'])
@Index(['tenant_id', 'entity', 'entity_id'])
@Index(['user_id'])
@Index(['created_at'])
@Index(['correlation_id'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** Tenant isolation — mandatory for all non-system events */
  @Column({ type: 'uuid', nullable: true }) tenant_id: string | null;
  /** Organisation owning this tenant (billing boundary) */
  @Column({ type: 'uuid', nullable: true }) org_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) user_id: string | null;
  /** Actor role at the time of the action (OWNER, ADMIN, EDITOR, …) */
  @Column({ type: 'varchar', length: 50, nullable: true }) actor_role: string | null;
  @Column({ type: 'varchar', length: 100 }) action: string;
  @Column({ type: 'varchar', length: 100 }) entity: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) entity_id: string | null;
  /** Snapshot before mutation */
  @Column({ type: 'jsonb', nullable: true }) before: Record<string, unknown> | null;
  /** Snapshot after mutation */
  @Column({ type: 'jsonb', nullable: true }) after: Record<string, unknown> | null;
  /** Only the fields that actually changed (subset of before/after) */
  @Column({ type: 'jsonb', nullable: true }) diff: Record<string, unknown> | null;
  @Column({ type: 'varchar', length: 45, nullable: true }) ip_address: string | null;
  @Column({ type: 'text', nullable: true }) user_agent: string | null;
  /** Matches request_id / X-Request-Id header */
  @Column({ type: 'varchar', length: 255, nullable: true }) request_id: string | null;
  /** From AsyncLocalStorage — links to domain event correlation_id */
  @Column({ type: 'varchar', length: 255, nullable: true }) correlation_id: string | null;
  /** Browser/client session identifier if provided */
  @Column({ type: 'varchar', length: 255, nullable: true }) session_id: string | null;
  /** HTTP method of the originating request */
  @Column({ type: 'varchar', length: 10, nullable: true }) http_method: string | null;
  /** HTTP path of the originating request */
  @Column({ type: 'text', nullable: true }) http_path: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── AI Jobs ──────────────────────────────────────────────────────────────────
@Entity('ai_jobs')
@Index(['tenant_id'])
@Index(['created_at'])
export class AIJobEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) user_id: string;
  @Column({ type: 'varchar', length: 50 }) provider: string;
  @Column({ type: 'varchar', length: 100 }) model: string;
  @Column({ type: 'varchar', length: 100 }) skill: string;
  @Column({ type: 'varchar', length: 50, default: AIJobStatus.PENDING }) status: AIJobStatus;
  @Column({ type: 'integer', default: 0 }) input_tokens: number;
  @Column({ type: 'integer', default: 0 }) output_tokens: number;
  @Column({ type: 'decimal', precision: 12, scale: 8, default: '0' }) cost_usd: string;
  @Column({ type: 'integer', nullable: true }) latency_ms: number | null;
  @Column({ type: 'timestamp', nullable: true }) completed_at: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Artist Goals ─────────────────────────────────────────────────────────────
@Entity('artist_goals')
@Index(['tenant_id'])
@Index(['artist_id'])
export class ArtistGoalEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) artist_id: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) target_value: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, default: '0' }) current_value: string;
  @Column({ type: 'varchar', length: 50, default: ArtistGoalStatus.IN_PROGRESS }) status: ArtistGoalStatus;
  @Column({ type: 'varchar', length: 50, default: 'mensal' }) periodo: string;
  @Column({ type: 'timestamp', nullable: true }) start_date: Date | null;
  @Column({ type: 'timestamp', nullable: true }) end_date: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
}

// ─── Content Detections ───────────────────────────────────────────────────────
@Entity('content_detections')
@Index(['tenant_id'])
@Index(['status'])
export class ContentDetectionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) work_id: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'varchar', length: 100 }) plataforma: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) titulo_detectado: string | null;
  @Column({ type: 'text', nullable: true }) url: string | null;
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true }) score: string | null;
  @Column({ type: 'varchar', length: 50, default: ContentDetectionStatus.PENDING }) status: ContentDetectionStatus;
  @Column({ type: 'varchar', length: 100, default: 'uso_nao_autorizado' }) type: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) detectado_em: Date;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

// ─── ECAD Reports ─────────────────────────────────────────────────────────────
@Entity('ecad_reports')
@Index(['tenant_id'])
@Index(['periodo'])
export class EcadReportEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) work_id: string | null;
  @Column({ type: 'varchar', length: 20 }) periodo: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) gross_amount: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) net_amount: string | null;
  @Column({ type: 'varchar', length: 50, default: EcadReportStatus.PENDENTE }) status: EcadReportStatus;
  @Column({ type: 'text', nullable: true }) arquivo_url: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
}

// ─── Employees ────────────────────────────────────────────────────────────────
@Entity('employees')
@Index(['tenant_id'])
@Index(['status'])
export class EmployeeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) cargo: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) departamento: string | null;
  @Column({ type: 'varchar', length: 100, default: 'clt' }) tipo_contrato: string;
  @Column({ type: 'varchar', length: 50, default: EmployeeStatus.ACTIVE }) status: EmployeeStatus;
  @Column({ type: 'text', nullable: true }) email_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) telefone_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) cpf_encrypted: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) salario: string | null;
  @Column({ type: 'timestamp', nullable: true }) data_admissao: Date | null;
  @Column({ type: 'timestamp', nullable: true }) data_demissao: Date | null;
  @Column({ type: 'jsonb', default: [] }) documents: unknown[];
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  @OneToMany(() => PayrollEntryEntity, (p) => p.employee)
  payroll_entries: Relation<PayrollEntryEntity[]>;

  @OneToMany(() => LeaveRequestEntity, (l) => l.employee)
  leave_requests: Relation<LeaveRequestEntity[]>;
}

// ─── Payroll Entries ──────────────────────────────────────────────────────────
@Entity('payroll_entries')
@Index(['tenant_id'])
@Index(['employee_id'])
@Index(['employee_id', 'competencia'], { unique: true })
export class PayrollEntryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) employee_id: string;
  @Column({ type: 'varchar', length: 7 }) competencia: string;
  @Column({ type: 'decimal', precision: 15, scale: 2 }) salario_bruto: string;
  @Column({ type: 'decimal', precision: 15, scale: 2, default: '0' }) descontos: string;
  @Column({ type: 'decimal', precision: 15, scale: 2 }) salario_liquido: string;
  @Column({ type: 'varchar', length: 50, default: PayrollStatus.PENDING }) status: PayrollStatus;
  @Column({ type: 'text', nullable: true }) arquivo_url: string | null;
  @Column({ type: 'timestamp', nullable: true }) pago_em: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  // Physical FK = fk_payroll_entries_employee_id ON DELETE RESTRICT (PHASE 2C.1):
  // preserves financial/HR history — does not cascade an employee deletion.
  @ManyToOne(() => EmployeeEntity, (e) => e.payroll_entries, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: Relation<EmployeeEntity>;
}

// ─── Leave Requests ────────────────────────────────────────────────────────────
@Entity('leave_requests')
@Index(['tenant_id'])
@Index(['employee_id'])
export class LeaveRequestEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) employee_id: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 50, default: LeaveRequestStatus.PENDING }) status: LeaveRequestStatus;
  @Column({ type: 'timestamp' }) start_date: Date;
  @Column({ type: 'timestamp' }) end_date: Date;
  @Column({ type: 'text', nullable: true }) motivo: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) aprovado_por: string | null;
  @Column({ type: 'text', nullable: true }) documento_url: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;

  // ── Relations ───────────────────────────────────────────────────────────────
  // Physical FK = fk_leave_requests_employee_id ON DELETE RESTRICT (PHASE 2C.1):
  // preserves operational/HR history — does not cascade an employee deletion.
  @ManyToOne(() => EmployeeEntity, (e) => e.leave_requests, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: Relation<EmployeeEntity>;
}

// ─── Workflow Transitions (state transition history) ──────────────────────────
@Entity('workflow_transitions')
@Index(['tenant_id', 'entity_type', 'entity_id'])
@Index(['tenant_id'])
export class WorkflowTransitionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 100 }) entity_type: string;
  @Column({ type: 'uuid' }) entity_id: string;
  @Column({ type: 'varchar', length: 100 }) from_status: string;
  @Column({ type: 'varchar', length: 100 }) to_status: string;
  @Column({ type: 'varchar', length: 255 }) actor_id: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) actor_role: string | null;
  @Column({ type: 'text', nullable: true }) reason: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Domain Event Log (append-only audit of domain events) ───────────────────
/** Append-only — records every domain event emitted in the system. */
@Entity('domain_event_log')
@Index(['tenant_id'])
@Index(['tenant_id', 'event_type'])
@Index(['correlation_id'])
@Index(['occurred_at'])
@Index(['aggregate_type', 'aggregate_id'])
export class DomainEventLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenant_id: string | null;
  @Column({ type: 'varchar', length: 100 }) event_type: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) aggregate_type: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) aggregate_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) actor_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) correlation_id: string | null;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) occurred_at: Date;
  @Column({ type: 'timestamp', nullable: true }) processed_at: Date | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Activity Logs ───────────────────────────────────────────────────────────
@Entity('activity_logs')
@Index(['tenant_id'])
@Index(['entity_type', 'entity_id'])
export class ActivityLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'varchar', length: 50 })
  entity_type: string;

  @Column({ type: 'uuid' })
  entity_id: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255 })
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_name: string | null;

  @Column({ type: 'text', nullable: true })
  user_avatar_url: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

// ─── Conversations ────────────────────────────────────────────────────────────
// Unions mirroring the native PostgreSQL enums (no DDL is generated — only a
// faithful representation of the existing schema).
export type ConversationStatus = 'open' | 'pending' | 'closed' | 'spam';
export type ConversationChannel =
  | 'internal' | 'email' | 'whatsapp' | 'telegram' | 'instagram'
  | 'sms' | 'discord' | 'facebook' | 'tiktok' | 'custom';
export type MessageSenderType = 'user' | 'contact' | 'system' | 'ai';
export type FormStatus = 'draft' | 'active' | 'archived';

@Entity('conversations')
@Index(['tenant_id', 'status'])
@Index(['assigned_to'])
@Index(['contact_id'])
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) contact_id: string | null;
  @Column({ type: 'text', default: '' }) subject: string;
  // Native database types (enum). enumName points to the existing type; no DDL
  // (synchronize=false) — it only reflects the real schema for correct reads/writes.
  @Column({ type: 'enum', enum: ['open', 'pending', 'closed', 'spam'], enumName: 'conversation_status', default: 'open' })
  status: string;
  @Column({ type: 'enum', enum: ['internal', 'email', 'whatsapp', 'telegram', 'instagram', 'sms', 'discord', 'facebook', 'tiktok', 'custom'], enumName: 'conversation_channel', default: 'internal' })
  channel: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) assigned_to: string | null;
  @Column({ type: 'timestamptz', nullable: true }) last_message_at: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;

  @OneToMany(() => ConversationMessageEntity, (m) => m.conversation)
  messages: Relation<ConversationMessageEntity[]>;

  @OneToMany(() => ConversationNoteEntity, (n) => n.conversation)
  notes: Relation<ConversationNoteEntity[]>;
}

@Entity('conversation_messages')
@Index(['conversation_id', 'created_at'])
@Index(['tenant_id'])
export class ConversationMessageEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) conversation_id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'text', default: '' }) body: string;
  @Column({ type: 'varchar', length: 255 }) sender_id: string;
  @Column({ type: 'enum', enum: ['user', 'contact', 'system', 'ai'], enumName: 'message_sender_type', default: 'user' })
  sender_type: string;
  @Column({ type: 'jsonb', default: [] }) attachments: unknown[];
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;

  @ManyToOne(() => ConversationEntity, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Relation<ConversationEntity>;
}

@Entity('conversation_notes')
@Index(['conversation_id', 'created_at'])
export class ConversationNoteEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) conversation_id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'text', default: '' }) body: string;
  @Column({ type: 'varchar', length: 255 }) author_id: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;

  @ManyToOne(() => ConversationEntity, (c) => c.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Relation<ConversationEntity>;
}

// Internal Chat (team <-> team) — architecturally isolated from the Service
// Center (ConversationEntity/ConversationMessageEntity above, team <->
// external public): its own entities, participant identity (org_members, no
// phone/external channel) and authorization. Never reuse the
// `conversations`/`conversation_messages` tables for this domain.
@Entity('internal_conversations')
@Index(['tenant_id'])
export class InternalConversationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) org_id: string;
  @Column({ type: 'enum', enum: ['direct', 'group'], enumName: 'internal_conversation_type', default: 'direct' })
  type: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) name: string | null;
  @Column({ type: 'varchar', length: 255 }) created_by: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;

  @OneToMany(() => InternalConversationParticipantEntity, (p) => p.conversation)
  participants: Relation<InternalConversationParticipantEntity[]>;

  @OneToMany(() => InternalMessageEntity, (m) => m.conversation)
  messages: Relation<InternalMessageEntity[]>;
}

@Entity('internal_conversation_participants')
@Index(['conversation_id', 'auth_user_id'], { unique: true })
@Index(['tenant_id', 'auth_user_id'])
export class InternalConversationParticipantEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) conversation_id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) auth_user_id: string;
  @CreateDateColumn({ type: 'timestamptz' }) joined_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) last_read_at: Date | null;

  @ManyToOne(() => InternalConversationEntity, (c) => c.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Relation<InternalConversationEntity>;
}

@Entity('internal_messages')
@Index(['conversation_id', 'created_at'])
@Index(['tenant_id'])
export class InternalMessageEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) conversation_id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) sender_auth_user_id: string;
  @Column({ type: 'text', default: '' }) body: string;
  @Column({ type: 'jsonb', default: [] }) attachments: unknown[];
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) edited_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;

  @ManyToOne(() => InternalConversationEntity, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Relation<InternalConversationEntity>;
}

@Entity('musicchat_automation_settings')
@Index(['tenant_id'], { unique: true })
export class MusicChatAutomationSettingsEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @Column({ type: 'text' }) welcome_message: string;
  @Column({ type: 'text' }) main_menu_message: string;
  @Column({ type: 'jsonb', default: [] }) menu_options: unknown[];
  @Column({ type: 'jsonb', default: [] }) templates: unknown[];
  @Column({ type: 'jsonb', default: [] }) required_fields: unknown[];
  @Column({ type: 'jsonb', default: [] }) optional_fields: unknown[];
  @Column({ type: 'text' }) invalid_option_message: string;
  @Column({ type: 'text' }) absence_message: string;
  @Column({ type: 'text' }) out_of_hours_message: string;
  @Column({ type: 'text' }) closing_message: string;
  @Column({ type: 'jsonb', default: {} }) return_to_menu_rule: Record<string, unknown>;
  @Column({ type: 'jsonb', default: [] }) escalation_rules: unknown[];
  @Column({ type: 'jsonb', default: {} }) notification_channels: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) supervisor_user_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) manager_user_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('musicchat_automation_events')
@Index(['tenant_id', 'conversation_id', 'created_at'])
@Index(['tenant_id', 'event_type'])
export class MusicChatAutomationEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) conversation_id: string | null;
  @Column({ type: 'varchar', length: 100 }) event_type: string;
  @Column({ type: 'text', nullable: true }) summary: string | null;
  @Column({ type: 'jsonb', default: {} }) payload: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) actor_id: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('musicchat_automation_notifications')
@Index(['tenant_id', 'conversation_id', 'level'], { unique: true })
@Index(['tenant_id', 'status'])
export class MusicChatAutomationNotificationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) conversation_id: string;
  @Column({ type: 'varchar', length: 50 }) level: string;
  @Column({ type: 'varchar', length: 50 }) channel: string;
  @Column({ type: 'varchar', length: 255 }) recipient_user_id: string;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) body: string | null;
  @Column({ type: 'varchar', length: 50, default: 'pending' }) status: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

// ─── Forms & Submissions ──────────────────────────────────────────────────────
// FormEntity/FormSubmissionEntity (forms/form_submissions) removed by
// DropGenericFormsModule20260822000005 — product decision (2026-08-22):
// no generic Form Builder. Zero approved consumers (artist
// acquisition uses the Artist Public Form; support uses Support Ticket). Tables
// dropped; MusicChat's conversations/conversation_messages/conversation_notes,
// created in the same original migration, were preserved.

// ─── CRM Canonical (Phase 7) ──────────────────────────────────────────────────
// crm_companies/crm_contacts/crm_tags/crm_contact_tags/crm_timeline_events were
// removed by RemoveDeadCrmClusterD1D8 (0 rows, replaced by contacts/leads).

// Compatibility class name retained while the persisted model is now the
// domain-neutral operational task queue. CRM itself is contacts/leads based.
@Entity('operational_tasks')
@Index(['tenant_id', 'contact_id'])
@Index(['tenant_id', 'due_date'])
@Index(['assigned_to'])
export class CrmTaskEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 50, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 50, default: 'medium' }) priority: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) type: string | null;
  @Column({ type: 'uuid', nullable: true }) contact_id: string | null;
  @Column({ type: 'uuid', nullable: true }) company_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) assigned_to: string | null;
  @Column({ type: 'timestamptz', nullable: true }) due_date: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;

}

// ─── Music Pipelines (Phase 8) ────────────────────────────────────────────────

@Entity('pipelines')
@Index(['tenant_id'])
export class PipelineEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 100, default: 'sales' }) type: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;

  @OneToMany(() => PipelineStageEntity, (s) => s.pipeline)
  stages: Relation<PipelineStageEntity[]>;

  @OneToMany(() => PipelineOpportunityEntity, (o) => o.pipeline)
  opportunities: Relation<PipelineOpportunityEntity[]>;
}

@Entity('pipeline_stages')
@Index(['pipeline_id', 'position'])
@Index(['tenant_id'])
export class PipelineStageEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) pipeline_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'integer', default: 0 }) position: number;
  @Column({ type: 'varchar', length: 50, default: '#6366f1' }) color: string;
  @Column({ type: 'integer', nullable: true }) sla_days: number | null;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) win_probability: string | null;
  @Column({ type: 'boolean', default: false }) is_terminal: boolean;
  @Column({ type: 'boolean', default: false }) is_won: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;

  @ManyToOne(() => PipelineEntity, (p) => p.stages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pipeline_id' })
  pipeline: Relation<PipelineEntity>;

  @OneToMany(() => PipelineOpportunityEntity, (o) => o.stage)
  opportunities: Relation<PipelineOpportunityEntity[]>;
}

@Entity('pipeline_opportunities')
@Index(['tenant_id', 'pipeline_id'])
@Index(['tenant_id', 'stage_id'])
@Index(['tenant_id', 'contact_id'])
@Index(['tenant_id', 'deleted_at'])
export class PipelineOpportunityEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) pipeline_id: string;
  @Column({ type: 'uuid', nullable: true }) stage_id: string | null;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'uuid', nullable: true }) contact_id: string | null;
  @Column({ type: 'uuid', nullable: true }) company_id: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) value: string | null;
  @Column({ type: 'varchar', length: 50, default: 'open' }) status: string;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) probability: string | null;
  @Column({ type: 'timestamptz', nullable: true }) expected_close_date: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) actual_close_date: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) sla_due_at: Date | null;
  @Column({ type: 'boolean', default: false }) sla_breached: boolean;
  @Column({ type: 'varchar', length: 255, nullable: true }) assigned_to: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', default: [] }) stage_history: unknown[];
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;

  @ManyToOne(() => PipelineEntity, (p) => p.opportunities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pipeline_id' })
  pipeline: Relation<PipelineEntity>;

  @ManyToOne(() => PipelineStageEntity, (s) => s.opportunities, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stage_id' })
  stage: Relation<PipelineStageEntity> | null;
}

// ─── Campaign Operations (Phase 11) ───────────────────────────────────────────

@Entity('campaign_tasks')
@Index(['tenant_id', 'campaign_id'])
@Index(['tenant_id', 'due_date'])
@Index(['assigned_to'])
export class CampaignTaskEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) campaign_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 50, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 50, default: 'medium' }) priority: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) assigned_to: string | null;
  @Column({ type: 'timestamptz', nullable: true }) due_date: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;

  @ManyToOne(() => CampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Relation<CampaignEntity>;
}

@Entity('campaign_assets')
@Index(['tenant_id', 'campaign_id'])
export class CampaignAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) campaign_id: string;
  @Column({ type: 'varchar', length: 500 }) name: string;
  @Column({ type: 'varchar', length: 100 }) asset_type: string;
  @Column({ type: 'text' }) file_url: string;
  @Column({ type: 'bigint', nullable: true }) file_size: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) mime_type: string | null;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;

  @ManyToOne(() => CampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Relation<CampaignEntity>;
}

// ─── Analytics & AI Governance (Phase 13) ────────────────────────────────────

@Entity('ai_usage_logs')
@Index(['tenant_id', 'created_at'])
@Index(['tenant_id', 'model'])
@Index(['job_id'])
export class AiUsageLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) job_id: string | null;
  @Column({ type: 'varchar', length: 255 }) model: string;
  @Column({ type: 'varchar', length: 100 }) feature: string;
  @Column({ type: 'integer', default: 0 }) tokens_input: number;
  @Column({ type: 'integer', default: 0 }) tokens_output: number;
  @Column({ type: 'decimal', precision: 12, scale: 6, default: 0 }) cost_usd: string;
  @Column({ type: 'integer', nullable: true }) latency_ms: number | null;
  @Column({ type: 'varchar', length: 50, default: 'success' }) outcome: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) user_id: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

// ─── Inventory ────────────────────────────────────────────────────────────────
@Entity('inventory_items')
@Index(['tenant_id', 'category'])
@Index(['tenant_id', 'status'])
export class InventoryItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) category: string | null;
  @Column({ type: 'integer', default: 0 }) quantidade: number;
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true }) unit_price: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) localizacao: string | null;
  @Column({ type: 'varchar', length: 50, default: 'disponivel' }) status: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) responsavel: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) setor: string | null;
  @Column({ type: 'date', nullable: true }) data_entrada: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) local_compra: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) numero_nota_fiscal: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

// ─── Licensing ────────────────────────────────────────────────────────────────
@Entity('licenses')
@Index(['tenant_id', 'status'])
@Index(['tenant_id', 'work_id'])
export class LicenseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'uuid', nullable: true }) work_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) obra_musical: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) artista: string | null;
  @Column({ type: 'uuid', nullable: true }) client_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) cliente: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) projeto: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) type: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) tipo_uso: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) midia_destino: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) territorio: string | null;
  @Column({ type: 'varchar', length: 50, default: 'pendente' }) status: string;
  @Column({ type: 'date', nullable: true }) start_date: string | null;
  @Column({ type: 'date', nullable: true }) end_date: string | null;
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true }) valor: string | null;
  @Column({ type: 'varchar', length: 10, default: 'BRL' }) moeda: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  // License form fields (2026-07-12 rule: 1 column per field)
  @Column({ type: 'varchar', length: 50, nullable: true }) remuneration_type: string | null;
  @Column({ type: 'decimal', precision: 7, scale: 4, nullable: true }) percentage: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

// ─── Financial Rules ──────────────────────────────────────────────────────────
@Entity('financial_rules')
@Index(['tenant_id', 'type'])
@Index(['tenant_id', 'active'])
export class FinancialRuleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 100 }) type: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) category: string | null;
  @Column({ type: 'varchar', length: 50, default: 'percentual' }) calculo: string;
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 }) value: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'jsonb', default: {} }) condicoes: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

// ─── Finance Category Keyword Rules ────────────────────────────────────────────
// Note: "financial_category_rules" ALREADY EXISTS (migration 20260526000003) as a
// dynamic taxonomy table seeded per tenant — a completely different schema and purpose
// (transaction_type/counterparty_type/category/subcategory), with no
// live service/controller. To avoid colliding, this table of automatic
// keyword categorization rules uses its own name.
@Entity('finance_category_keyword_rules')
@Index(['tenant_id', 'active'])
@Index(['tenant_id', 'transaction_type'])
export class FinanceCategoryKeywordRuleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'text', array: true, default: () => "'{}'" }) keywords: string[];
  @Column({ type: 'varchar', length: 20 }) transaction_type: string;
  @Column({ type: 'uuid' }) category_id: string;
  @Column({ type: 'int', default: 100 }) priority: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

// ─── Skills runtime (skill_runs / skill_run_logs) ─────────────────────────────
// Tables created by migration 20260607000001_SkillsAndCentralAssets.
// Entities added so SkillRunService gets real repositories.

@Entity('skill_runs')
export class SkillRunEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) user_id: string | null;
  @Column({ type: 'varchar', length: 100 }) skill_name: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) entity_type: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) entity_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) correlation_id: string | null;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @Column({ type: 'jsonb', default: {} }) input_payload: Record<string, unknown>;
  @Column({ type: 'jsonb', nullable: true }) output_payload: Record<string, unknown> | null;
  @Column({ type: 'text', nullable: true }) error_message: string | null;
  @Column({ type: 'timestamp', nullable: true }) started_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) finished_at: Date | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('skill_run_logs')
export class SkillRunLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) skill_run_id: string;
  @Column({ type: 'varchar', length: 10, default: 'info' }) level: string;
  @Column({ type: 'text' }) message: string;
  @Column({ type: 'jsonb', nullable: true }) payload: Record<string, unknown> | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Registry: Rights Holders & External Identifiers (migration 20260601000002) ─
@Entity('rights_holders')
@Index(['tenant_id'])
export class RightsHolderEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 255 }) legal_name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) artistic_name: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) document_type: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) document_number: string | null;
  @Column({ type: 'text', nullable: true }) email_encrypted: string | null;
  @Column({ type: 'text', nullable: true }) phone_encrypted: string | null;
  @Column({ type: 'varchar', length: 2, nullable: true }) country: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) ipi_cae: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) society: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) society_member_code: string | null;
  @Column({ type: 'varchar', length: 50, default: 'OTHER' }) holder_type: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
}

@Entity('external_identifiers')
@Index(['tenant_id'])
export class ExternalIdentifierEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 30 }) entity_type: RegistrableEntityType;
  @Column({ type: 'uuid' }) entity_id: string;
  @Column({ type: 'varchar', length: 30 }) provider: string;
  @Column({ type: 'varchar', length: 40 }) identifier_type: IdentifierType;
  @Column({ type: 'varchar', length: 100 }) identifier_value: string;
  @Column({ type: 'boolean', default: false }) is_primary: boolean;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
}

// ─── Society Integration (migration 20260601000003) ───────────────────────────
@Entity('society_accounts')
@Index(['tenant_id'])
export class SocietyAccountEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 50 }) society: string;
  @Column({ type: 'varchar', length: 30 }) driver: string;
  @Column({ type: 'varchar', length: 255 }) account_name: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) member_code: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) credentials_ref: string | null;
  @Column({ type: 'varchar', length: 30, default: 'PENDING' }) status: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
}

@Entity('society_submissions')
@Index(['tenant_id'])
export class SocietySubmissionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) account_id: string | null;
  @Column({ type: 'varchar', length: 50 }) society: string;
  @Column({ type: 'varchar', length: 30 }) driver: SocietyDriver;
  @Column({ type: 'varchar', length: 30 }) entity_type: RegistrableEntityType;
  @Column({ type: 'uuid' }) entity_id: string;
  @Column({ type: 'varchar', length: 30, default: 'DRAFT' }) status: SocietySubmissionStatus;
  @Column({ type: 'varchar', length: 100, nullable: true }) protocol: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) external_id: string | null;
  @Column({ type: 'uuid', nullable: true }) current_payload_snapshot_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) submitted_by: string | null;
  @Column({ type: 'timestamp', nullable: true }) submitted_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) approved_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) rejected_at: Date | null;
  @Column({ type: 'text', nullable: true }) failure_reason: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('society_submission_events')
@Index(['tenant_id'])
export class SocietySubmissionEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) submission_id: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) from_status: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) to_status: string | null;
  @Column({ type: 'varchar', length: 40 }) event_type: string;
  @Column({ type: 'text', nullable: true }) message: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('society_payload_snapshots')
@Index(['tenant_id'])
export class SocietyPayloadSnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) submission_id: string;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ type: 'varchar', length: 64 }) payload_hash: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('society_validation_errors')
@Index(['tenant_id'])
export class SocietyValidationErrorEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) submission_id: string | null;
  @Column({ type: 'varchar', length: 30 }) entity_type: string;
  @Column({ type: 'uuid' }) entity_id: string;
  @Column({ type: 'varchar', length: 20 }) severity: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) field_path: string | null;
  @Column({ type: 'varchar', length: 100 }) code: string;
  @Column({ type: 'text' }) message: string;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('society_sync_jobs')
@Index(['tenant_id'])
export class SocietySyncJobEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 50 }) society: string;
  @Column({ type: 'varchar', length: 30 }) driver: string;
  @Column({ type: 'varchar', length: 20, default: 'PENDING' }) status: string;
  @Column({ type: 'timestamp', nullable: true }) started_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) finished_at: Date | null;
  @Column({ type: 'text', nullable: true }) error_message: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Marketing Projects / Strategy / Assets (migrations 20260529000001..04) ───
@Entity('marketing_projects')
@Index(['tenant_id'])
export class MarketingProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 40 }) type: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 30, default: 'draft' }) status: string;
  @Column({ type: 'varchar', length: 20, default: 'normal' }) priority: string;
  @Column({ type: 'uuid', nullable: true }) source_project_id: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'uuid', nullable: true }) company_id: string | null;
  @Column({ type: 'uuid', nullable: true }) label_id: string | null;
  @Column({ type: 'uuid', nullable: true }) publisher_id: string | null;
  @Column({ type: 'uuid', nullable: true }) studio_id: string | null;
  @Column({ type: 'uuid', nullable: true }) event_id: string | null;
  @Column({ type: 'uuid', nullable: true }) campaign_id: string | null;
  @Column({ type: 'date', nullable: true }) starts_at: string | null;
  @Column({ type: 'date', nullable: true }) ends_at: string | null;
  @Column({ type: 'jsonb', default: {} }) goals: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) metrics: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) context: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'uuid', nullable: true }) financial_project_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('marketing_tasks')
@Index(['tenant_id'])
export class MarketingTaskEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) marketing_project_id: string;
  @Column({ type: 'varchar', length: 120 }) task_key: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 50, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 20, default: 'normal' }) priority: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) kind: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) assigned_to: string | null;
  @Column({ type: 'timestamptz', nullable: true }) due_date: Date | null;
  @Column({ type: 'jsonb', default: [] }) dependencies: unknown[];
  @Column({ type: 'jsonb', default: {} }) metrics: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('marketing_strategies')
@Index(['tenant_id'])
export class MarketingStrategyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) marketing_project_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) responsible_id: string | null;
  @Column({ type: 'varchar', length: 20, default: 'normal' }) priority: string;
  @Column({ type: 'timestamptz', nullable: true }) due_date: Date | null;
  @Column({ type: 'varchar', length: 50, default: 'draft' }) status: string;
  @Column({ type: 'jsonb', default: [] }) dependencies: unknown[];
  @Column({ type: 'jsonb', default: {} }) metrics: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('marketing_strategy_objectives')
@Index(['tenant_id'])
export class MarketingStrategyObjectiveEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) marketing_project_id: string;
  @Column({ type: 'uuid' }) strategy_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) responsible_id: string | null;
  @Column({ type: 'varchar', length: 20, default: 'normal' }) priority: string;
  @Column({ type: 'timestamptz', nullable: true }) due_date: Date | null;
  @Column({ type: 'varchar', length: 50, default: 'planned' }) status: string;
  @Column({ type: 'jsonb', default: [] }) dependencies: unknown[];
  @Column({ type: 'jsonb', default: {} }) metrics: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('marketing_strategy_initiatives')
@Index(['tenant_id'])
export class MarketingStrategyInitiativeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) marketing_project_id: string;
  @Column({ type: 'uuid' }) objective_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) responsible_id: string | null;
  @Column({ type: 'varchar', length: 20, default: 'normal' }) priority: string;
  @Column({ type: 'timestamptz', nullable: true }) due_date: Date | null;
  @Column({ type: 'varchar', length: 50, default: 'planned' }) status: string;
  @Column({ type: 'jsonb', default: [] }) dependencies: unknown[];
  @Column({ type: 'jsonb', default: {} }) metrics: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('marketing_strategy_actions')
@Index(['tenant_id'])
export class MarketingStrategyActionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) marketing_project_id: string;
  @Column({ type: 'uuid' }) initiative_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) responsible_id: string | null;
  @Column({ type: 'varchar', length: 20, default: 'normal' }) priority: string;
  @Column({ type: 'timestamptz', nullable: true }) due_date: Date | null;
  @Column({ type: 'varchar', length: 50, default: 'planned' }) status: string;
  @Column({ type: 'jsonb', default: [] }) dependencies: unknown[];
  @Column({ type: 'jsonb', default: {} }) metrics: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('marketing_assets')
@Index(['tenant_id'])
export class MarketingAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) marketing_project_id: string | null;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'uuid', nullable: true }) company_id: string | null;
  @Column({ type: 'uuid', nullable: true }) campaign_id: string | null;
  @Column({ type: 'uuid', nullable: true }) creative_request_id: string | null;
  @Column({ type: 'uuid', nullable: true }) audiovisual_project_id: string | null;
  @Column({ type: 'uuid', nullable: true }) source_upload_id: string | null;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 40 }) asset_type: string;
  @Column({ type: 'varchar', length: 30, default: 'draft' }) status: string;
  @Column({ type: 'integer', default: 1 }) current_version: number;
  @Column({ type: 'uuid', nullable: true }) current_version_id: string | null;
  @Column({ type: 'text', nullable: true }) file_url: string | null;
  @Column({ type: 'text', nullable: true }) thumbnail_url: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) mime_type: string | null;
  @Column({ type: 'bigint', nullable: true }) size_bytes: string | null;
  @Column({ type: 'jsonb', default: [] }) tags: unknown[];
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) approved_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) approved_by: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('marketing_asset_versions')
@Index(['tenant_id'])
export class MarketingAssetVersionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) asset_id: string;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'varchar', length: 30, default: 'draft' }) status: string;
  @Column({ type: 'text' }) file_url: string;
  @Column({ type: 'text', nullable: true }) thumbnail_url: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) mime_type: string | null;
  @Column({ type: 'bigint', nullable: true }) size_bytes: string | null;
  @Column({ type: 'text', nullable: true }) change_notes: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('marketing_asset_approvals')
@Index(['tenant_id'])
export class MarketingAssetApprovalEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) asset_id: string;
  @Column({ type: 'uuid' }) version_id: string;
  @Column({ type: 'varchar', length: 30, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) requested_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) decided_by: string | null;
  @Column({ type: 'text', nullable: true }) comments: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) requested_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) decided_at: Date | null;
}

@Entity('marketing_content_posts')
@Index(['tenant_id'])
export class MarketingContentPostEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'varchar', length: 40 }) target_type: string;
  @Column({ type: 'varchar', length: 500 }) target_name: string;
  @Column({ type: 'varchar', length: 40 }) channel: string;
  @Column({ type: 'varchar', length: 40 }) content_type: string;
  @Column({ type: 'varchar', length: 40, default: 'agendado' }) status: string;
  @Column({ type: 'varchar', length: 40, default: 'pending' }) publication_status: string;
  @Column({ type: 'date' }) publish_date: string;
  @Column({ type: 'varchar', length: 10 }) publish_time: string;
  @Column({ type: 'timestamptz' }) scheduled_for: Date;
  @Column({ type: 'text' }) copy: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) owner: string | null;
  @Column({ type: 'uuid', nullable: true }) campaign_id: string | null;
  @Column({ type: 'uuid', nullable: true }) project_id: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) format: string | null;
  @Column({ type: 'jsonb', default: [] }) files: unknown[];
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) publish_job_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) provider_post_id: string | null;
  @Column({ type: 'text', nullable: true }) publication_error: string | null;
  @Column({ type: 'timestamptz', nullable: true }) published_at: Date | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

// ─── Central Assets (migration 20260607000001_SkillsAndCentralAssets) ─────────
@Entity('assets')
@Index(['tenant_id'])
export class AssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 500 }) name: string;
  @Column({ type: 'varchar', length: 50, default: 'unknown' }) asset_type: string;
  @Column({ type: 'varchar', length: 150, nullable: true }) mime_type: string | null;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status: string;
  @Column({ type: 'varchar', length: 50 }) source: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) source_id: string | null;
  @Column({ type: 'uuid', nullable: true }) current_version_id: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
  @Column({ type: 'timestamp', nullable: true }) deleted_at: Date | null;
}

@Entity('asset_versions')
@Index(['tenant_id'])
export class AssetVersionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) asset_id: string;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ type: 'text' }) file_url: string;
  @Column({ type: 'text', nullable: true }) thumbnail_url: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) mime_type: string | null;
  @Column({ type: 'bigint', nullable: true }) size_bytes: string | null;
  @Column({ type: 'text', nullable: true }) change_notes: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('project_assets')
@Index(['tenant_id'])
export class ProjectAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) project_id: string;
  @Column({ type: 'uuid' }) asset_id: string;
  @Column({ type: 'varchar', length: 50, default: 'reference' }) role: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) source_event: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) linked_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('task_assets')
@Index(['tenant_id'])
export class TaskAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) task_id: string;
  @Column({ type: 'uuid' }) asset_id: string;
  @Column({ type: 'varchar', length: 50, default: 'reference' }) role: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) source_event: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) linked_by: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('asset_usage_logs')
@Index(['tenant_id'])
export class AssetUsageLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) asset_id: string;
  @Column({ type: 'varchar', length: 60 }) action: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) target_type: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) target_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) actor_id: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Audiovisual (migrations 20260527000003/04/05) ────────────────────────────
@Entity('audiovisual_projects')
@Index(['tenant_id'])
export class AudiovisualProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) artist_id: string | null;
  @Column({ type: 'uuid', nullable: true }) release_id: string | null;
  @Column({ type: 'uuid', nullable: true }) phonogram_id: string | null;
  @Column({ type: 'uuid', nullable: true }) campaign_id: string | null;
  @Column({ type: 'uuid', nullable: true }) event_id: string | null;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) slug: string | null;
  @Column({ type: 'varchar', length: 40, default: 'music_video' }) type: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'text', nullable: true }) objective: string | null;
  @Column({ type: 'varchar', length: 30, default: 'draft' }) status: string;
  @Column({ type: 'varchar', length: 20, default: 'normal' }) priority: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) stage: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) budget_estimated: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) budget_actual: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) production_company: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) director: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) producer: string | null;
  @Column({ type: 'date', nullable: true }) start_date: string | null;
  @Column({ type: 'date', nullable: true }) recording_date: string | null;
  @Column({ type: 'date', nullable: true }) delivery_date: string | null;
  @Column({ type: 'date', nullable: true }) publish_date: string | null;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  // ── Form fields (1 column per field — EXACT name of the form key) ──────────────
  // migration AudiovisualProjectsFormFieldColumns20260718000012. music_id→phonogram_id
  // and budget/real_cost→budget_estimated/budget_actual were resolved in the
  // frontend (the same already existing column), they did not generate a new column.
  @Column({ type: 'varchar', length: 500, nullable: true }) music_title: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) artist_name: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) format: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) videomaker: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) editor: string | null;
  @Column({ type: 'date', nullable: true }) shooting_date: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) location: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) capture_status: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) editing_status: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) approval_status: string | null;
  @Column({ type: 'date', nullable: true }) pre_release_date: string | null;
  @Column({ type: 'date', nullable: true }) release_date: string | null;
  @Column({ type: 'text', nullable: true }) concept: string | null;
  @Column({ type: 'text', nullable: true }) observations: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) final_status: string | null;
  @Column({ type: 'uuid', nullable: true }) financial_project_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('audiovisual_briefings')
@Index(['tenant_id'])
export class AudiovisualBriefingEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) audiovisual_project_id: string;
  @Column({ type: 'text', nullable: true }) concept: string | null;
  @Column({ type: 'text', nullable: true }) visual_style: string | null;
  @Column({ type: 'jsonb', default: [] }) references_list: unknown[];
  @Column({ type: 'text', nullable: true }) target_audience: string | null;
  @Column({ type: 'jsonb', default: [] }) platforms: unknown[];
  @Column({ type: 'text', nullable: true }) format_requirements: string | null;
  @Column({ type: 'jsonb', default: [] }) aspect_ratios: unknown[];
  @Column({ type: 'jsonb', default: [] }) color_palette: unknown[];
  @Column({ type: 'jsonb', default: [] }) moodboard_links: unknown[];
  @Column({ type: 'text', nullable: true }) inspiration_notes: string | null;
  @Column({ type: 'text', nullable: true }) campaign_alignment: string | null;
  @Column({ type: 'text', nullable: true }) artist_notes: string | null;
  @Column({ type: 'text', nullable: true }) manager_notes: string | null;
  @Column({ type: 'text', nullable: true }) technical_notes: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('audiovisual_shots')
@Index(['tenant_id'])
export class AudiovisualShotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) audiovisual_project_id: string;
  @Column({ type: 'integer', default: 0 }) ordering: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) scene_title: string | null;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) location: string | null;
  @Column({ type: 'jsonb', default: [] }) actors: unknown[];
  @Column({ type: 'jsonb', default: [] }) props: unknown[];
  @Column({ type: 'jsonb', default: [] }) wardrobe: unknown[];
  @Column({ type: 'jsonb', default: [] }) equipment: unknown[];
  @Column({ type: 'integer', nullable: true }) estimated_duration_sec: number | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) shooting_status: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('audiovisual_production_days')
@Index(['tenant_id'])
export class AudiovisualProductionDayEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) audiovisual_project_id: string;
  @Column({ type: 'date' }) shooting_date: string;
  @Column({ type: 'time', nullable: true }) call_time: string | null;
  @Column({ type: 'time', nullable: true }) end_time: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) location: string | null;
  @Column({ type: 'text', nullable: true }) weather_notes: string | null;
  @Column({ type: 'text', nullable: true }) team_notes: string | null;
  @Column({ type: 'text', nullable: true }) production_notes: string | null;
  @Column({ type: 'varchar', length: 20, default: 'scheduled' }) status: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('audiovisual_team_members')
@Index(['tenant_id'])
export class AudiovisualTeamMemberEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) audiovisual_project_id: string;
  @Column({ type: 'uuid', nullable: true }) user_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) external_name: string | null;
  @Column({ type: 'varchar', length: 40, default: 'other' }) role: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) contact: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true }) payment_amount: string | null;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) payment_status: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('audiovisual_deliverables')
@Index(['tenant_id'])
export class AudiovisualDeliverableEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) audiovisual_project_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'varchar', length: 40, default: 'youtube_master' }) type: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) platform: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) format: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) resolution: string | null;
  @Column({ type: 'integer', nullable: true }) duration_sec: number | null;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) status: string;
  @Column({ type: 'boolean', default: false }) approved: boolean;
  @Column({ type: 'boolean', default: false }) published: boolean;
  @Column({ type: 'text', nullable: true }) file_url: string | null;
  @Column({ type: 'text', nullable: true }) thumbnail_url: string | null;
  @Column({ type: 'timestamptz', nullable: true }) published_at: Date | null;
  @Column({ type: 'text', nullable: true }) delivery_notes: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('audiovisual_approvals')
@Index(['tenant_id'])
export class AudiovisualApprovalEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) audiovisual_project_id: string;
  @Column({ type: 'uuid', nullable: true }) deliverable_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) requested_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) approved_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) rejected_by: string | null;
  @Column({ type: 'varchar', length: 30, default: 'pending' }) status: string;
  @Column({ type: 'text', nullable: true }) comments: string | null;
  @Column({ type: 'integer', default: 1 }) revision_round: number;
  @Column({ type: 'timestamptz' }) requested_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) approved_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) rejected_at: Date | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('audiovisual_tasks')
@Index(['tenant_id'])
export class AudiovisualTaskEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) audiovisual_project_id: string;
  @Column({ type: 'varchar', length: 500 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 30, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 20, default: 'medium' }) priority: string;
  @Column({ type: 'uuid', nullable: true }) assigned_to: string | null;
  @Column({ type: 'timestamptz', nullable: true }) due_date: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date | null;
  @Column({ type: 'boolean', default: false }) auto_generated: boolean;
  @Column({ type: 'varchar', length: 40, nullable: true }) auto_stage: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('audiovisual_assets')
@Index(['tenant_id'])
export class AudiovisualAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) audiovisual_project_id: string;
  @Column({ type: 'varchar', length: 500 }) name: string;
  @Column({ type: 'varchar', length: 30, default: 'other' }) kind: string;
  @Column({ type: 'text' }) file_url: string;
  @Column({ type: 'text', nullable: true }) thumbnail_url: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) mime_type: string | null;
  @Column({ type: 'bigint', nullable: true }) size_bytes: string | null;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'jsonb', default: [] }) tags: unknown[];
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) uploaded_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

// ─── Financial Categories (migration 20260526000002_FinancialCategoriesEnterprise) ─
@Entity('financial_categories')
@Index(['tenant_id'])
export class FinancialCategoryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) parent_id: string | null;
  @Column({ type: 'text' }) path: string;
  @Column({ type: 'integer', default: 0 }) depth_level: number;
  @Column({ type: 'integer', default: 0 }) tree_order: number;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255 }) slug: string;
  @Column({ type: 'varchar', length: 80 }) code: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) color: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) icon: string | null;
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" }) transaction_types: string[];
  @Column({ type: 'varchar', length: 30, default: 'operational' }) category_kind: string;
  @Column({ type: 'boolean', default: false }) system_category: boolean;
  @Column({ type: 'boolean', default: false }) protected: boolean;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'boolean', default: false }) archived: boolean;
  @Column({ type: 'boolean', default: true }) allow_manual_usage: boolean;
  @Column({ type: 'boolean', default: true }) allow_ai_suggestions: boolean;
  @Column({ type: 'integer', default: 0 }) usage_count: number;
  @Column({ type: 'integer', default: 0 }) sort_order: number;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('financial_category_centers')
@Index(['tenant_id'])
export class FinancialCategoryCenterEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) category_id: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('financial_category_links')
@Index(['tenant_id'])
export class FinancialCategoryLinkEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) category_id: string;
  @Column({ type: 'varchar', length: 80 }) entity_type: string;
  @Column({ type: 'uuid', nullable: true }) entity_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) entity_label: string | null;
  @Column({ type: 'varchar', length: 40 }) relation_role: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('financial_category_favorites')
@Index(['tenant_id'])
export class FinancialCategoryFavoriteEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) category_id: string;
  @Column({ type: 'varchar', length: 255 }) user_id: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('financial_category_rules')
@Index(['tenant_id'])
export class FinancialCategoryRuleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) category_id: string | null;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'integer', default: 100 }) priority: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'jsonb', default: {} }) conditions: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) actions: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) last_triggered_at: Date | null;
  @Column({ type: 'integer', default: 0 }) trigger_count: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) created_by: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) updated_by: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) deleted_at: Date | null;
}

@Entity('financial_category_rule_runs')
@Index(['tenant_id'])
export class FinancialCategoryRuleRunEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) rule_id: string | null;
  @Column({ type: 'uuid', nullable: true }) category_id: string | null;
  @Column({ type: 'jsonb', default: {} }) context: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) result: Record<string, unknown>;
  @Column({ type: 'boolean', default: false }) matched: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('financial_category_audit_logs')
@Index(['tenant_id'])
export class FinancialCategoryAuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid', nullable: true }) category_id: string | null;
  @Column({ type: 'varchar', length: 80 }) action: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) actor_id: string | null;
  @Column({ type: 'varchar', length: 80, default: 'user' }) actor_type: string;
  @Column({ type: 'jsonb', default: {} }) before: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) after: Record<string, unknown>;
  @Column({ type: 'varchar', length: 80, nullable: true }) ip: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @Column({ type: 'timestamptz' }) timestamp: Date;
}

// ─── Workflow Executions (migration 20260607000002_WorkflowExecutions) ─────────
@Entity('workflow_executions')
@Index(['tenant_id'])
export class WorkflowExecutionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 150 }) rule_id: string;
  @Column({ type: 'varchar', length: 255 }) rule_name: string;
  @Column({ type: 'varchar', length: 100 }) event_type: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) correlation_id: string | null;
  @Column({ type: 'varchar', length: 20, default: 'running' }) status: string;
  @Column({ type: 'integer', default: 0 }) actions_total: number;
  @Column({ type: 'integer', default: 0 }) actions_succeeded: number;
  @Column({ type: 'integer', default: 0 }) actions_failed: number;
  @Column({ type: 'text', nullable: true }) error_message: string | null;
  @Column({ type: 'timestamp', nullable: true }) started_at: Date | null;
  @Column({ type: 'timestamp', nullable: true }) finished_at: Date | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

@Entity('workflow_execution_logs')
export class WorkflowExecutionLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) execution_id: string;
  @Column({ type: 'varchar', length: 30 }) action_type: string;
  @Column({ type: 'varchar', length: 20 }) status: string;
  @Column({ type: 'text', nullable: true }) message: string | null;
  @Column({ type: 'jsonb', nullable: true }) payload: Record<string, unknown> | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}

// ─── Integration governance (migration 20260823000001) ───────────────────────
// GLOBAL platform config (no tenant_id): governs the publication and audience
// of each integration. Technical capability does NOT live here — it is derived from the
// in-code adapter registry, because a technical implementation is code, not governance.

export interface IntegrationAudience {
  mode: 'none' | 'all' | 'plans' | 'tenants';
  plans: string[];
  tenantIds: string[];
}

@Entity('integration_categories')
export class IntegrationCategoryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64 })  slug: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'int', default: 0 })      display_order: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
}

@Entity('platform_integrations')
export class PlatformIntegrationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64 })  provider_key: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'uuid', nullable: true }) category_id: string | null;
  @Column({ type: 'varchar', length: 32 })  connection_kind: 'oauth' | 'tenant_credentials' | 'platform_credentials';
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) required_env: string[];
  @Column({ type: 'varchar', length: 16, default: 'draft' }) publication_state: 'draft' | 'published' | 'retired';
  @Column({ type: 'jsonb' }) view_audience: IntegrationAudience;
  @Column({ type: 'jsonb' }) use_audience:  IntegrationAudience;
  /** commercial | internal_platform | platform_billing */
  @Column({ type: 'varchar', length: 32, default: 'commercial' }) classification: string;
  /**
   * Operational state of the adapter (planned…ready…retired), governable by the
   * admin. It is NOT the entitlement (that lives in billing_plans.features.integrations)
   * nor the in-code capability (does an adapter exist?).
   */
  @Column({ type: 'varchar', length: 32, default: 'planned' }) technical_state: string;
  @Column({ type: 'boolean', default: false }) is_core: boolean;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updated_at: Date;
}

// ─── All entities array (for DataSource registration) ─────────────────────────
export const ALL_ENTITIES = [
  IntegrationCategoryEntity,
  PlatformIntegrationEntity,
  OrganizationEntity,
  TenantEntity,
  UserEntity,
  OrgMemberEntity,
  // ── RBAC Enterprise (PHASE 4) ──
  PermissionGroupEntity,
  PermissionEntity,
  PermissionAliasEntity,
  RoleTemplateEntity,
  RoleTemplatePermissionEntity,
  PermissionDependencyEntity,
  PermissionConflictEntity,
  RoleEntity,
  RoleInheritanceEntity,
  RolePermissionEntity,
  DepartmentEntity,
  PositionEntity,
  JobFunctionEntity,
  MembershipJobFunctionEntity,
  BillingSubscriptionEntity,
  TenantBillingStateEntity,
  PaymentEventEntity,
  BillingSettingsEntity,
  BillingPlanEntity,
  ArtistEntity,
  ArtistPlatformProfileEntity,
  ArtistMetricSnapshotEntity,
  CareerStageSnapshotEntity,
  MarketBenchmarkSnapshotEntity,
  MarketReferenceMetricEntity,
  WorkEntity,
  WorkParticipantEntity,
  PhonogramEntity,
  ContractEntity,
  ContractTemplateEntity,
  ContractServiceTypeEntity,
  TransactionEntity,
  InvoiceEntity,
  ClientEntity,
  ClientAttachmentEntity,
  LeadEntity,
  LeadInteractionEntity,
  CampaignEntity,
  BriefingEntity,
  EventEntity,
  ProjectEntity,
  ProjectTrackEntity,
  ProjectTrackParticipantEntity,
  ReleaseEntity,
  ShareEntity,
  TakedownEntity,
  SupportTicketEntity,
  NotificationEntity,
  NotificationSettingEntity,
  UploadEntity,
  IntegrationEntity,
  OAuthConnectionEntity,
  WebhookEventEntity,
  AuditLogEntity,
  SkillRunEntity,
  SkillRunLogEntity,
  AIJobEntity,
  ArtistGoalEntity,
  ContentDetectionEntity,
  EcadReportEntity,
  EmployeeEntity,
  PayrollEntryEntity,
  LeaveRequestEntity,
  WorkflowTransitionEntity,
  DomainEventLogEntity,
  ActivityLogEntity,
  ConversationEntity,
  ConversationMessageEntity,
  ConversationNoteEntity,
  InternalConversationEntity,
  InternalConversationParticipantEntity,
  InternalMessageEntity,
  MusicChatAutomationSettingsEntity,
  MusicChatAutomationEventEntity,
  MusicChatAutomationNotificationEntity,
  // Operational task queue used by workflow handlers
  CrmTaskEntity,
  // Phase 8: Music Pipelines
  PipelineEntity,
  PipelineStageEntity,
  PipelineOpportunityEntity,
  // Phase 11: Campaign Operations
  CampaignTaskEntity,
  CampaignAssetEntity,
  // Phase 13: Analytics
  AiUsageLogEntity,
  // Phase 14: Inventory, Licensing, Financial Rules
  InventoryItemEntity,
  LicenseEntity,
  FinancialRuleEntity,
  FinanceCategoryKeywordRuleEntity,
  // Registry & Society Integration (migrations 20260601000002 / 000003)
  RightsHolderEntity,
  ExternalIdentifierEntity,
  SocietyAccountEntity,
  SocietySubmissionEntity,
  SocietySubmissionEventEntity,
  SocietyPayloadSnapshotEntity,
  SocietyValidationErrorEntity,
  SocietySyncJobEntity,
  // Marketing Projects / Strategy / Assets / Content (migrations 20260529000001..04, 20260602000001)
  MarketingProjectEntity,
  MarketingTaskEntity,
  MarketingStrategyEntity,
  MarketingStrategyObjectiveEntity,
  MarketingStrategyInitiativeEntity,
  MarketingStrategyActionEntity,
  MarketingAssetEntity,
  MarketingAssetVersionEntity,
  MarketingAssetApprovalEntity,
  MarketingContentPostEntity,
  // Central Assets (migration 20260607000001)
  AssetEntity,
  AssetVersionEntity,
  ProjectAssetEntity,
  TaskAssetEntity,
  AssetUsageLogEntity,
  // Audiovisual (migrations 20260527000003/04/05)
  AudiovisualProjectEntity,
  AudiovisualBriefingEntity,
  AudiovisualShotEntity,
  AudiovisualProductionDayEntity,
  AudiovisualTeamMemberEntity,
  AudiovisualDeliverableEntity,
  AudiovisualApprovalEntity,
  AudiovisualTaskEntity,
  AudiovisualAssetEntity,
  // Financial Categories (migration 20260526000002)
  FinancialCategoryEntity,
  FinancialCategoryCenterEntity,
  FinancialCategoryLinkEntity,
  FinancialCategoryFavoriteEntity,
  FinancialCategoryRuleEntity,
  FinancialCategoryRuleRunEntity,
  FinancialCategoryAuditLogEntity,
  // Workflow Executions (migration 20260607000002)
  WorkflowExecutionEntity,
  WorkflowExecutionLogEntity,
];
