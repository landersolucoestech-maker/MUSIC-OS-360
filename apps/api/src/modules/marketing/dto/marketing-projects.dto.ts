import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const MARKETING_PROJECT_TYPES = [
  'MUSIC_PROJECT',
  'ARTIST',
  'COMPANY',
  'LABEL',
  'PUBLISHER',
  'STUDIO',
  'EVENT',
  'CONTENT',
  'CAMPAIGN',
  'BRANDING',
  'CORPORATE',
  'PRODUCT',
  'CUSTOM',
] as const;

export const MARKETING_PROJECT_STATUSES = [
  'draft',
  'planning',
  'active',
  'paused',
  'completed',
  'cancelled',
  'archived',
] as const;

export const MARKETING_PROJECT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export class CreateMarketingProjectDto {
  @ApiProperty({ enum: MARKETING_PROJECT_TYPES })
  @IsIn(MARKETING_PROJECT_TYPES)
  type!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ enum: MARKETING_PROJECT_STATUSES })
  @IsOptional()
  @IsIn(MARKETING_PROJECT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: MARKETING_PROJECT_PRIORITIES })
  @IsOptional()
  @IsIn(MARKETING_PROJECT_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceProjectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  artistId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  labelId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  publisherId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studioId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  eventId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  goals?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateMarketingProjectDto extends PartialType(CreateMarketingProjectDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryMarketingProjectDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MARKETING_PROJECT_TYPES })
  @IsOptional()
  @IsIn(MARKETING_PROJECT_TYPES)
  type?: string;

  @ApiPropertyOptional({ enum: MARKETING_PROJECT_STATUSES })
  @IsOptional()
  @IsIn(MARKETING_PROJECT_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceProjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}
