import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsIn, IsUrl, MaxLength, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

const TASK_STATUSES   = ['pending', 'in_progress', 'done', 'cancelled'] as const;
// Campaign-task scale (low/medium/high/urgent). Deliberately NOT the shared WORK_PRIORITIES
// (low/normal/high/urgent) nor RELATIONSHIP_PRIORITIES: it differs in meaning/values, and merging
// the medium/normal scales is a pending owner decision (technical normalization handoff, finding 11).
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const ASSET_TYPES     = ['image', 'video', 'audio', 'document', 'link', 'other'] as const;

export class CreateCampaignTaskDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(TASK_PRIORITIES) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) assigned_to?: string;
  @ApiPropertyOptional() @IsOptional() due_date?: string;
}

export class UpdateCampaignTaskDto extends PartialType(CreateCampaignTaskDto) {
  @ApiPropertyOptional({ enum: TASK_STATUSES }) @IsOptional() @IsIn(TASK_STATUSES) status?: string;
}

export class CreateCampaignAssetDto {
  @ApiProperty() @IsString() @MaxLength(500) name!: string;
  @ApiProperty({ enum: ASSET_TYPES }) @IsIn(ASSET_TYPES) asset_type!: string;
  @ApiProperty() @IsString() file_url!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class QueryCampaignTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigned_to?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
