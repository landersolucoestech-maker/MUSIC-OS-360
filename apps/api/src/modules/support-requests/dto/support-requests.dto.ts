import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { SupportTicketPriority } from '@music-os-360/types';

const TYPES = ['feature', 'bug', 'question', 'billing', 'integration'] as const;
// Support ticket scale: the shared SupportTicketPriority enum (packages/types enums.ts).
const PRIORITIES = Object.values(SupportTicketPriority);

export class CreateSupportRequestDto {
  @ApiProperty() @IsString() @MaxLength(500) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: string;
  @ApiPropertyOptional({ enum: PRIORITIES }) @IsOptional() @IsIn(PRIORITIES) priority?: string;
}
