import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsEmail, MaxLength, IsInt, Min, IsNotEmpty } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateClientDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['person', 'company']) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) document?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() address?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
  // ── CRM fields (contacts = clients — same physical table) ──────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)  state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) instagram?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(15)  zipCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) responsible?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'strategic'] })
  @IsOptional() @IsIn(['low', 'medium', 'high', 'strategic']) priority?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'blocked'] })
  @IsOptional() @IsIn(['active', 'inactive', 'blocked']) status?: string;
  @ApiPropertyOptional({ description: 'updated_at read by the client before editing — detects concurrent edits (409 on mismatch)' })
  @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryClientDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
}

const TIMELINE_TYPES = ['nota', 'ligacao', 'reuniao', 'email', 'whatsapp', 'outro'] as const;

export class CreateClientTimelineEntryDto {
  @ApiProperty({ enum: TIMELINE_TYPES }) @IsIn(TIMELINE_TYPES) type!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) description!: string;
}

export class PresignClientAttachmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() mimeType!: string;
  @ApiProperty() @IsInt() @Min(1) sizeBytes!: number;
}

export class ConfirmClientAttachmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() storageKey!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) filename!: string;
  @ApiProperty() @IsString() @IsNotEmpty() mimeType!: string;
  @ApiProperty() @IsInt() @Min(0) sizeBytes!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() checksum?: string;
}
