import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const MARKETING_CONTENT_CHANNELS = ['instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'threads'] as const;
export const MARKETING_CONTENT_STATUSES = ['rascunho', 'agendado', 'publicado', 'cancelado', 'falhou'] as const;
export const MARKETING_PUBLICATION_STATUSES = ['pending', 'queued', 'publishing', 'published', 'failed', 'cancelled'] as const;

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

  @ApiProperty()
  @IsString()
  targetType!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  targetName!: string;

  @ApiProperty({ enum: MARKETING_CONTENT_CHANNELS })
  @IsIn(MARKETING_CONTENT_CHANNELS)
  channel!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiPropertyOptional({ enum: MARKETING_CONTENT_STATUSES })
  @IsOptional()
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
  @IsObject()
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
  @IsIn(MARKETING_CONTENT_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
