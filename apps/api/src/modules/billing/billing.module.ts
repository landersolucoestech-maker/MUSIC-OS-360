/**
 * billing/billing.module.ts
 *
 * Stripe Billing module — checkout, portal, webhooks, per-plan features.
 * RealtimeService is @Global() — RealtimeModule does not need to be imported explicitly.
 */

import { Module }           from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService }    from './billing.service';
import { DunningService }    from './dunning.service';
import { BillingEnforcementService } from './billing-enforcement.service';
import { BillingPlansService } from './billing-plans.service';

@Module({
  controllers: [BillingController],
  providers:   [BillingService, BillingEnforcementService, DunningService, BillingPlansService],
  exports:     [BillingService, BillingEnforcementService, DunningService, BillingPlansService],
})
export class BillingModule {}
