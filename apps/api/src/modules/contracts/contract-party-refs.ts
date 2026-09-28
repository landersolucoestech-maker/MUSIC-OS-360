import type { SelectQueryBuilder } from 'typeorm';
import { ArtistEntity, ClientEntity, type ContractEntity } from '../../database/entities';
import type { ArtistRefDto, ClientRefDto, LegacyClientRefDto } from './dto/contract-party-ref.dto';

/**
 * Contract party embeds (S1 / D1, review bc40b76).
 *
 * The contract list/detail used to embed the FULL ArtistEntity/ClientEntity
 * under `artistas`/`clientes`, leaking `metadata` (historical plaintext
 * cpf/cnpj), `*_encrypted` ciphertext and every other column to any viewer.
 * The embeds are now explicit, whitelisted projections:
 *   - the SQL selects only the whitelisted columns of the joined rows, and
 *   - toContractResponse() rebuilds the embeds field-by-field (defense in
 *     depth: even a wider select can never reach the wire).
 *
 * Deprecated keys `artistas` / `clientes` (deploy-skew window only): a web
 * build older than this change still reads `artistas.stage_name` and
 * `clientes.nome`. They carry the SAME minimal projection (plus the legacy
 * `nome` = `name` for the client). REMOVAL CONDITION: delete both keys once
 * every deployed web build reads `artist` / `client` (i.e. one release after
 * the web change shipping `contract.artist` / `contract.client` readers is live
 * everywhere).
 */

const ARTIST_REF_ALIAS = 'artist_ref';
const CLIENT_REF_ALIAS = 'client_ref';

/** Whitelisted columns of the joined rows — nothing else is ever read. */
const PARTY_REF_COLUMNS = [
  `${ARTIST_REF_ALIAS}.id`,
  `${ARTIST_REF_ALIAS}.stage_name`,
  `${CLIENT_REF_ALIAS}.id`,
  `${CLIENT_REF_ALIAS}.name`,
];

/**
 * Joins the tenant-scoped, non-deleted artist and client of each contract
 * (`c` alias) and restricts the selection to the contract row plus the
 * whitelisted party columns.
 */
export function joinContractPartyRefs(qb: SelectQueryBuilder<ContractEntity>): SelectQueryBuilder<ContractEntity> {
  return qb
    .leftJoinAndMapOne(
      `c.${ARTIST_REF_ALIAS}`,
      ArtistEntity,
      ARTIST_REF_ALIAS,
      `${ARTIST_REF_ALIAS}.id = c.artist_id AND ${ARTIST_REF_ALIAS}.tenant_id = c.tenant_id AND ${ARTIST_REF_ALIAS}.deleted_at IS NULL`,
    )
    .leftJoinAndMapOne(
      `c.${CLIENT_REF_ALIAS}`,
      ClientEntity,
      CLIENT_REF_ALIAS,
      `${CLIENT_REF_ALIAS}.id = c.client_id AND ${CLIENT_REF_ALIAS}.tenant_id = c.tenant_id AND ${CLIENT_REF_ALIAS}.deleted_at IS NULL`,
    )
    .select(['c', ...PARTY_REF_COLUMNS]);
}

export interface ContractPartyRefs {
  artist: ArtistRefDto | null;
  client: ClientRefDto | null;
  /** @deprecated deploy-skew alias of `artist` — see module doc for the removal condition. */
  artistas: ArtistRefDto | null;
  /** @deprecated deploy-skew alias of `client` (+ legacy `nome`) — see module doc for the removal condition. */
  clientes: LegacyClientRefDto | null;
}

/** Contract row as returned by the API: the entity columns plus the party refs. */
export type ContractResponse = Omit<ContractEntity, 'artist'> & ContractPartyRefs;

type JoinedContractRow = ContractEntity & {
  [ARTIST_REF_ALIAS]?: { id?: unknown; stage_name?: unknown } | null;
  [CLIENT_REF_ALIAS]?: { id?: unknown; name?: unknown } | null;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function toArtistRef(row: { id?: unknown; stage_name?: unknown } | null | undefined): ArtistRefDto | null {
  if (!row || typeof row.id !== 'string') return null;
  return { id: row.id, stage_name: stringOrNull(row.stage_name) };
}

export function toClientRef(row: { id?: unknown; name?: unknown } | null | undefined): ClientRefDto | null {
  if (!row || typeof row.id !== 'string') return null;
  return { id: row.id, name: stringOrNull(row.name) };
}

/** Builds the wire shape of a contract; drops the internal join aliases. */
export function toContractResponse(row: ContractEntity): ContractResponse {
  const {
    [ARTIST_REF_ALIAS]: artistRow,
    [CLIENT_REF_ALIAS]: clientRow,
    artist: _relation,
    ...columns
  } = row as JoinedContractRow;
  void _relation;
  const artist = toArtistRef(artistRow);
  const client = toClientRef(clientRow);
  return {
    ...columns,
    artist,
    client,
    artistas: artist ? { ...artist } : null,
    clientes: client ? { ...client, nome: client.name } : null,
  };
}
