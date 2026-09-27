import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const MARKETING_ASSET_TYPES = [
  'AUDIO',
  'COVER',
  'ARTWORK',
  'PHOTO',
  'REEL',
  'TEASER',
  'VISUALIZER',
  'LYRIC_VIDEO',
  'MUSIC_VIDEO',
  'PRESS_KIT',
  'DOCUMENT',
  'INSTITUTIONAL',
  'AD_CREATIVE',
  'LOGO',
  'CORPORATE_MATERIAL',
  'OTHER',
] as const;

export const MARKETING_ASSET_STATUSES = ['draft', 'in_review', 'approved', 'rejected', 'archived'] as const;
export const MARKETING_ASSET_APPROVAL_STATUSES = ['approved', 'rejected', 'revision_requested'] as const;

export class CreateMarketingAssetDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ enum: MARKETING_ASSET_TYPES })
  @IsIn(MARKETING_ASSET_TYPES)
  assetType!: string;

  @ApiProperty()
  @IsString()
  fileUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sizeBytes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  marketingProjectId?: string | null;

  @ApiPropertyOptional({ description: 'Music project the produced asset originates from.' })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional({ description: 'Operational task that generated the asset.' })
  @IsOptional()
  @IsUUID()
  taskId?: string | null;

  @ApiPropertyOptional({ description: 'Department that produced the asset: design, audiovisual, marketing, content, etc.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceDepartment?: string | null;

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
  campaignId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  creativeRequestId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  audiovisualProjectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceUploadId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateMarketingAssetDto extends PartialType(CreateMarketingAssetDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changeNotes?: string | null;

  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedUpdatedAt?: string;
}

export class QueryMarketingAssetDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MARKETING_ASSET_TYPES })
  @IsOptional()
  @IsIn(MARKETING_ASSET_TYPES)
  assetType?: string;

  @ApiPropertyOptional({ enum: MARKETING_ASSET_STATUSES })
  @IsOptional()
  @IsIn(MARKETING_ASSET_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  marketingProjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Music project the produced asset originates from.' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Operational task that generated the asset.' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({ description: 'Department that produced the asset.' })
  @IsOptional()
  @IsString()
  sourceDepartment?: string;
}

export class DecideMarketingAssetApprovalDto {
  @ApiProperty({ enum: MARKETING_ASSET_APPROVAL_STATUSES })
  @IsIn(MARKETING_ASSET_APPROVAL_STATUSES)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
