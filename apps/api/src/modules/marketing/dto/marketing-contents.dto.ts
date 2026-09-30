import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  canonicalMarketingContentMetadata,
  canonicalMarketingContentStatus,
  canonicalMarketingContentTargetType,
  canonicalMarketingContentType,
  MARKETING_CONTENT_APPROVALS,
  MARKETING_CONTENT_STATUSES,
  MARKETING_CONTENT_TARGET_TYPES,
  MARKETING_CONTENT_TYPES,
} from '../marketing-vocabulary';

export const MARKETING_CONTENT_CHANNELS = ['instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'threads'] as const;
export const MARKETING_PUBLICATION_STATUSES = ['pending', 'queued', 'publishing', 'published', 'failed', 'cancelled'] as const;

/** `metadata` is free-form except `approval`, which the database restricts (chk_marketing_content_posts_metadata_approval). */
@ValidatorConstraint({ name: 'marketingContentMetadata', async: false })
class MarketingContentMetadataConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || typeof value !== 'object') return true; // @IsObject reports the wrong type
    const approval = (value as Record<string, unknown>).approval;
    return approval === undefined || approval === null ||
      (typeof approval === 'string' && (MARKETING_CONTENT_APPROVALS as readonly string[]).includes(approval));
  }

  defaultMessage(): string {
    return `metadata.approval must be one of the following values: ${MARKETING_CONTENT_APPROVALS.join(', ')}`;
  }
}

export class MarketingContentFileDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kind?: string;
}

export class CreateMarketingContentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ enum: MARKETING_CONTENT_TARGET_TYPES })
  @Transform(canonicalMarketingContentTargetType)
  @IsIn(MARKETING_CONTENT_TARGET_TYPES)
  targetType!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  targetName!: string;

  @ApiProperty({ enum: MARKETING_CONTENT_CHANNELS })
  @IsIn(MARKETING_CONTENT_CHANNELS)
  channel!: string;

  @ApiProperty({ enum: MARKETING_CONTENT_TYPES })
  @Transform(canonicalMarketingContentType)
  @IsIn(MARKETING_CONTENT_TYPES)
  type!: string;

  @ApiPropertyOptional({ enum: MARKETING_CONTENT_STATUSES })
  @IsOptional()
  @Transform(canonicalMarketingContentStatus)
  @IsIn(MARKETING_CONTENT_STATUSES)
  status?: string;

  @ApiProperty()
  @IsDateString()
  publishDate!: string;

  @ApiProperty()
  @IsString()
  publishTime!: string;

  @ApiProperty()
  @IsString()
  copy!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  owner?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  releaseId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  format?: string | null;

  @ApiPropertyOptional({ type: [MarketingContentFileDto] })
  @IsOptional()
  @IsArray()
  files?: MarketingContentFileDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(canonicalMarketingContentMetadata)
  @IsObject()
  @Validate(MarketingContentMetadataConstraint)
  metadata?: Record<string, unknown>;
}

export class UpdateMarketingContentDto extends PartialType(CreateMarketingContentDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryMarketingContentDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MARKETING_CONTENT_CHANNELS })
  @IsOptional()
  @IsIn(MARKETING_CONTENT_CHANNELS)
  channel?: string;

  @ApiPropertyOptional({ enum: MARKETING_CONTENT_STATUSES })
  @IsOptional()
  @Transform(canonicalMarketingContentStatus)
  @IsIn(MARKETING_CONTENT_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
