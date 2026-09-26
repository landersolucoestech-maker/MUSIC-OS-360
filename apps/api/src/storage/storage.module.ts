/**
 * storage/storage.module.ts
 *
 * Cloudflare R2 (S3-compatible) module for file storage.
 * Uses @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner.
 *
 * Credentials: R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY
 * Bucket:      R2_BUCKET_NAME (default: music-os-360)
 * Public URL:  R2_PUBLIC_URL
 */

import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';
import { R2_CLIENT, R2_BUCKET, R2_PUBLIC_URL } from './storage.tokens';

// Re-export from tokens file — services should import from storage.tokens
// to avoid circular deps (service → module → service).
export { R2_CLIENT, R2_BUCKET, R2_PUBLIC_URL } from './storage.tokens';

@Global()
@Module({
  providers: [
    {
      provide: R2_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger    = new Logger('StorageModule');
        const accountId = config.get<string>('R2_ACCOUNT_ID');
        const accessKey = config.get<string>('R2_ACCESS_KEY');
        const secretKey = config.get<string>('R2_SECRET_KEY');

        if (!accountId || !accessKey || !secretKey) {
          logger.warn(
            'R2_ACCOUNT_ID / R2_ACCESS_KEY / R2_SECRET_KEY não configurados — storage desativado',
          );
          return null;
        }

        const client = new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId:     accessKey,
            secretAccessKey: secretKey,
          },
          // SDK v3 (>=3.729) computes a checksum by default (WHEN_SUPPORTED).
          // With presigned URLs this breaks: the real body only exists when the
          // client makes the PUT later, so the signed checksum is that of an empty
          // body — every real upload fails with SignatureDoesNotMatch. R2 also
          // does not support the composite checksums the SDK would try to use.
          requestChecksumCalculation: 'WHEN_REQUIRED',
        });

        logger.log(`Cloudflare R2 conectado (account: ${accountId})`);
        return client;
      },
    },
    {
      provide: R2_BUCKET,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('R2_BUCKET_NAME') ?? 'music-os-360',
    },
    {
      provide: R2_PUBLIC_URL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('R2_PUBLIC_URL') ?? null,
    },
    StorageService,
  ],
  exports: [R2_CLIENT, R2_BUCKET, R2_PUBLIC_URL, StorageService],
})
export class StorageModule {}
