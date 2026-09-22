import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsEmail,
  IsNumber,
  IsBoolean,
  IsObject,
  MaxLength,
  IsNotEmpty,
  Equals,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus } from '@music-os-360/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const STATUSES = Object.values(LeadStatus) as string[];
const STAGES   = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;

export class CreateLeadDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail()                  email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)  phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) source?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(STAGES)               stage?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(()=>Number) value?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;

  // ── Campos do CRM musical (colunas físicas reais de `leads`) ───────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) nomeArtistico?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) empresa?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)  whatsapp?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) instagram?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)  state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)  country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)  clientType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) serviceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() payloadServico?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() dadosInternosCRM?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() uploads?: unknown[];
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional({ enum: LeadStatus }) @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional({ enum: STAGES })     @IsOptional() @IsIn(STAGES)   stage?: string;
  @ApiPropertyOptional({ description: 'updated_at lido pelo cliente antes de editar — detecta edição concorrente (409 se divergir)' })
  @IsOptional() @IsString() expectedUpdatedAt?: string;
}

export class QueryLeadDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTo?: string;
}

export class PublicArtistApplicationDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) artisticName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) fullName!: string;
  @ApiProperty() @IsEmail() @MaxLength(255) email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) musicalGenre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) objective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) message?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() socialLinks?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() additionalData?: Record<string, unknown>;
  @ApiProperty() @IsBoolean() @Equals(true) acceptedTerms!: boolean;
  @ApiPropertyOptional({ description: 'Honeypot; must remain empty' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyWebsite?: string;
}

export class PublicArtistRegistrationDto extends PublicArtistApplicationDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) workspaceSlug!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) artistName!: string;
}
