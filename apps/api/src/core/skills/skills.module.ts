/**
 * core/skills/skills.module.ts
 *
 * GLOBAL skill execution infrastructure. Exports SkillRunService so that
 * any operational skill in the system persists execution/logs and emits
 * audit events. Exposes nothing to the end user.
 *
 * DatabaseModule (@Global) and DomainEventsModule (@Global) provide DATA_SOURCE
 * and EventsService — they do not need to be imported here.
 */

import { Global, Module } from '@nestjs/common';
import { SkillRunService } from './skill-run.service';

@Global()
@Module({
  providers: [SkillRunService],
  exports: [SkillRunService],
})
export class SkillsModule {}
