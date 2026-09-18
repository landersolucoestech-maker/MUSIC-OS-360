/**
 * modules/auth/auth.module.ts
 *
 * Módulo de autenticação JWT do MUSIC OS 360.
 * Fornece endpoints de login/registro/refresh/logout.
 *
 * Os guards globais (JwtAuthGuard, TenantGuard, RolesGuard)
 * são registados no AppModule via APP_GUARD para cobertura total.
 */

import { Module } from '@nestjs/common';
import { isProdLike } from '../../core/config/runtime-environment';
import { RbacModule } from '../../core/rbac/rbac.module';
import { DatabaseModule } from '../../database/database.module';
import { AuthController } from './auth.controller';
import { DevAuthController } from './dev-auth.controller';
import { AuthContextService } from './auth-context.service';
import { OnboardingService } from './onboarding.service';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';
import { AuthPasswordService } from './auth-password.service';
import { AIModule } from '../ai/ai.module';
import { OnboardingCroAutomation } from '../../core/automation/onboarding-cro.automation';

// DevAuthController is only registered outside production — the route must not
// exist at all in production (defense-in-depth beyond the 403 guard in the controller).
const DEV_CONTROLLERS =
  !isProdLike(process.env['NODE_ENV']) ? [DevAuthController] : [];

@Module({
  imports:     [RbacModule, DatabaseModule, AIModule],
  controllers: [AuthController, ...DEV_CONTROLLERS],
  providers:   [
    AuthContextService,
    OnboardingService,
    WorkspaceProvisioningService,
    AuthPasswordService,
    OnboardingCroAutomation,
  ],
  exports:     [AuthContextService],
})
export class AuthModule {}
