import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService }    from './clients.service';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AIModule } from '../ai/ai.module';
import { DealsCrmAutomation } from '../../core/automation/deals-crm.automation';

@Module({
  imports: [ActivityLogsModule, AIModule],
  controllers: [ClientsController],
  providers: [ClientsService, DealsCrmAutomation],
  exports: [ClientsService],
})
export class ClientsModule {}
