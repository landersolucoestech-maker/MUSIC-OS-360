import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsEmail, MaxLength, IsInt, Min, IsNotEmpty, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { RELATIONSHIP_PRIORITIES } from '@music-os-360/types';
import { transformClientProfile } from '../client-profile-vocabulary';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const PERSON_TYPES = ['individual', 'company'] as const;
const PRIORITIES = RELATIONSHIP_PRIORITIES; // shared CRM relationship scale (packages/types priorities.ts)
const INTERACTION_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'proposal', 'follow_up', 'note'] as const;
const TIMELINE_TYPES = ['note', 'call', 'meeting', 'email', 'whatsapp', 'other'] as const;
const STATUSES = ['active', 'inactive', 'prospect'] as const;

/** One CRM interaction (CZ-043: English item keys; PT-BR labels live in the web). */
export class ClientInteractionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) id?: string;
  @ApiProperty({ enum: INTERACTION_TYPES }) @IsIn(INTERACTION_TYPES) type!: string;
  @ApiPropertyOptional({ example: '2026-09-28' }) @IsOptional() @IsString() @MaxLength(10) date?: string;
  @ApiPropertyOptional({ example: '14:30' }) @IsOptional() @IsString() @MaxLength(5) time?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

/**
 * CZ-043 canonical contract (snake_case = column names; the client-legacy-fields
 * module maps the pre-CZ-043 keys before persistence). Every optional field
 * accepts null to clear it. Bounded by the physical column lengths.
 */
export class CreateClientDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional({ enum: PERSON_TYPES }) @IsOptional() @IsIn(PERSON_TYPES) person_type?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) category?: string | null;
  @ApiPropertyOptional({ description: 'Profile id (English snake_case, see client-profile-vocabulary.ts); deprecated Portuguese slugs are mapped to it' })
  @Transform(transformClientProfile) @IsOptional() @IsString() @MaxLength(100) profile?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() photo_url?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) individual_name?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) legal_name?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) trade_name?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone?: string | null;
  @ApiPropertyOptional({ description: 'CPF or CNPJ (stored encrypted)' }) @IsOptional() @IsString() @MaxLength(50) cpf_cnpj?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) instagram?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) job_title?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) street?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) street_number?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) address_complement?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) neighborhood?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  @ApiPropertyOptional({ description: 'UF (2 letters)' }) @IsOptional() @IsString() @MaxLength(2) state?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(15) zip_code?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @ApiPropertyOptional({ enum: PRIORITIES }) @IsOptional() @IsIn(PRIORITIES) priority?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) responsible_name?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) responsible_job_title?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) responsible_email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) responsible_phone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string | null;
  @ApiPropertyOptional({ type: [ClientInteractionDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ClientInteractionDto) interactions?: ClientInteractionDto[] | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;

  // ── Deprecated (pre-CZ-043 web build; mapped by client-legacy-fields.ts) ────
  @ApiPropertyOptional({ deprecated: true, description: 'Use "person_type".' }) @IsOptional() @IsIn(['person', 'company', ...PERSON_TYPES]) type?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "cpf_cnpj".' }) @IsOptional() @IsString() @MaxLength(50) document?: string | null;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "photo_url".' }) @IsOptional() @IsString() avatarUrl?: string | null;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "zip_code".' }) @IsOptional() @IsString() @MaxLength(15) zipCode?: string | null;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "responsible_name".' }) @IsOptional() @IsString() @MaxLength(150) responsible?: string | null;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional({ description: 'updated_at read by the client before editing — detects concurrent edits (409 on mismatch)' })
  @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryClientDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ enum: PERSON_TYPES }) @IsOptional() @IsString() person_type?: string;
  @ApiPropertyOptional({ deprecated: true, description: 'Use "person_type".' }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ description: 'Profile id; deprecated Portuguese slugs are mapped to the canonical id' })
  @Transform(transformClientProfile) @IsOptional() @IsString() @MaxLength(100) profile?: string;
}

export class CreateClientTimelineEntryDto {
  @ApiProperty({ enum: TIMELINE_TYPES })
  @IsIn(TIMELINE_TYPES) type!: string;
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
