import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';
import {
  ACCEPTED_GOAL_PERIODS,
  ACCEPTED_GOAL_STATUSES,
  ACCEPTED_GOAL_TYPES,
  GOAL_PERIODS,
  GOAL_STATUSES,
  GOAL_TYPES,
} from '../artist-goal-legacy.mapper';

export class CreateArtistGoalDto {
  @IsString()
  artist_id: string;

  @IsString()
  title: string;

  @ApiProperty({ enum: GOAL_TYPES, description: 'Deprecated Portuguese values are still accepted and mapped.' })
  @IsIn(ACCEPTED_GOAL_TYPES)
  type: string;

  @IsOptional()
  @IsString()
  target_value?: string;

  @IsOptional()
  @IsString()
  current_value?: string;

  @ApiPropertyOptional({ enum: GOAL_STATUSES, description: 'Deprecated Portuguese values are still accepted and mapped.' })
  @IsOptional()
  @IsIn(ACCEPTED_GOAL_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: GOAL_PERIODS })
  @IsOptional()
  @IsIn(ACCEPTED_GOAL_PERIODS)
  period?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of period.' })
  @IsOptional()
  @IsIn(ACCEPTED_GOAL_PERIODS)
  periodo?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
