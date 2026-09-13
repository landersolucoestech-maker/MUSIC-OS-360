import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { OrgMemberEntity } from '../../database/entities';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import type { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/users.dto';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { MembershipRoleResolverService } from './membership-role-resolver.service';
import { RbacDistributedCacheService } from '../../core/rbac/rbac-distributed-cache.service';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { ROLE_HIERARCHY } from '../../core/rbac/role-hierarchy';
import { MailService } from '../../core/mail/mail.service';
import { PlanLimitService } from '../../core/billing/plan-limit.service';

@Injectable()
export class UsersService {
  private readonly repo: Repository<OrgMemberEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly events: EventsService,
    private readonly roleResolver: MembershipRoleResolverService,
    private readonly rbacCache: RbacDistributedCacheService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly planLimit: PlanLimitService,
  ) {
    if (ds) this.repo = ds.getRepository(OrgMemberEntity);
  }

  async list(tenantId: string, q: QueryUserDto) {
    const qb = this.repo!
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId });

    if (q.role)   qb.andWhere('m.role = :role',       { role:   q.role });
    if (q.search) qb.andWhere('m.email ILIKE :search', { search: `%${q.search}%` });

    qb.orderBy('m.created_at', q.ascending ? 'ASC' : 'DESC')
      .skip(q.offset ?? 0)
      .take(q.limit ?? 50);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<OrgMemberEntity> {
    const result = await this.repo!
      .createQueryBuilder('m')
      .where('m.id = :id AND m.tenant_id = :tenantId', { id, tenantId })
      .getOne();
    if (!result) throw new NotFoundException('Utilizador não encontrado');
    return result;
  }

  async findByUserId(tenantId: string, userId: string): Promise<OrgMemberEntity | null> {
    return this.repo!
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId AND m.auth_user_id = :userId', { tenantId, userId })
      .getOne() ?? null;
  }

  async create(
    tenantId: string,
    dto: CreateUserDto,
    invitedBy?: string,
    actorRole = 'viewer',
  ): Promise<OrgMemberEntity> {
    const existing = await this.findByUserId(tenantId, dto.userId);
    if (existing) throw new ConflictException('Utilizador já existe neste tenant');

    const anyMember = await this.repo!
      .createQueryBuilder('m')
      .select('m.org_id')
      .where('m.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!anyMember) throw new NotFoundException('Tenant sem organização associada');

    // find-f7bfdd94: create() escrevia dto.role directo em org_members.role sem
    // passar por assertCanAssignRole — mesma classe de bypass de find-5cc269d3,
    // só que via POST /users em vez de PATCH /users/:id/role.
    await this.assertCanAssignRole(tenantId, actorRole, dto.role);

    // Dual-write (PASSO 12-G): grava `role` (legado) E `role_id` (canônico resolvido).
    const roleId = await this.roleResolver.resolveOrThrow(tenantId, dto.role);
    const entity = this.repo!.create({
      org_id:        anyMember.org_id,
      tenant_id:     tenantId,
      auth_user_id: dto.userId,
      email:         dto.email,
      full_name:     dto.fullName ?? null,
      phone:         dto.phone ?? null,
      role:          dto.role,
      role_id:       roleId,
      is_active:     true,
    });
    const saved = await this.repo!.save(entity as any) as any;
    await this.invalidateMembershipCache(tenantId, dto.userId);

    this.events.emitTyped(DOMAIN_EVENTS.USER_INVITED, {
      tenantId,
      aggregateType: 'user',
      aggregateId:   saved.id,
      userId:        invitedBy ?? 'system',
      payload: {
        tenantId,
        userId:    dto.userId,
        email:     dto.email,
        role:      dto.role,
        invitedBy: invitedBy ?? 'system',
      },
    });

    return saved;
  }

  /**
   * Task L: apenas campos de PERFIL (full_name/phone/avatar/metadata) — role
   * e status (is_active) foram removidos do UpdateUserDto e NÃO são
   * aceites aqui. Alterações de papel passam por assignRole() (checa
   * hierarquia via assertCanAssignRole); desativação passa por remove()
   * (protege o último owner via assertNotLastOwner). Misturar essas
   * operações RBAC neste update genérico (gate apenas 'manager') permitia
   * contornar as duas checagens.
   */
  async update(tenantId: string, id: string, dto: UpdateUserDto): Promise<OrgMemberEntity> {
    const current = await this.findById(tenantId, id);
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (dto.fullName != null) updates.full_name = dto.fullName;
    if (dto.phone    != null) updates.phone     = dto.phone;
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      updates as any,
      dto.expectedUpdatedAt,
      'Este utilizador foi alterado por outra pessoa desde que você o carregou. Recarregue e tente novamente.',
    );
    await this.invalidateMembershipCache(tenantId, current.auth_user_id);
    return this.findById(tenantId, id);
  }

  async invite(tenantId: string, email: string, roleId: string, invitedBy: string, actorRole = 'viewer') {
    const roles = await this.repo!.manager.query(
      `SELECT "slug" FROM "roles"
        WHERE "id" = $1
          AND ("tenant_id" = $2 OR "tenant_id" IS NULL)
          AND "deleted_at" IS NULL
          AND "archived_at" IS NULL
          AND "is_assignable" = true
        LIMIT 1`,
      [roleId, tenantId],
    ) as Array<{ slug: string }>;
    const role = roles[0]?.slug;
    if (!role) throw new NotFoundException('Papel não encontrado ou não atribuível');
    await this.assertCanAssignRole(tenantId, actorRole, role);

    const tenantRows = await this.repo!.manager.query(
      `SELECT "org_id", "slug" FROM "tenants"
        WHERE "id" = $1 AND "active" = true AND "deleted_at" IS NULL`,
      [tenantId],
    ) as Array<{ org_id: string; slug: string }>;
    const tenant = tenantRows[0];

    const existing = await this.repo!.manager.query(
      `SELECT 1 FROM "org_members"
        WHERE "tenant_id" = $1 AND lower("email") = lower($2)
          AND "is_active" = true AND "deleted_at" IS NULL LIMIT 1`,
      [tenantId, email],
    ) as unknown[];
    if (existing.length > 0) throw new ConflictException('Email já pertence a este tenant');
    const pending = await this.repo!.manager.query(
      `SELECT 1 FROM "tenant_invitations"
        WHERE "tenant_id" = $1 AND lower("email") = lower($2)
          AND "status" = 'pending' LIMIT 1`,
      [tenantId, email],
    ) as unknown[];
    if (pending.length > 0) throw new ConflictException('Já existe um convite pendente para este email');
    if (!tenant) throw new NotFoundException('Tenant não encontrado ou inativo');
    await this.planLimit.enforce(tenantId, tenant.org_id, 'users');

    const supabase = this.supabaseAdmin();
    const redirectBase = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5000';
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${redirectBase}/reset-password`,
      data: { org_id: tenant.org_id, tenant_id: tenantId, tenant_slug: tenant.slug, role },
    });
    if (error || !data.user) {
      throw new ConflictException(error?.message ?? 'Não foi possível criar o convite');
    }

    const metadataResult = await supabase.auth.admin.updateUserById(data.user.id, {
      app_metadata: { org_id: tenantId, role },
    });
    if (metadataResult.error) {
      await supabase.auth.admin.deleteUser(data.user.id, true).catch(() => undefined);
      throw new ConflictException(metadataResult.error.message);
    }

    const membership = await this.create(tenantId, {
      userId: data.user.id,
      email,
      role,
    }, invitedBy);
    const invitations = await this.repo!.manager.query(
      `INSERT INTO "tenant_invitations" (
         "tenant_id", "org_id", "email", "role_id", "auth_user_id", "invited_by"
       )
       VALUES ($1, $2, lower($3), $4, $5, $6)
       RETURNING "id", "email", "role_id", "invited_by", "status",
                 "expires_at", "created_at"`,
      [tenantId, tenant.org_id, email, membership.role_id, data.user.id, invitedBy],
    ) as Array<Record<string, unknown>>;
    return invitations[0];
  }

  async listInvitations(tenantId: string) {
    await this.repo!.manager.query(
      `UPDATE "tenant_invitations"
          SET "status" = 'expired', "updated_at" = now()
        WHERE "tenant_id" = $1 AND "status" = 'pending' AND "expires_at" <= now()`,
      [tenantId],
    );
    return this.repo!.manager.query(
      `SELECT invitation."id", invitation."email", invitation."role_id",
              invitation."invited_by", invitation."status", invitation."expires_at",
              invitation."last_sent_at", invitation."created_at",
              jsonb_build_object(
                'id', role."id", 'name', role."name", 'slug', role."slug"
              ) AS "role"
         FROM "tenant_invitations" invitation
         JOIN "roles" role ON role."id" = invitation."role_id"
        WHERE invitation."tenant_id" = $1
          AND invitation."status" = 'pending'
        ORDER BY invitation."created_at" DESC`,
      [tenantId],
    );
  }

  async resendInvitation(tenantId: string, id: string, invitedBy: string, actorRole = 'viewer') {
    const invitations = await this.repo!.manager.query(
      `SELECT invitation.*, role."slug" AS "role_slug", tenant."name" AS "tenant_name"
         FROM "tenant_invitations" invitation
         JOIN "roles" role ON role."id" = invitation."role_id"
         JOIN "tenants" tenant ON tenant."id" = invitation."tenant_id"
        WHERE invitation."id" = $1 AND invitation."tenant_id" = $2
          AND invitation."status" = 'pending' LIMIT 1`,
      [id, tenantId],
    ) as Array<Record<string, unknown>>;
    const invitation = invitations[0];
    if (!invitation) throw new NotFoundException('Convite pendente não encontrado');
    await this.assertCanAssignRole(tenantId, actorRole, String(invitation['role_slug']));

    const redirectBase = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5000';
    const { data, error } = await this.supabaseAdmin().auth.admin.generateLink({
      type: 'invite',
      email: String(invitation['email']),
      options: {
        redirectTo: `${redirectBase}/reset-password`,
        data: { tenant_id: tenantId, role: invitation['role_slug'] },
      },
    });
    if (error || !data.properties?.action_link) {
      throw new ConflictException(error?.message ?? 'Não foi possível reenviar o convite');
    }
    await this.mail.send({
      to: String(invitation['email']),
      subject: `Convite para ${String(invitation['tenant_name'])}`,
      html: this.mail.inviteHtml(String(invitation['tenant_name']), data.properties.action_link),
    });
    await this.repo!.manager.query(
      `UPDATE "tenant_invitations"
          SET "last_sent_at" = now(), "expires_at" = now() + interval '7 days',
              "invited_by" = $3, "updated_at" = now()
        WHERE "id" = $1 AND "tenant_id" = $2`,
      [id, tenantId, invitedBy],
    );
    return { resent: true };
  }

  async cancelInvitation(tenantId: string, id: string, actorRole = 'viewer') {
    const rows = await this.repo!.manager.query(
      `UPDATE "tenant_invitations" invitation
          SET "status" = 'cancelled', "cancelled_at" = now(), "updated_at" = now()
         FROM "roles" role
        WHERE invitation."id" = $1 AND invitation."tenant_id" = $2
          AND invitation."status" = 'pending'
          AND role."id" = invitation."role_id"
        RETURNING invitation."auth_user_id", role."slug" AS "role_slug"`,
      [id, tenantId],
    ) as Array<{ auth_user_id: string | null; role_slug: string }>;
    const invitation = rows[0];
    if (!invitation) throw new NotFoundException('Convite pendente não encontrado');
    await this.assertCanAssignRole(tenantId, actorRole, invitation.role_slug);
    if (invitation.auth_user_id) {
      await this.repo!.manager.query(
        `UPDATE "org_members"
            SET "is_active" = false, "updated_at" = now()
          WHERE "tenant_id" = $1 AND "auth_user_id" = $2`,
        [tenantId, invitation.auth_user_id],
      );
      await this.supabaseAdmin().auth.admin.updateUserById(invitation.auth_user_id, {
        app_metadata: {},
      });
      await this.invalidateMembershipCache(tenantId, invitation.auth_user_id);
    }
    return { cancelled: true };
  }

  async assignRole(
    tenantId: string,
    id: string,
    role: string,
    actorRole = 'viewer',
    expectedUpdatedAt?: string,
  ): Promise<OrgMemberEntity> {
    const current = await this.findById(tenantId, id);
    await this.assertCanAssignRole(tenantId, actorRole, role);
    if ((current.role === 'owner' || current.role === 'tenant_owner') && role !== current.role) {
      await this.assertNotLastOwner(tenantId, id);
    }
    // Dual-write (PASSO 12-G): grava `role` (legado) E `role_id` (canônico).
    // A autorização acima (assertCanAssignRole/assertNotLastOwner) roda ANTES
    // do CAS — a proteção de concorrência nunca substitui nem enfraquece essas
    // checagens, só evita que duas atribuições de papel concorrentes se
    // sobrescrevam silenciosamente.
    const roleId = await this.roleResolver.resolveOrThrow(tenantId, role, { membershipId: id });
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      { role, role_id: roleId, updated_at: new Date() } as any,
      expectedUpdatedAt,
      'Este utilizador foi alterado por outra pessoa desde que você o carregou. Recarregue e tente novamente.',
    );
    await this.invalidateMembershipCache(tenantId, current.auth_user_id);
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    const current = await this.findById(tenantId, id);
    if (current.role === 'owner' || current.role === 'tenant_owner') {
      await this.assertNotLastOwner(tenantId, id);
    }
    await this.repo!.update({ id, tenant_id: tenantId } as any, { is_active: false, updated_at: new Date() } as any);
    await this.invalidateMembershipCache(tenantId, current.auth_user_id);
    return { deleted: true };
  }

  /**
   * Task L: endpoint dedicado para reativar/desativar/suspender — extraído do
   * PATCH /users/:id genérico (ver comentário em UpdateUserDto). Mesma
   * proteção de último-owner que remove() já tinha, mais CAS opcional.
   */
  async setStatus(
    tenantId: string,
    id: string,
    status: string,
    expectedUpdatedAt?: string,
  ): Promise<OrgMemberEntity> {
    const current = await this.findById(tenantId, id);
    const willDeactivate = status !== 'active';
    if (willDeactivate && (current.role === 'owner' || current.role === 'tenant_owner')) {
      await this.assertNotLastOwner(tenantId, id);
    }
    await casUpdate(
      this.repo!,
      { id, tenant_id: tenantId } as any,
      { is_active: status === 'active', updated_at: new Date() } as any,
      expectedUpdatedAt,
      'Este utilizador foi alterado por outra pessoa desde que você o carregou. Recarregue e tente novamente.',
    );
    await this.invalidateMembershipCache(tenantId, current.auth_user_id);
    return this.findById(tenantId, id);
  }

  private async invalidateMembershipCache(
    tenantId: string,
    authUserId: string,
  ): Promise<void> {
    await this.rbacCache.delete(`membership:${tenantId}:${authUserId}`);
  }

  private async assertNotLastOwner(tenantId: string, membershipId: string): Promise<void> {
    const owners = await this.repo!
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId })
      .andWhere('m.id <> :membershipId', { membershipId })
      .andWhere('m.is_active = true')
      .andWhere('m.deleted_at IS NULL')
      .andWhere('m.role IN (:...roles)', { roles: ['owner', 'tenant_owner'] })
      .getCount();
    if (owners === 0) {
      throw new BadRequestException('O último owner ativo do tenant não pode ser removido ou rebaixado');
    }
  }

  private async assertCanAssignRole(
    tenantId: string,
    actorRole: string,
    targetRole: string,
  ): Promise<void> {
    const slugs = Array.from(new Set([actorRole, targetRole]));
    const roleRows = await this.repo!.manager.query(
      `SELECT "slug", "hierarchy_level", "is_assignable"
         FROM "roles"
        WHERE "slug" = ANY($1::text[])
          AND ("tenant_id" = $2 OR "tenant_id" IS NULL)
          AND "deleted_at" IS NULL
          AND "archived_at" IS NULL
        ORDER BY ("tenant_id" = $2) DESC`,
      [slugs, tenantId],
    ) as Array<{ slug: string; hierarchy_level: number; is_assignable: boolean | null }>;
    const levels = new Map<string, number>();
    const assignable = new Map<string, boolean>();
    for (const row of roleRows) {
      if (!levels.has(row.slug)) levels.set(row.slug, Number(row.hierarchy_level));
      if (!assignable.has(row.slug)) assignable.set(row.slug, row.is_assignable !== false);
    }
    // find-5cc269d3: is_assignable is authoritative and applies regardless of
    // actor role — super_admin (and any other non-assignable role) can never
    // be granted through this self-service path, closing the gap where
    // invite() filtered on is_assignable but assignRole() did not.
    if (assignable.get(targetRole) === false) {
      throw new BadRequestException(`O papel '${targetRole}' não pode ser atribuído por este fluxo`);
    }
    const actorLevel = levels.get(actorRole) ?? ROLE_HIERARCHY[actorRole] ?? 0;
    const targetLevel = levels.get(targetRole) ?? ROLE_HIERARCHY[targetRole] ?? 0;
    if (targetLevel >= actorLevel && actorRole !== 'owner' && actorRole !== 'tenant_owner' && actorRole !== 'super_admin') {
      throw new BadRequestException('Não é permitido atribuir um papel igual ou superior ao próprio nível');
    }
  }

  private supabaseAdmin() {
    return createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }
}
