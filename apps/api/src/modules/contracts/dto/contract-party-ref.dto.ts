import { ApiProperty } from '@nestjs/swagger';

/**
 * Response-only shapes of the party embeds on GET /contracts and
 * GET /contracts/:id (see contract-party-refs.ts). Only these fields are ever
 * serialized — never the artist/client metadata, ciphertext or documents.
 */
export class ArtistRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true }) stage_name!: string | null;
}

export class ClientRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
}

/** @deprecated deploy-skew shape of `clientes`; `nome` mirrors `name`. */
export class LegacyClientRefDto extends ClientRefDto {
  @ApiProperty({ type: String, nullable: true, deprecated: true, description: 'Deprecated mirror of `name` for pre-CZ-043 web builds.' })
  nome!: string | null;
}

export class ContractPartyRefsDto {
  @ApiProperty({ type: ArtistRefDto, nullable: true, description: 'Linked artist (tenant-scoped, not deleted).' })
  artist!: ArtistRefDto | null;

  @ApiProperty({ type: ClientRefDto, nullable: true, description: 'Linked client (tenant-scoped, not deleted).' })
  client!: ClientRefDto | null;

  @ApiProperty({
    type: ArtistRefDto,
    nullable: true,
    deprecated: true,
    description: 'Deprecated alias of `artist` for web builds older than the English embeds. Removed once every deployed web build reads `artist`.',
  })
  artistas!: ArtistRefDto | null;

  @ApiProperty({
    type: LegacyClientRefDto,
    nullable: true,
    deprecated: true,
    description: 'Deprecated alias of `client` (+ `nome`) for web builds older than the English embeds. Removed once every deployed web build reads `client`.',
  })
  clientes!: LegacyClientRefDto | null;
}
