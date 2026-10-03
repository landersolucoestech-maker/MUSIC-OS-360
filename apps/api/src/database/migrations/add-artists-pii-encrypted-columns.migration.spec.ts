import { ALL_MIGRATIONS } from './index';
import { getMetadataArgsStorage } from 'typeorm';
import { ArtistEntity } from '../entities';
import {
  ARTISTS_PII_ENCRYPTED_COLUMNS,
  AddArtistsPiiEncryptedColumns20261002000001 as Migration,
} from './20261002000001_AddArtistsPiiEncryptedColumns';

function runner(script: { present?: string[]; withValues?: number } = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('information_schema.columns')) return (script.present ?? [...ARTISTS_PII_ENCRYPTED_COLUMNS]).map((column_name) => ({ column_name }));
    if (sql.startsWith('SELECT count(*)')) return [{ n: script.withValues ?? 0 }];
    return [];
  });
  return { query, calls };
}

describe('AddArtistsPiiEncryptedColumns (BLK-CRM-PII-PLAINTEXT, expand phase)', () => {
  const migration = new Migration();

  it('is registered, after every earlier migration', () => {
    const names = ALL_MIGRATIONS.map((m) => m.name);
    expect(names).toContain(migration.name);
    // registration order follows the timestamp in the class name: nothing registered before it may be newer
    const stamp = (name: string) => /(\d{14})$/.exec(name)?.[1] ?? '';
    const own = names.indexOf(migration.name);
    for (const earlier of names.slice(0, own)) expect(stamp(earlier) <= stamp(migration.name)).toBe(true);
  });

  it('up() is additive only: nullable text columns, guarded, no data statement, no DROP/UPDATE/DELETE', async () => {
    const r = runner();
    await migration.up({ query: r.query } as never);
    expect(r.calls).toHaveLength(1);
    const sql = r.calls[0].sql;
    for (const column of ARTISTS_PII_ENCRYPTED_COLUMNS) expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "${column}" text`);
    expect(sql).not.toMatch(/NOT NULL|DEFAULT|DROP|UPDATE|DELETE|INSERT/);
  });

  it('every ciphertext column exists on the entity as nullable text, and no plaintext column was dropped', () => {
    const columns = getMetadataArgsStorage().columns.filter((c) => c.target === ArtistEntity);
    for (const name of ARTISTS_PII_ENCRYPTED_COLUMNS) {
      const column = columns.find((c) => c.propertyName === name);
      expect(column?.options.type).toBe('text');
      expect(column?.options.nullable).toBe(true);
    }
    for (const plain of ['birth_date', 'rg', 'address', 'bank_name', 'bank_branch', 'bank_account', 'pix_key', 'account_holder']) {
      expect(columns.some((c) => c.propertyName === plain)).toBe(true);
    }
  });

  it('down() refuses while any ciphertext exists (it would destroy the only copy), changing nothing', async () => {
    const r = runner({ withValues: 3 });
    await expect(migration.down({ query: r.query } as never)).rejects.toThrow(/refusing down\(\), 3 artist row\(s\)/);
    expect(r.calls.some((c) => /DROP COLUMN/.test(c.sql))).toBe(false);
  });

  it('down() drops the empty columns, and is a no-op when they are already gone', async () => {
    const r = runner({ withValues: 0 });
    await migration.down({ query: r.query } as never);
    expect(r.calls.at(-1)?.sql).toMatch(/DROP COLUMN IF EXISTS "rg_encrypted"/);
    const gone = runner({ present: [] });
    await migration.down({ query: gone.query } as never);
    expect(gone.calls).toHaveLength(1);
  });
});
