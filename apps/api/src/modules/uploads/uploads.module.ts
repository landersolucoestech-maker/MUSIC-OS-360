/**
 * modules/uploads/uploads.module.ts
 *
 * Module for presigned uploads via Cloudflare R2.
 * StorageModule is @Global — StorageService is injectable without an explicit import.
 * DatabaseModule is @Global — DATA_SOURCE is injectable without an explicit import.
 */

import { Module } from '@nestjs/common';
import { UploadsController }   from './uploads.controller';
import { UploadEventsHandler } from './handlers/upload-events.handler';

@Module({
  controllers: [UploadsController],
  providers:   [UploadEventsHandler],
})
export class UploadsModule {}
