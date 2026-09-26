import { Module } from '@nestjs/common';
import { WhatsAppCloudProvider } from './whatsapp-cloud.provider';

/**
 * Extracted from IntegrationsModule so ConversationsModule can inject
 * WhatsAppCloudProvider (real escalation sending — Decision Gate item 14)
 * without a circular dependency: IntegrationsModule already imports ConversationsModule.
 */
@Module({
  providers: [WhatsAppCloudProvider],
  exports:   [WhatsAppCloudProvider],
})
export class WhatsAppModule {}
