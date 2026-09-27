import {
  IsString, IsOptional, IsArray, IsObject, IsBoolean, IsNumber,
  IsUUID, IsDateString, MaxLength, IsNumberString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CreateContractDto accepts BOTH English camelCase and pt-BR snake_case.
 *
 * Phase 5 / C1: pt-BR is the canonical contract for artistId/value/fileUrl —
 * the corresponding EN aliases are temporarily deprecated, still
 * accepted, resolved and validated by contract-legacy-alias.util.ts, but
 * marked `deprecated` in Swagger.
 * Exception: `title`/`type`/`start_date`/`end_date` became the canonical
 * fields (naming normalization, 2026-09-05) — `titulo`/`tipo`
 * (pt-BR) and, for the dates, both `data_inicio`/`data_fim` (pt-BR) and
 * `startsAt`/`expiresAt` (the EN alias that existed before this migration)
 * are now accepted as legacy aliases — three names per field.
 * Conflicts between any of the accepted names are rejected with 400
 * (CONTRACT_ALIAS_CONFLICT). currency/signedAt/parties are not part of
 * this deprecation (see C1.1 — separate debt, out of this scope).
 */
export class CreateContractDto {
  // ── English (canonical since the 2026-09-05 naming normalization) ─────────────
  @ApiPropertyOptional({ example: 'Contrato de Gravação — Artista ABC' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: 'recording' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ example: 'uuid-do-artista', deprecated: true, description: 'Use "artist_id".' })
  @IsOptional()
  @IsUUID()
  artistId?: string;

  // No default — service.create() forces ContractStatus.DRAFT on creation.
  // Keeping a default here injected 'draft' into a partial PATCH (via PartialType)
  // and triggered a wrongful 'draft → draft' workflow.
  @ApiPropertyOptional({ example: 'draft' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '15000.00', deprecated: true, description: 'Use "fixed_value".' })
  @IsOptional()
  @IsNumberString()
  value?: string;

  @ApiPropertyOptional({ example: 'BRL' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'BRL';

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z', deprecated: true, description: 'Use "start_date".' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2025-01-01T00:00:00.000Z', deprecated: true, description: 'Use "end_date".' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: '2024-01-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Use "arquivo_url".' })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  parties?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // ── pt-BR (legacy + frontend) — passam directamente para a entity ────────
  @ApiPropertyOptional({ example: 'Contrato de Gravação — Artista ABC', deprecated: true, description: 'Use "title".' })
  @IsOptional() @IsString() @MaxLength(500)
  titulo?: string;

  @ApiPropertyOptional({ example: 'gravacao', deprecated: true, description: 'Use "type".' })
  @IsOptional() @IsString() @MaxLength(100)
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  artist_id?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  client_id?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  release_id?: string;

  @ApiPropertyOptional({ example: '2024-01-01', deprecated: true, description: 'Use "start_date".' })
  @IsOptional() @IsDateString()
  data_inicio?: string;

  @ApiPropertyOptional({ example: '2025-12-31', deprecated: true, description: 'Use "end_date".' })
  @IsOptional() @IsDateString()
  data_fim?: string;

  @ApiPropertyOptional({ example: 15000, deprecated: true, description: 'Use "fixed_value".' })
  @IsOptional() @IsNumber()
  valor?: number;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional() @IsNumber()
  fixed_value?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  exclusivo?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  arquivo_url?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  signing_platform?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional() @IsArray()
  versoes?: unknown[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional() @IsArray()
  signers?: unknown[];

  @ApiPropertyOptional({ type: [Object], description: 'Attached documents (real R2 upload metadata — name/size/type/path/url).' })
  @IsOptional() @IsArray()
  documents?: unknown[];

  // Wizard field (2026-07-12 rule: 1 column per field, exact name)
  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  template_id?: string;
}
