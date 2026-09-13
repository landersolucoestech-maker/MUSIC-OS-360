import { Module } from '@nestjs/common';
import { LeadsController }   from './leads.controller';
import { PublicRegistrationController } from './public-registration.controller';
import { LeadsService }      from './leads.service';
import { LeadEventsHandler } from './handlers/lead-events.handler';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports:     [ActivityLogsModule, BillingModule],
  controllers: [LeadsController, PublicRegistrationController],
  providers:   [LeadsService, LeadEventsHandler],
  exports:     [LeadsService],
})
export class LeadsModule {}
