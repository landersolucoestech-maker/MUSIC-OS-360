import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentMember } from '../../core/decorators/current-member.decorator';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { AuthContextService } from './auth-context.service';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { OnboardingService } from './onboarding.service';
import { AuthBootstrap } from '../../core/decorators/auth-bootstrap.decorator';
import { ProvisionWorkspaceDto } from './dto/provision-workspace.dto';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';
import { AuthPasswordService } from './auth-password.service';
import { ChangeRequiredPasswordDto } from './dto/change-required-password.dto';
import { OnboardingCroAutomation } from '../../core/automation/onboarding-cro.automation';

function extractBearerToken(req: Request): string | null {
  const header = req.headers['authorization'];
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
}

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly context: AuthContextService,
    private readonly onboarding: OnboardingService,
    private readonly provisioning: WorkspaceProvisioningService,
    private readonly password: AuthPasswordService,
    private readonly onboardingCro: OnboardingCroAutomation,
  ) {}

  @Get('context')
  @ApiOperation({ summary: 'Obter contexto SaaS do utilizador autenticado' })
  getContext(
    @CurrentUser() user: JwtAuth,
    @CurrentTenant() tenant: Record<string, unknown>,
    @CurrentMember() member: Record<string, unknown>,
  ) {
    return this.context.build(user, tenant, member);
  }

  @Patch('provision-workspace')
  @AuthBootstrap()
  @ApiOperation({ summary: 'Provisionar o primeiro workspace do usuário autenticado' })
  provisionWorkspace(
    @CurrentUser() user: JwtAuth,
    @Body() dto: ProvisionWorkspaceDto,
  ) {
    return this.provisioning.provision(user, dto);
  }

  @Post('change-required-password')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Troca atômica da senha obrigatória do primeiro login: valida, troca fisicamente no Supabase Auth e limpa must_change_password na mesma operação' })
  changeRequiredPassword(
    @CurrentUser() user: JwtAuth,
    @CurrentTenant() tenant: Record<string, unknown>,
    @Req() req: Request,
    @Body() dto: ChangeRequiredPasswordDto,
  ) {
    const tenantId = typeof tenant?.['id'] === 'string' ? tenant['id'] as string : null;
    return this.password.changeRequiredPassword(user, tenantId, dto, extractBearerToken(req));
  }

  @Patch('onboarding')
  @RequireRole('owner')
  @Audit('setting.onboarding_completed')
  @ApiOperation({ summary: 'Concluir onboarding inicial do workspace' })
  completeOnboarding(
    @CurrentUser() user: JwtAuth,
    @CurrentTenant() tenant: Record<string, unknown>,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.onboarding.complete(
      String(tenant['id']),
      String(tenant['org_id']),
      user.userId,
      dto,
    );
  }

  @Post('onboarding/ai/progress-analysis')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'AI Skill onboarding-cro — análise do progresso real de onboarding deste tenant' })
  runOnboardingProgressAnalysis(
    @CurrentUser() user: JwtAuth,
    @CurrentTenant() tenant: Record<string, unknown>,
  ) {
    return this.onboardingCro.run(String(tenant['id']), user.userId);
  }
}
