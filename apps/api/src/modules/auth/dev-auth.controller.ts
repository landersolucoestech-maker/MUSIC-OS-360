import {
  Controller,
  Get,
  ForbiddenException,
  Inject,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { DataSource, Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { isProdLike } from '../../core/config/runtime-environment';
import { Public } from '../../core/decorators/public.decorator';
import { DATA_SOURCE } from '../../database/database.module';
import { TenantEntity, OrgMemberEntity } from '../../database/entities';

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

  /**
   * Explicit opt-in (default OFF) + credentials from env (never hardcoded). Runs
   * before any DB/Supabase access so a disabled/misconfigured endpoint touches nothing.
   * This endpoint issues an OWNER token: it must never be reachable by default.
   */
  private resolveDevCredentials(): { email: string; password: string } {
    const enabled = this.config.get<string>('DEV_AUTH_ENDPOINT_ENABLED') ?? process.env.DEV_AUTH_ENDPOINT_ENABLED;
    if (enabled !== 'true') {
      throw new NotFoundException();
    }
    const email = (this.config.get<string>('DEV_AUTH_EMAIL') ?? process.env.DEV_AUTH_EMAIL ?? '').trim();
    const password = this.config.get<string>('DEV_AUTH_PASSWORD') ?? process.env.DEV_AUTH_PASSWORD ?? '';
    if (!email || !password) {
      throw new ServiceUnavailableException(
        'Dev auth endpoint is enabled but DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD are not both set.',
      );
    }
    return { email, password };
  }

  @Public()
  @Get('token')
  async token() {
    this.assertDev();
    const { email: devEmail, password: devPassword } = this.resolveDevCredentials();

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
    let auth = await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword });

    if (auth.error) {
      // Create user if not found
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email:         devEmail,
        password:      devPassword,
        email_confirm: true,
        app_metadata:  { org_id: orgId, role: 'owner' },
      });

      if (createErr) {
        // Detail stays server-side only; the client never sees the upstream auth error text.
        this.logger.error(`Failed to create dev user: ${createErr.message}`);
        throw new ForbiddenException('Could not create dev user.');
      }

      this.logger.log(`Dev user created: ${created.user?.id}`);
      auth = await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword });
    } else {
      // Ensure app_metadata.org_id is up to date (tenant may have changed)
      const userId = auth.data.user?.id;
      if (userId) {
        await supabase.auth.admin.updateUserById(userId, {
          app_metadata: { org_id: orgId, role: 'owner' },
        });
        // Re-login to get a fresh token with updated claims
        auth = await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword });
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
        // Dual-write (STEP 12-G): resolves the canonical role_id of 'owner' (seeded global role).
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
          email:         devEmail,
          full_name:     'Dev User',
          role:          'owner',
          role_id:       ownerRoleId as any,
          is_active:     true,
          joined_at:     new Date(),
        } as any);
        await this.memberRepo.save(member as any);
        this.logger.log(`Dev member registered in tenant ${tenant.slug} (role_id=${ownerRoleId ?? 'NULL'})`);
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
          email: devEmail,
        },
        secret,
        { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: '1h' },
      );
      tokenSource = 'dev-local';
      this.logger.warn('Dev Supabase token with mismatched org_id; issuing a consistent local token for dev-auth.');
    }

    return {
      token,
      tenantId,
      orgId,
      user: {
        id:    auth.data.user?.id,
        email: devEmail,
        role:  'owner',
        slug:  tenant?.slug,
      },
      _dev: true,
      tokenSource,
    };
  }
}
