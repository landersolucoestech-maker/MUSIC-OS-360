import type { SelectQueryBuilder } from 'typeorm';
import { ArtistEntity, type ReleaseEntity } from '../../database/entities';
import type { ReleaseArtistRefDto } from './dto/releases.dto';
import { canonicalReleaseMetadata } from '../../common/compat/release-metadata';

/**
 * Release artist embed (S1, review bc40b76).
 *
 * The release list/detail used to embed the FULL ArtistEntity under
 * `artistas`, leaking the artist `metadata`, `*_encrypted` ciphertext and every
 * other column. The embed is now an explicit, whitelisted projection:
 *   - the SQL selects only `id` and `stage_name` of the joined artist, and
 *   - toReleaseResponse() rebuilds the embed field-by-field (defense in depth).
 *
 * Deprecated key `artistas` (deploy-skew window only): web builds older than
 * this change read `release.artistas.{id,stage_name}`. It carries the SAME
 * minimal projection. REMOVAL CONDITION: delete it once every deployed web
 * build reads `artist` (one release after the web readers of `release.artist`
 * are live everywhere — including the marketing readers listed in the report).
 */

const ARTIST_REF_ALIAS = 'artist_ref';

export function joinReleaseArtistRef(qb: SelectQueryBuilder<ReleaseEntity>): SelectQueryBuilder<ReleaseEntity> {
  return qb
    .leftJoinAndMapOne(
      `r.${ARTIST_REF_ALIAS}`,
      ArtistEntity,
      ARTIST_REF_ALIAS,
      `${ARTIST_REF_ALIAS}.id = r.artist_id AND ${ARTIST_REF_ALIAS}.tenant_id = r.tenant_id AND ${ARTIST_REF_ALIAS}.deleted_at IS NULL`,
    )
    .select(['r', `${ARTIST_REF_ALIAS}.id`, `${ARTIST_REF_ALIAS}.stage_name`]);
}

/** Release row as returned by the API: entity columns plus the artist ref. */
export type ReleaseResponse = Omit<ReleaseEntity, 'artist'> & {
  artist: ReleaseArtistRefDto | null;
  /** @deprecated deploy-skew alias of `artist` — see module doc for the removal condition. */
  artistas: ReleaseArtistRefDto | null;
};

type JoinedReleaseRow = ReleaseEntity & {
  [ARTIST_REF_ALIAS]?: { id?: unknown; stage_name?: unknown } | null;
};

export function toReleaseArtistRef(row: { id?: unknown; stage_name?: unknown } | null | undefined): ReleaseArtistRefDto | null {
  if (!row || typeof row.id !== 'string') return null;
  return { id: row.id, stage_name: typeof row.stage_name === 'string' ? row.stage_name : null };
}

export function toReleaseResponse(row: ReleaseEntity): ReleaseResponse {
  const { [ARTIST_REF_ALIAS]: artistRow, artist: _relation, ...columns } = row as JoinedReleaseRow;
  void _relation;
  const artist = toReleaseArtistRef(artistRow);
  // Dual-read: rows not yet backfilled by 20260930000019 may still hold Portuguese metadata keys; the response is always canonical.
  return { ...columns, metadata: canonicalReleaseMetadata(columns.metadata), artist, artistas: artist ? { ...artist } : null };
}
