/**
 * modules/assets/assets.module.ts
 *
 * Module of the central asset model + Asset Linking Skill.
 * DatabaseModule / DomainEventsModule / SkillsModule are @Global — DATA_SOURCE,
 * EventsService and SkillRunService are injectable without an explicit import.
 */

import { Module } from '@nestjs/common';
import { AssetLinkingService } from './asset-linking.service';
import { AssetClassificationService } from './asset-classification.service';
import { ReleaseReadinessService } from './release-readiness.service';
import { AssetLinkingHandler } from './handlers/asset-linking.handler';
import { AssetsController } from './assets.controller';

@Module({
  controllers: [AssetsController],
  providers: [AssetLinkingService, AssetClassificationService, ReleaseReadinessService, AssetLinkingHandler],
  exports: [AssetLinkingService, AssetClassificationService, ReleaseReadinessService],
})
export class AssetsModule {}
