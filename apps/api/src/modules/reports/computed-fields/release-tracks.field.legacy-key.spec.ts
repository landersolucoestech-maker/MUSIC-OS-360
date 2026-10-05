import { fetchReleaseTracksForExport, writeReleaseTracksForImport } from './release-tracks.field';

/**
 * Behavioral proof of the legacy releases.metadata key `faixas` in release-tracks.field.ts. The key only exists inside SQL text
 * (`COALESCE("metadata"->'tracks', "metadata"->'faixas')` on read, `"metadata" - 'faixas'` on write), never as a standalone
 * string literal, so it has no AST mutation site: the proof is that the SQL actually sent is evaluated here, key names taken from
 * the SQL text itself, against metadata documents. The same SQL is run on a real PostgreSQL (TEMP table) when PG_INTEGRATION_URL is set.
 */
type Meta = Record<string, unknown> | null;

/** jsonb `->` / COALESCE / `- 'key'` / jsonb_set evaluation of exactly the shapes the module sends. */
function evalRead(sql: string, metadata: Meta): unknown {
  const m = /COALESCE\("metadata"->'([^']+)', "metadata"->'([^']+)'\)/.exec(sql);
  if (!m) throw new Error(`unexpected read SQL: ${sql}`);
  const get = (k: string) => (metadata && k in metadata ? metadata[k] : null);
  return get(m[1]) ?? get(m[2]);
}
function evalWrite(sql: string, metadata: Meta, json: string): Record<string, unknown> {
  const m = /jsonb_set\(COALESCE\("metadata", '\{\}'::jsonb\) - '([^']+)', '\{([^}]+)\}', \$1::jsonb\)/.exec(sql);
  if (!m) throw new Error(`unexpected write SQL: ${sql}`);
  const next: Record<string, unknown> = { ...(metadata ?? {}) };
  delete next[m[1]];
  next[m[2]] = JSON.parse(json);
  return next;
}

const LEGACY_TRACK = { title: 'Old', compositores: ['d'], idioma: 'pt-br', letra: 'y', artista: 'B' };
const NEW_TRACK = { title: 'New', composers: ['c'], language: 'en', lyrics: 'x', artist: 'A' };

async function exportOf(metadata: Meta) {
  const ds = { query: jest.fn(async (sql: string) => [{ id: 'r1', tracks: evalRead(sql, metadata) }]) };
  const out = await fetchReleaseTracksForExport(ds as never, 't1', ['r1']);
  return out.get('r1')!;
}

describe('release tracks: legacy metadata key `faixas`', () => {
  it('export reads tracks stored only under the legacy `faixas` key (row not yet backfilled)', async () => {
    const tracks = await exportOf({ faixas: [LEGACY_TRACK] });
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({ trackTitle: 'Old', composers: ['d'], releaseTrackLanguage: 'pt-br', lyrics: 'y', trackArtist: 'B' });
  });

  it('export prefers the canonical `tracks` key over `faixas` when both exist', async () => {
    const tracks = await exportOf({ tracks: [NEW_TRACK], faixas: [LEGACY_TRACK] });
    expect(tracks.map((t) => t.trackTitle)).toEqual(['New']);
  });

  it.each(['faixa', 'Faixas', 'faixas ', 'track', 'tracks_legacy'])('negative: near-miss key %j is not read as legacy tracks', async (key) => {
    expect(await exportOf({ [key]: [LEGACY_TRACK] })).toEqual([]);
  });

  it('export of a release with no tracks (null metadata) is empty', async () => {
    expect(await exportOf(null)).toEqual([]);
  });

  it('import writes canonical `tracks` and removes the legacy `faixas` key from metadata (no stale duplicate)', async () => {
    const before: Meta = { faixas: [LEGACY_TRACK], keep: 1 };
    let after: Record<string, unknown> | null = null;
    const qr = { query: jest.fn(async (sql: string, p: unknown[]) => { after = evalWrite(sql, before, p[0] as string); }) };
    await writeReleaseTracksForImport(qr as never, 't1', 'r1', [{ trackTitle: 'T' }]);
    expect(after).not.toBeNull();
    expect(Object.keys(after!).sort()).toEqual(['keep', 'tracks']);
    expect(after).not.toHaveProperty('faixas');
    expect((after!['tracks'] as Array<{ title: string }>)[0].title).toBe('T');
  });

  it('import does not remove a near-miss key such as `faixa`', async () => {
    const before: Meta = { faixa: 'x', faixas: [] };
    let after: Record<string, unknown> = {};
    const qr = { query: jest.fn(async (sql: string, p: unknown[]) => { after = evalWrite(sql, before, p[0] as string); }) };
    await writeReleaseTracksForImport(qr as never, 't1', 'r1', []);
    expect(after).toHaveProperty('faixa', 'x');
    expect(after).not.toHaveProperty('faixas');
  });
});

const pgUrl = process.env.PG_INTEGRATION_URL;
(pgUrl ? describe : describe.skip)('release tracks `faixas` SQL on a real PostgreSQL (TEMP table, no schema change)', () => {
  it('read SQL falls back to faixas; write SQL drops faixas and stores tracks', async () => {
    const { Client } = await import('pg');
    const c = new Client({ connectionString: pgUrl });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query(`CREATE TEMP TABLE releases (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, metadata jsonb)`);
      const t = '00000000-0000-0000-0000-0000000000aa';
      const ids = ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'];
      await c.query(`INSERT INTO releases VALUES ($1,$4,$5::jsonb),($2,$4,$6::jsonb),($3,$4,$7::jsonb)`, [
        ids[0], ids[1], ids[2], t,
        JSON.stringify({ faixas: [LEGACY_TRACK] }),
        JSON.stringify({ tracks: [NEW_TRACK], faixas: [LEGACY_TRACK] }),
        JSON.stringify({ faixa: [LEGACY_TRACK] }),
      ]);
      const ds = { query: async (sql: string, p: unknown[]) => (await c.query(sql, p as never)).rows };
      const out = await fetchReleaseTracksForExport(ds as never, t, ids);
      expect(out.get(ids[0])!.map((x) => x.trackTitle)).toEqual(['Old']);
      expect(out.get(ids[1])!.map((x) => x.trackTitle)).toEqual(['New']);
      expect(out.get(ids[2])).toEqual([]);

      const qr = { query: async (sql: string, p: unknown[]) => (await c.query(sql, p as never)).rows };
      await writeReleaseTracksForImport(qr as never, t, ids[0], [{ trackTitle: 'W' }]);
      const md = (await c.query(`SELECT metadata FROM releases WHERE id = $1`, [ids[0]])).rows[0].metadata as Record<string, unknown>;
      expect(Object.keys(md)).toEqual(['tracks']);
      expect((md['tracks'] as Array<{ title: string }>)[0].title).toBe('W');
      const near = (await c.query(`SELECT metadata FROM releases WHERE id = $1`, [ids[2]])).rows[0].metadata as Record<string, unknown>;
      expect(Object.keys(near)).toEqual(['faixa']);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      await c.end();
    }
  });
});
