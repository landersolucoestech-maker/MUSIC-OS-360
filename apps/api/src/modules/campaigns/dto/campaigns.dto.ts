import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsNumber, IsDate, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus } from '@music-os-360/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { HasSafeUrlValues } from '../../../common/validators/safe-url.validation';

const TYPES    = ['social', 'ads', 'email', 'influencer', 'pr', 'launch', 'other'] as const;
const STATUSES = Object.values(CampaignStatus) as string[];

export class CreateCampaignDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  artistId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(()=>Number) budget?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;
  @ApiPropertyOptional() @IsOptional() platforms?: unknown[];
  @ApiPropertyOptional() @IsOptional() @HasSafeUrlValues() metadata?: Record<string, unknown>;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {
  @ApiPropertyOptional({ enum: CampaignStatus }) @IsOptional() @IsIn(STATUSES) status?: string;
}

export class QueryCampaignDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artistId?: string;
}
