import { Module }                  from '@nestjs/common';
import { ConversationsController }  from './conversations.controller';
import { MusicChatAutomationController } from './musicchat-automation.controller';
import { ConversationsService }     from './conversations.service';
import { MusicChatAutomationService } from './musicchat-automation.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppModule } from '../integrations/whatsapp/whatsapp.module';
import { AIModule } from '../ai/ai.module';
import { MusicChatAutomationInsightsAutomation } from '../../core/automation/musicchat-automation-insights.automation';

@Module({
  imports:     [NotificationsModule, WhatsAppModule, AIModule],
  controllers: [ConversationsController, MusicChatAutomationController],
  providers:   [ConversationsService, MusicChatAutomationService, MusicChatAutomationInsightsAutomation],
  exports:     [ConversationsService, MusicChatAutomationService],
})
export class ConversationsModule {}
