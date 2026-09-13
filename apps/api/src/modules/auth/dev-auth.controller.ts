import { Controller, Get, ForbiddenException, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { DataSource, Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { isProdLike } from '../../core/config/runtime-environment';
import { Public } from '../../core/decorators/public.decorator';
import { DATA_SOURCE } from '../../database/database.module';
import { TenantEntity, OrgMemberEntity } from '../../database/entities';

const DEV_EMAIL    = 'smoke-test@musicos360.dev';
const DEV_PASSWORD = 'SmokeTest123!';

@Controller('dev-auth')
export class DevAuthController implements OnModuleInit {
  private readonly logger = new Logger(DevAuthController.name);
  private tenantRepo: Repository<TenantEntity> | null = null;
  private memberRepo: Repository<OrgMemberEntity> | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
  ) {}

  onModuleInit(): void {
    if (this.ds) {
      this.tenantRepo = this.ds.getRepository(TenantEntity);
      this.memberRepo = this.ds.getRepository(OrgMemberEntity);
    }
  }

  private assertDev(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
    if (isProdLike(nodeEnv)) {
      throw new ForbiddenException(`Dev auth endpoint is disabled in ${nodeEnv}`);
    }
  }

  @Public()
  @Get('token')
  async token() {
    this.assertDev();

    // Resolve the first active tenant to get the real org_id. `active` here is a
    // lifecycle-only signal (not a billing/subscription-status check, same
    // distinction documented in AutentiqueService/DocuSignService/
    // ExternalDataExchangeService/TenantGuard) — fine to use as a "pick any
    // healthy tenant" proxy because this endpoint is dev-only tooling
    // (assertDev() above), never reachable in a real environment.
    const tenant = await this.tenantRepo
      ?.createQueryBuilder('t')
      .where('t.deleted_at IS NULL AND t.active = true')
      .orderBy('t.created_at', 'ASC')
      .getOne();

    const fallbackTenantId = this.config.get<string>('SEED_TENANT_ID') ?? '10000000-0000-0000-0000-000000000002';
    const orgId    = tenant ? String((tenant as any).org_id ?? tenant.id) : fallbackTenantId;
    const tenantId = tenant?.id ?? fallbackTenantId;

    const supabase = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );

    // Try login first
    let auth = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });

    if (auth.error) {
      // Create user if not found
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email:         DEV_EMAIL,
        password:      DEV_PASSWORD,
        email_confirm: true,
        app_metadata:  { org_id: orgId, role: 'owner' },
      });

      if (createErr) {
        this.logger.error('Falha ao criar usuário dev:', createErr.message);
        throw new ForbiddenException(`Não foi possível criar usuário dev: ${createErr.message}`);
      }

      this.logger.log(`Usuário dev criado: ${created.user?.id}`);
      auth = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
    } else {
      // Ensure app_metadata.org_id is up to date (tenant may have changed)
      const userId = auth.data.user?.id;
      if (userId) {
        await supabase.auth.admin.updateUserById(userId, {
          app_metadata: { org_id: orgId, role: 'owner' },
        });
        // Re-login to get a fresh token with updated claims
        auth = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
      }
    }

    // Ensure org_member row exists so TenantGuard resolves
    if (auth.data.user && this.memberRepo && tenant) {
      const userId = auth.data.user.id;
      const exists = await this.memberRepo
        .createQueryBuilder('m')
        .where('m.tenant_id = :tid AND m.auth_user_id = :uid', { tid: tenant.id, uid: userId })
        .getOne();

      if (!exists) {
        // Dual-write (PASSO 12-G): resolve role_id canônico de 'owner' (role global seedada).
        const ownerRows = this.ds
          ? (await this.ds.query(
              `SELECT "id" FROM "roles" WHERE "slug" = 'owner' AND "tenant_id" IS NULL AND "deleted_at" IS NULL AND "archived_at" IS NULL LIMIT 1`,
            )) as Array<{ id: string }>
          : [];
        const ownerRoleId = ownerRows[0]?.id ?? null;
        const member = this.memberRepo.create({
          org_id:        orgId as any,
          tenant_id:     tenant.id as any,
          auth_user_id:  userId,
          email:         DEV_EMAIL,
          full_name:     'Dev User',
          role:          'owner',
          role_id:       ownerRoleId as any,
          is_active:     true,
          joined_at:     new Date(),
        } as any);
        await this.memberRepo.save(member as any);
        this.logger.log(`Membro dev registado no tenant ${tenant.slug} (role_id=${ownerRoleId ?? 'NULL'})`);
      }
    }

    let token = auth.data.session?.access_token;
    let tokenSource: 'supabase' | 'dev-local' = 'supabase';
    const tokenClaims = token ? jwt.decode(token) as { app_metadata?: { org_id?: string } } | null : null;

    if (tokenClaims?.app_metadata?.org_id !== orgId) {
      const userId = auth.data.user?.id;
      const secret = this.config.getOrThrow<string>('ENCRYPTION_KEY');
      token = jwt.sign(
        {
          sub: userId,
          session_id: `dev-auth-${userId}`,
          app_metadata: { org_id: orgId, role: 'owner' },
          email: DEV_EMAIL,
        },
        secret,
        { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: '1h' },
      );
      tokenSource = 'dev-local';
      this.logger.warn('Token Supabase dev com org_id divergente; emitindo token local coerente para dev-auth.');
    }

    return {
      token,
      tenantId,
      orgId,
      user: {
        id:    auth.data.user?.id,
        email: DEV_EMAIL,
        role:  'owner',
        slug:  tenant?.slug,
      },
      _dev: true,
      tokenSource,
    };
  }
}
