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
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  canonicalMarketingTaskKind,
  canonicalMarketingTaskMetadata,
  canonicalMarketingTaskPriority,
  canonicalMarketingTaskStatus,
  MARKETING_TASK_PRIORITIES,
  MARKETING_TASK_STATUSES,
} from '../marketing-vocabulary';
import { HasSafeUrlValues } from '../../../common/validators/safe-url.validation';

export class RunCopywritingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tone?: string;

  @ApiPropertyOptional({ type: [String], description: 'Real facts to use in the text — the skill never invents facts outside this list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceFacts?: string[];
}

export class CreateMarketingTaskDto {
  @ApiProperty()
  @IsUUID()
  marketingProjectId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ enum: MARKETING_TASK_STATUSES })
  @IsOptional()
  @Transform(canonicalMarketingTaskStatus)
  @IsIn(MARKETING_TASK_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: MARKETING_TASK_PRIORITIES })
  @IsOptional()
  @Transform(canonicalMarketingTaskPriority)
  @IsIn(MARKETING_TASK_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({ description: 'Task kind. Free-form on purpose (the API itself writes cover_art, strategy_action, ...); deprecated Portuguese web kinds are mapped to the canonical English one.' })
  @IsOptional()
  @Transform(canonicalMarketingTaskKind)
  @IsString()
  kind?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  dependencies?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(canonicalMarketingTaskMetadata)
  @IsObject()
  @HasSafeUrlValues()
  metadata?: Record<string, unknown>;
}

export class UpdateMarketingTaskDto extends PartialType(CreateMarketingTaskDto) {
  /** Optimistic concurrency (Task K) — see optimistic-update.util.ts. Optional. */
  @ApiPropertyOptional() @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryMarketingTaskDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  marketingProjectId?: string;

  @ApiPropertyOptional({ enum: MARKETING_TASK_STATUSES })
  @IsOptional()
  @Transform(canonicalMarketingTaskStatus)
  @IsIn(MARKETING_TASK_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;
}
