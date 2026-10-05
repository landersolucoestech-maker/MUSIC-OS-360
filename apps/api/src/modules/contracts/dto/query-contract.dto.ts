import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Phase 5 / C1: type/artist_id are the canonical filters (fixes the bug in
 * which ContractsService.list() read these pt-BR names while the DTO only
 * declared type/artistId — the filter never worked). tipo/artistId
 * remain temporarily accepted, resolved via
 * resolveContractQueryAliases(), marked deprecated in Swagger. `type`
 * went from legacy name to canonical in the naming normalization
 * (2026-09-05).
 */
export class QueryContractDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'recording' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'gravacao', deprecated: true, description: 'Use "type".' })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  artist_id?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Use "artist_id".' })
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @ApiPropertyOptional({ example: 'autentique' })
  @IsOptional()
  @IsString()
  signing_platform?: string;
}
