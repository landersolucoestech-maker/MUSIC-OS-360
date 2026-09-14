import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsDate, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const STATUSES = ['draft', 'review', 'approved', 'rejected', 'archived'] as const;

export class CreateBriefingDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() campaignId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() objectives?: unknown[];
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional() @Type(() => Date) @IsDate() dueAt?: Date;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class UpdateBriefingDto extends PartialType(CreateBriefingDto) {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: string;
}

// find-2f63ad75: campaignId was declared here but BriefingsService.list()
// never reads it (silently-ignored-filter anti-pattern, see events.dto.ts's
// own fix for the same bug class) -- removed. artist_id is a real filter
// the service already implements but had no DTO field to reach it through
// (search/ascending/offset/limit already come from PaginationDto).
export class QueryBriefingDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() artist_id?: string;
}
