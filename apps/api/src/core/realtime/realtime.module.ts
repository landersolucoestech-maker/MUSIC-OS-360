import { Module, Global } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

/**
 * RealtimeModule — @Global() so RealtimeService is injectable in
 * any module without having to import RealtimeModule explicitly.
 * Replaces WsModule (Socket.IO) — see realtime.service.ts for the why.
 *
 * Exports RealtimeService for use in:
 *   - NotificationsProcessor (emits notification:new)
 *   - BillingService, DunningService (emit billing:*)
 *   - ConversationsService (emits conversation:*)
 *   - AIJobsProcessor (emits ai:job:completed)
 */
@Global()
@Module({
  providers: [RealtimeService],
  exports:   [RealtimeService],
})
export class RealtimeModule {}
