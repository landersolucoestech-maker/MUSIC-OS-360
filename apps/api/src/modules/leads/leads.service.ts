import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ADMIN_DATA_SOURCE, DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { LeadEntity } from '../../database/entities';
import { EncryptionService } from '../../core/security/encryption.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import type {
  CreateLeadDto,
  UpdateLeadDto,
  QueryLeadDto,
  PublicArtistApplicationDto,
  PublicArtistRegistrationDto,
} from './dto/leads.dto';
import { LeadStatus } from '@music-os-360/types';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { BillingEnforcementService } from '../billing/billing-enforcement.service';

@Injectable()
export class LeadsService {
  private readonly ds:   DataSource | null = null;
  private readonly repo: Repository<LeadEntity> | null = null;
  private tenantColumns: Set<string> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    @Optional() @Inject(ADMIN_DATA_SOURCE) private readonly adminDs: DataSource | null,
    private readonly dbContext: DatabaseContextService,
    private readonly workflowService: WorkflowService,
    private readonly events: EventsService,
    private readonly enc: EncryptionService,
    private readonly billing: BillingEnforcementService,
    @Optional() private readonly activityLogs?: ActivityLogsService,
  ) {
    if (ds) {
      this.ds   = ds;
      this.repo = ds.getRepository(LeadEntity);
    }
  }

  private mapLead<T extends LeadEntity>(l: T): T & { email: string | null; phone: string | null } {
    const metadata = (l.metadata ?? {}) as Record<string, unknown>;
    return {
      ...l,
      name:               l.nome,
      source:             l.fonte,
      notes:              metadata['notes'] ?? null,
      assignedTo:         metadata['assignedTo'] ?? null,
      value:              metadata['value'] ?? null,
      stage:              metadata['stage'] ?? null,
      email:              this.enc.decryptNullable(l.email_encrypted),
      phone:              this.enc.decryptNullable(l.telefone_encrypted),
      email_encrypted:    undefined as unknown as string,
      telefone_encrypted: undefined as unknown as string,
      // Aliases camelCase para o CRM musical (mesmas colunas físicas de `l`).
      nomeArtistico:      l.nome_artistico,
      tipoCliente:        l.tipo_cliente,
      payloadServico:     l.payload_servico,
      dadosInternosCRM:   l.dados_internos_crm,
    };
  }

  async list(tenantId: string, query: QueryLeadDto) {
    const q = query as Record<string, unknown>;
    const qb = this.repo!
      .createQueryBuilder('l')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('l.deleted_at IS NULL');

    if (q['status'])         qb.andWhere('l.status = :status',                 { status:       q['status'] });
    if (q['search'])         qb.andWhere('(l.nome ILIKE :search OR l.empresa ILIKE :search)', { search: `%${q['search']}%` });

    qb.orderBy('l.created_at', q['ascending'] ? 'ASC' : 'DESC')
      .skip(typeof q['offset'] === 'number' ? q['offset'] : 0)
      .take(typeof q['limit']  === 'number' ? q['limit']  : 50);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((l) => this.mapLead(l)),
      meta: {
        total,
        offset: typeof q['offset'] === 'number' ? q['offset'] : 0,
        limit:  typeof q['limit']  === 'number' ? q['limit']  : 50,
      },
    };
  }

  async findById(
    tenantId: string,
    id: string,
    actorRole?: string,
  ): Promise<LeadEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const result = await this.repo!
      .createQueryBuilder('l')
      .where('l.id = :id AND l.tenant_id = :tenantId AND l.deleted_at IS NULL', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Lead não encontrado');
    const allowed_transitions = this.workflowService.getAllowedTransitions('lead', result.status, actorRole);
    return { ...this.mapLead(result), allowed_transitions };
  }

  async create(tenantId: string, userId: string, dto: CreateLeadDto): Promise<ReturnType<typeof this.mapLead>> {
    const { status: _clientStatus, email, phone, ...rest } = dto as unknown as Record<string, unknown>;
    void _clientStatus;
    const lead = this.normalizeLeadPayload(rest);
    const entity = this.repo!.create({
      tenant_id:          tenantId,
      ...(lead as Record<string, unknown>),
      email_encrypted:    this.enc.encryptNullable(email as string | undefined),
      telefone_encrypted: this.enc.encryptNullable(phone as string | undefined),
      status:             LeadStatus.NEW,
      created_by:         userId,
      updated_by:         userId,
    } as Partial<LeadEntity>);
    const saved = await this.repo!.save(entity as LeadEntity);
    await this.recordActivity(tenantId, userId, saved.id, 'created', `Lead "${saved.nome}" criado`, {
      nome: saved.nome,
      fonte: saved.fonte,
    });
    return this.mapLead(saved);
  }

  async resolvePublicTenant(slug: string): Promise<{ name: string; slug: string }> {
    const rows = await (this.adminDs ?? this.ds)!.query(
      `SELECT "name", "slug"
         FROM "tenants"
        WHERE lower("slug") = lower($1)
          AND "active" = true
          AND "deleted_at" IS NULL
        LIMIT 1`,
      [slug.trim()],
    ) as Array<{ name: string; slug: string }>;
    if (!rows[0]) throw new NotFoundException('Organização não encontrada ou inativa');
    return rows[0];
  }

  async resolvePublicWorkspace(slug: string): Promise<{
    id: string;
    name: string;
    slug: string;
    allowPublicRegistration: boolean;
    logoUrl: string | null;
  }> {
    const tenant = await this.getPublicWorkspaceBySlug(slug, true);
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      allowPublicRegistration: true,
      logoUrl: typeof tenant.settings?.['logoUrl'] === 'string' ? tenant.settings['logoUrl'] : null,
    };
  }

  async submitPublicArtistRegistration(
    dto: PublicArtistRegistrationDto,
  ): Promise<{ id: string | null; protocol: string; accepted: true }> {
    return this.submitPublicArtistApplication(dto.workspaceSlug, {
      ...dto,
      artisticName: dto.artistName,
      musicalGenre: dto.musicalGenre ?? 'Nao informado',
    });
  }

  async submitPublicArtistApplication(
    slug: string,
    dto: PublicArtistApplicationDto,
  ): Promise<{ id: string | null; protocol: string; accepted: true }> {
    if (dto.companyWebsite) {
      return { id: null, protocol: 'ACCEPTED', accepted: true };
    }

    const tenant = await this.getPublicWorkspaceBySlug(slug, false);
    const phone = dto.phone?.trim() ?? '';
    if (!tenant) throw new NotFoundException('Organização não encontrada ou inativa');

    // Formulário público sem autenticação: duplo-clique/retry no submit é o
    // cenário normal, não uma exceção. Idempotency-Key não se aplica (não há
    // como garantir que o embed externo do formulário o envie). Em vez
    // disso, deduplicamos por e-mail dentro de uma janela curta — email é
    // criptografado (IV aleatório), então não dá para comparar via SQL;
    // varremos só os candidatos recentes (mesmo tenant+origem, últimos 5min).
    // ponytail: scan limitado (20 linhas) em vez de índice — se o volume de
    // candidaturas por tenant crescer muito, considerar HMAC determinístico
    // do e-mail como coluna de dedupe indexável.
    const recentCandidates = await this.repo!
      .createQueryBuilder('l')
      .where('l.tenant_id = :tenantId', { tenantId: tenant.id })
      .andWhere(`l.created_at > now() - interval '5 minutes'`)
      .andWhere('l.fonte = :fonte', { fonte: 'public_artist_application' })
      .orderBy('l.created_at', 'DESC')
      .limit(20)
      .getMany();
    const normalizedEmail = dto.email.trim().toLowerCase();
    const duplicate = recentCandidates.find(
      (l) => this.enc.decryptNullable(l.email_encrypted) === normalizedEmail,
    );
    if (duplicate) {
      return {
        id: duplicate.id,
        protocol: duplicate.id.replace(/-/g, '').slice(-8).toUpperCase(),
        accepted: true,
      };
    }

    const saved = await this.dbContext.runInTenantContext(
      { tenantId: tenant.id, orgId: tenant.org_id, role: 'system' },
      async () => {
        const entity = this.repo!.create({
          tenant_id: tenant.id,
          nome: dto.artisticName.trim(),
          nome_artistico: dto.artisticName.trim(),
          nome_completo: dto.fullName.trim(),
          email_encrypted: this.enc.encryptNullable(dto.email.trim().toLowerCase()),
          telefone_encrypted: this.enc.encryptNullable(phone || undefined),
          whatsapp: phone || null,
          cidade: dto.city?.trim() || null,
          estado: dto.state?.trim() || null,
          fonte: 'public_artist_application',
          origemLead: 'public_artist_application',
          status: LeadStatus.NEW,
          tags: ['artist_application', 'public_form'],
          metadata: {
            musicalGenre: dto.musicalGenre,
            objective: dto.objective ?? null,
            message: dto.message ?? null,
            socialLinks: dto.socialLinks ?? {},
            additionalData: dto.additionalData ?? {},
            acceptedTerms: dto.acceptedTerms,
            submittedAt: new Date().toISOString(),
          },
          created_by: 'system:public-artist-application',
          updated_by: 'system:public-artist-application',
        } as Partial<LeadEntity>);
        return this.repo!.save(entity);
      },
    );
    const protocol = saved.id.replace(/-/g, '').slice(-8).toUpperCase();
    await this.incrementPublicRegistrationMetric(tenant.id, 'public_registration_conversion_count');

    this.events.emitTyped(DOMAIN_EVENTS.LEAD_CREATED, {
      tenantId: tenant.id,
      userId: 'system:public-artist-application',
      aggregateType: 'lead',
      aggregateId: saved.id,
      payload: {
        tenantId: tenant.id,
        leadId: saved.id,
        nome: saved.nome,
        origem: 'public_artist_application',
      },
    });

    return { id: saved.id, protocol, accepted: true };
  }

  private async getTenantColumns(): Promise<Set<string>> {
    if (this.tenantColumns) return this.tenantColumns;
    const rows = await (this.adminDs ?? this.ds)!.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'`,
    ) as Array<{ column_name: string }>;
    this.tenantColumns = new Set(rows.map((row) => row.column_name));
    return this.tenantColumns;
  }

  private normalizePublicWorkspaceSlug(slug: string): string {
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,98}[a-z0-9]$/.test(normalized)) {
      throw new NotFoundException('Link de cadastro invalido');
    }
    return normalized;
  }

  private async getPublicWorkspaceBySlug(slug: string, trackAccess: boolean): Promise<{
    id: string;
    org_id: string;
    name: string;
    slug: string;
    active: boolean;
    deleted_at: Date | null;
    allow_public_registration: boolean;
    public_registration_blocked: boolean;
    public_registration_revoked_at: Date | null;
    settings: Record<string, unknown>;
  }> {
    const normalizedSlug = this.normalizePublicWorkspaceSlug(slug);
    const columns = await this.getTenantColumns();
    const allowExpr = columns.has('allow_public_registration')
      ? `"allow_public_registration"`
      : `CASE WHEN lower(COALESCE("settings"->>'allow_public_registration', 'true')) = 'false' THEN false ELSE true END`;
    const blockedExpr = columns.has('public_registration_blocked') ? `"public_registration_blocked"` : `false`;
    const revokedExpr = columns.has('public_registration_revoked_at') ? `"public_registration_revoked_at"` : `NULL`;

    const rows = await (this.adminDs ?? this.ds)!.query(
      `SELECT "id",
              "org_id",
              "name",
              "slug",
              "active",
              "deleted_at",
              "settings",
              ${allowExpr} AS "allow_public_registration",
              ${blockedExpr} AS "public_registration_blocked",
              ${revokedExpr} AS "public_registration_revoked_at"
         FROM "tenants"
        WHERE lower("slug") = lower($1)
        LIMIT 1`,
      [normalizedSlug],
    ) as Array<{
      id: string;
      org_id: string;
      name: string;
      slug: string;
      active: boolean;
      deleted_at: Date | null;
      allow_public_registration: boolean;
      public_registration_blocked: boolean;
      public_registration_revoked_at: Date | null;
      settings: Record<string, unknown>;
    }>;
    const tenant = rows[0];
    if (!tenant) throw new NotFoundException('Workspace nao encontrado');
    if (!tenant.active || tenant.deleted_at) throw new NotFoundException('Cadastro indisponivel');
    // find-a22e0dad / req-ea44db5a: unlike the Type-B external-reconciliation webhooks
    // (Autentique/DocuSign/external-data), public lead-capture is a repeatable, unauthenticated,
    // attacker-triggerable NEW write with ongoing storage/automation cost — it is billing-gated,
    // not exempt. Suspended and read_only tenants both reject; response stays identical to the
    // "not found" cases above so billing status is never leaked to an unauthenticated caller.
    const billingState = await this.billing.getState(tenant.id);
    if (billingState && (billingState.status === 'suspended' || billingState.status === 'read_only')) {
      throw new NotFoundException('Cadastro indisponivel');
    }
    if (!tenant.allow_public_registration || tenant.public_registration_blocked || tenant.public_registration_revoked_at) {
      throw new NotFoundException('Cadastro indisponivel para este workspace');
    }
    if (trackAccess) {
      await this.incrementPublicRegistrationMetric(tenant.id, 'public_registration_access_count');
    }
    return tenant;
  }

  private async incrementPublicRegistrationMetric(
    tenantId: string,
    column: 'public_registration_access_count' | 'public_registration_conversion_count',
  ): Promise<void> {
    const columns = await this.getTenantColumns();
    if (!columns.has(column)) return;
    await (this.adminDs ?? this.ds)!.query(
      `UPDATE "tenants"
          SET "${column}" = COALESCE("${column}", 0) + 1,
              "updated_at" = now()
        WHERE "id" = $1`,
      [tenantId],
    );
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateLeadDto,
    actorRole?: string,
  ): Promise<LeadEntity & { allowed_transitions: { to: string; label?: string }[] }> {
    const current = await this.findById(tenantId, id, actorRole);
    const dtoMap  = dto as Record<string, unknown>;
    const statusChanging = dtoMap['status'] != null && dtoMap['status'] !== current.status;
    const toStatus = dtoMap['status'] as string | undefined;
    const expectedUpdatedAt = dtoMap['expectedUpdatedAt'] as string | undefined;
    const conflictMessage = 'Este lead foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.';

    const { status: _s, email, phone, expectedUpdatedAt: _eua, ...restFields } = dtoMap;
    void _s;
    void _eua;

    const nonStatusUpdates: Record<string, unknown> = {
      updated_at: new Date(),
      updated_by: userId,
      ...this.normalizeLeadPayload(restFields, current.metadata ?? {}),
    };
    if (email !== undefined) nonStatusUpdates['email_encrypted']    = this.enc.encryptNullable(email as string | null);
    if (phone !== undefined) nonStatusUpdates['telefone_encrypted']  = this.enc.encryptNullable(phone as string | null);

    if (statusChanging) {
      const req = {
        entityType: 'lead' as const,
        entityId:   id,
        tenantId,
        actorId:    userId,
        actorRole,
        fromStatus: current.status,
        toStatus:   toStatus as string,
        entity:     current as unknown as Record<string, unknown>,
      };
      await this.ds!.transaction(async (em) => {
        await this.workflowService.transitionInTx(req, em);
        // CAS dentro da mesma transação da mudança de status: se o lead foi
        // editado por outra pessoa desde a leitura de `current` acima, a
        // transação inteira (incluindo o histórico de transição já gravado
        // por transitionInTx) faz rollback — nunca aplica uma transição
        // validada contra um fromStatus desatualizado (mesmo padrão de
        // ContractsService.update()).
        await casUpdate(
          em.getRepository(LeadEntity),
          { id, tenant_id: tenantId },
          { ...nonStatusUpdates, status: toStatus as LeadStatus },
          expectedUpdatedAt,
          conflictMessage,
        );
      });

      // Emit WORKFLOW_TRANSITIONED for every lead status change
      this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_TRANSITIONED, {
        tenantId,
        userId,
        aggregateType: 'lead',
        aggregateId:   id,
        payload: {
          entityType:     'lead',
          entityId:       id,
          tenantId,
          fromStatus:     current.status,
          toStatus:       toStatus as string,
          actorId:        userId,
          actorRole,
          reason:         null,
          transitionedAt: new Date().toISOString(),
        },
      });

      // Emit LEAD_CONVERTED when lead is won/closed (FECHADO)
      if (toStatus === LeadStatus.CLOSED) {
        this.events.emitTyped(DOMAIN_EVENTS.LEAD_CONVERTED, {
          tenantId,
          userId,
          aggregateType: 'lead',
          aggregateId:   id,
          payload: {
            leadId:      id,
            tenantId,
            nome:        current.nome,
            empresa:     current.empresa ?? null,
            convertedBy: userId,
            convertedAt: new Date().toISOString(),
          },
        });
      }
    } else {
      await casUpdate(
        this.repo!,
        { id, tenant_id: tenantId } as FindOptionsWhere<LeadEntity>,
        nonStatusUpdates as QueryDeepPartialEntity<LeadEntity>,
        expectedUpdatedAt,
        conflictMessage,
      );
    }

    return this.findById(tenantId, id, actorRole);
  }

  async remove(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repo!.update(
      { id, tenant_id: tenantId } as FindOptionsWhere<LeadEntity>,
      { deleted_at: new Date() } as QueryDeepPartialEntity<LeadEntity>,
    );
    return { deleted: true };
  }

  private normalizeLeadPayload(input: Record<string, unknown>, existingMetadata: Record<string, unknown> = {}) {
    const {
      name, source, stage, notes, assignedTo, value, metadata,
      nomeArtistico, empresa, whatsapp, instagram, cidade, estado, pais,
      tipoCliente, tipoServico, payloadServico, dadosInternosCRM, uploads,
      ...rest
    } = input;
    const mapped: Record<string, unknown> = { ...rest };
    if (name !== undefined) mapped['nome'] = name;
    if (source !== undefined) mapped['fonte'] = source;
    // `pipeline_stage` foi removida fisicamente (RebuildLeadsInCanonicalFormOrder,
    // órfã comprovada) — `stage` do DTO vai para metadata, como notes/assignedTo/value.
    if (nomeArtistico !== undefined) mapped['nome_artistico'] = nomeArtistico;
    if (empresa !== undefined) mapped['empresa'] = empresa;
    if (whatsapp !== undefined) mapped['whatsapp'] = whatsapp;
    if (instagram !== undefined) mapped['instagram'] = instagram;
    if (cidade !== undefined) mapped['cidade'] = cidade;
    if (estado !== undefined) mapped['estado'] = estado;
    if (pais !== undefined) mapped['pais'] = pais;
    if (tipoCliente !== undefined) mapped['tipo_cliente'] = tipoCliente;
    if (tipoServico !== undefined) mapped['tipoServico'] = tipoServico;
    if (payloadServico !== undefined) mapped['payload_servico'] = payloadServico;
    if (dadosInternosCRM !== undefined) mapped['dados_internos_crm'] = dadosInternosCRM;
    if (uploads !== undefined) mapped['uploads'] = uploads;

    const mergedMetadata = {
      ...existingMetadata,
      ...((metadata ?? {}) as Record<string, unknown>),
    };
    if (notes !== undefined) mergedMetadata['notes'] = notes;
    if (assignedTo !== undefined) mergedMetadata['assignedTo'] = assignedTo;
    if (value !== undefined) mergedMetadata['value'] = value;
    if (stage !== undefined) mergedMetadata['stage'] = stage;
    if (
      metadata !== undefined ||
      notes !== undefined ||
      assignedTo !== undefined ||
      value !== undefined ||
      stage !== undefined
    ) {
      mapped['metadata'] = mergedMetadata;
    }
    return mapped;
  }

  private async recordActivity(
    tenantId: string,
    userId: string,
    entityId: string,
    action: string,
    description: string,
    metadata: Record<string, unknown>,
  ) {
    if (!this.activityLogs) return;
    try {
      await this.activityLogs.create(tenantId, userId || 'system', {
        entity_type: 'lead',
        entity_id:   entityId,
        action,
        description,
        metadata,
      });
    } catch {
      // Activity feed failures are caught by runtime validation; CRUD persistence remains authoritative.
    }
  }
}
