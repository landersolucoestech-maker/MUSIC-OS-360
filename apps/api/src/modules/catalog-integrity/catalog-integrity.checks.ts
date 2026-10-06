/**
 * Read-only referential integrity checks of the music catalog.
 *
 * Every check is one SELECT that returns the offending rows as (tenant_id, entity_id, detail). The foreign keys of the
 * catalog tables point at a single column and do not carry the tenant, so a row can reference a record of another
 * tenant, and a soft-deleted parent keeps its live children; these checks find both, plus duplicated strong ids and a
 * share that mixes the independent Work and Phonogram structures. Nothing here writes: the runner executes the
 * checks inside a READ ONLY transaction.
 *
 * Parameter $1 is an optional tenant id (null = every tenant).
 */
export type CatalogIntegritySeverity = 'error' | 'warning';

export interface CatalogIntegrityCheck {
  id: string;
  severity: CatalogIntegritySeverity;
  description: string;
  /** One SELECT returning tenant_id, entity_id and detail; $1 is the optional tenant filter. */
  sql: string;
}

const TENANT = `($1::uuid IS NULL OR %T.tenant_id = $1::uuid)`;
const scope = (alias: string): string => TENANT.replace('%T', alias);

export const CATALOG_INTEGRITY_CHECKS: readonly CatalogIntegrityCheck[] = [
  {
    id: 'phonogram_work_missing',
    severity: 'error',
    description: 'A live phonogram references a work that no longer exists or was archived',
    sql: `SELECT p.tenant_id, p.id AS entity_id, 'work_id=' || p.work_id AS detail
            FROM phonograms p
           WHERE p.deleted_at IS NULL AND p.work_id IS NOT NULL AND ${scope('p')}
             AND NOT EXISTS (SELECT 1 FROM works w WHERE w.id = p.work_id AND w.deleted_at IS NULL)`,
  },
  {
    id: 'phonogram_work_cross_tenant',
    severity: 'error',
    description: 'A phonogram references a work of another tenant',
    sql: `SELECT p.tenant_id, p.id AS entity_id, 'work_id=' || p.work_id || ' belongs to tenant ' || w.tenant_id AS detail
            FROM phonograms p JOIN works w ON w.id = p.work_id
           WHERE w.tenant_id <> p.tenant_id AND ${scope('p')}`,
  },
  {
    id: 'share_work_cross_tenant',
    severity: 'error',
    description: 'A share references a work of another tenant',
    sql: `SELECT s.tenant_id, s.id AS entity_id, 'work_id=' || s.work_id || ' belongs to tenant ' || w.tenant_id AS detail
            FROM shares s JOIN works w ON w.id = s.work_id
           WHERE w.tenant_id <> s.tenant_id AND ${scope('s')}`,
  },
  {
    id: 'share_phonogram_cross_tenant',
    severity: 'error',
    description: 'A share references a phonogram of another tenant',
    sql: `SELECT s.tenant_id, s.id AS entity_id, 'phonogram_id=' || s.phonogram_id || ' belongs to tenant ' || p.tenant_id AS detail
            FROM shares s JOIN phonograms p ON p.id = s.phonogram_id
           WHERE p.tenant_id <> s.tenant_id AND ${scope('s')}`,
  },
  {
    id: 'share_release_cross_tenant',
    severity: 'error',
    description: 'A share references a release of another tenant',
    sql: `SELECT s.tenant_id, s.id AS entity_id, 'release_id=' || s.release_id || ' belongs to tenant ' || r.tenant_id AS detail
            FROM shares s JOIN releases r ON r.id = s.release_id
           WHERE r.tenant_id <> s.tenant_id AND ${scope('s')}`,
  },
  {
    id: 'share_mixed_structure',
    severity: 'error',
    description: 'A live share carries both a work and a phonogram: Work, Phonogram and Release shares are independent structures',
    sql: `SELECT s.tenant_id, s.id AS entity_id, 'work_id=' || s.work_id || ' and phonogram_id=' || s.phonogram_id AS detail
            FROM shares s
           WHERE s.deleted_at IS NULL AND s.work_id IS NOT NULL AND s.phonogram_id IS NOT NULL AND ${scope('s')}`,
  },
  {
    id: 'share_of_archived_work',
    severity: 'warning',
    description: 'A live share references an archived work',
    sql: `SELECT s.tenant_id, s.id AS entity_id, 'work_id=' || s.work_id AS detail
            FROM shares s JOIN works w ON w.id = s.work_id
           WHERE s.deleted_at IS NULL AND w.deleted_at IS NOT NULL AND ${scope('s')}`,
  },
  {
    id: 'work_artist_cross_tenant',
    severity: 'error',
    description: 'A work references an artist of another tenant',
    sql: `SELECT w.tenant_id, w.id AS entity_id, 'artist_id=' || w.artist_id || ' belongs to tenant ' || a.tenant_id AS detail
            FROM works w JOIN artists a ON a.id = w.artist_id
           WHERE a.tenant_id <> w.tenant_id AND ${scope('w')}`,
  },
  {
    id: 'phonogram_artist_cross_tenant',
    severity: 'error',
    description: 'A phonogram references an artist of another tenant',
    sql: `SELECT p.tenant_id, p.id AS entity_id, 'artist_id=' || p.artist_id || ' belongs to tenant ' || a.tenant_id AS detail
            FROM phonograms p JOIN artists a ON a.id = p.artist_id
           WHERE a.tenant_id <> p.tenant_id AND ${scope('p')}`,
  },
  {
    id: 'release_artist_cross_tenant',
    severity: 'error',
    description: 'A release references an artist of another tenant',
    sql: `SELECT r.tenant_id, r.id AS entity_id, 'artist_id=' || r.artist_id || ' belongs to tenant ' || a.tenant_id AS detail
            FROM releases r JOIN artists a ON a.id = r.artist_id
           WHERE a.tenant_id <> r.tenant_id AND ${scope('r')}`,
  },
  {
    id: 'contract_artist_cross_tenant',
    severity: 'error',
    description: 'A contract references an artist of another tenant',
    sql: `SELECT c.tenant_id, c.id AS entity_id, 'artist_id=' || c.artist_id || ' belongs to tenant ' || a.tenant_id AS detail
            FROM contracts c JOIN artists a ON a.id = c.artist_id
           WHERE a.tenant_id <> c.tenant_id AND ${scope('c')}`,
  },
  {
    id: 'work_participant_cross_tenant',
    severity: 'error',
    description: 'A work participant row belongs to another tenant than its work',
    sql: `SELECT wp.tenant_id, wp.id AS entity_id, 'work_id=' || wp.work_id || ' belongs to tenant ' || w.tenant_id AS detail
            FROM work_participants wp JOIN works w ON w.id = wp.work_id
           WHERE w.tenant_id <> wp.tenant_id AND ${scope('wp')}`,
  },
  {
    id: 'duplicate_work_iswc',
    severity: 'error',
    description: 'Two live works of one tenant carry the same ISWC',
    sql: `SELECT w.tenant_id, w.id AS entity_id, 'iswc=' || w.iswc AS detail
            FROM works w
           WHERE w.deleted_at IS NULL AND w.iswc IS NOT NULL AND w.iswc <> '' AND ${scope('w')}
             AND EXISTS (SELECT 1 FROM works o WHERE o.tenant_id = w.tenant_id AND o.iswc = w.iswc
                                                 AND o.deleted_at IS NULL AND o.id <> w.id)`,
  },
  {
    id: 'duplicate_phonogram_isrc',
    severity: 'error',
    description: 'Two live phonograms of one tenant carry the same ISRC',
    sql: `SELECT p.tenant_id, p.id AS entity_id, 'isrc=' || p.isrc AS detail
            FROM phonograms p
           WHERE p.deleted_at IS NULL AND p.isrc IS NOT NULL AND p.isrc <> '' AND ${scope('p')}
             AND EXISTS (SELECT 1 FROM phonograms o WHERE o.tenant_id = p.tenant_id AND o.isrc = p.isrc
                                                      AND o.deleted_at IS NULL AND o.id <> p.id)`,
  },
  {
    id: 'duplicate_release_upc',
    severity: 'error',
    description: 'Two live releases of one tenant carry the same UPC',
    sql: `SELECT r.tenant_id, r.id AS entity_id, 'upc=' || r.upc AS detail
            FROM releases r
           WHERE r.deleted_at IS NULL AND r.upc IS NOT NULL AND r.upc <> '' AND ${scope('r')}
             AND EXISTS (SELECT 1 FROM releases o WHERE o.tenant_id = r.tenant_id AND o.upc = r.upc
                                                    AND o.deleted_at IS NULL AND o.id <> r.id)`,
  },
];
