/**
 * modules/auth/auth.module.ts
 *
 * JWT authentication module of MUSIC OS 360.
 * Provides login/register/refresh/logout endpoints.
 *
 * The global guards (JwtAuthGuard, TenantGuard, RolesGuard)
 * are registered in AppModule via APP_GUARD for full coverage.
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
import { AiModule } from '../ai/ai.module';
import { OnboardingCroAutomation } from '../../core/automation/onboarding-cro.automation';

// DevAuthController is only registered outside production — the route must not
// exist at all in production (defense-in-depth beyond the 403 guard in the controller).
const DEV_CONTROLLERS =
  !isProdLike(process.env['NODE_ENV']) ? [DevAuthController] : [];

@Module({
  imports:     [RbacModule, DatabaseModule, AiModule],
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
