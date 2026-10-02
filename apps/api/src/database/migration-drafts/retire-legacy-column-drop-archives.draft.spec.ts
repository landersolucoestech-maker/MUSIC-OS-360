import * as fs from 'fs';
import * as path from 'path';
import { ALL_MIGRATIONS } from '../migrations';
import { archiveOf } from './legacy-column-drop.base';
import { CONFIRM_ENV as DROP_ENV, CONFIRM_TOKEN as DROP_TOKEN } from './legacy-column-drop.base';
import { PLANS as WORKS } from './20260930000040_DropWorksLegacyColumns';
import { PLANS as PHONOGRAMS } from './20260930000041_DropPhonogramsLegacyColumns';
import { PLANS as TRANSACTIONS } from './20260930000042_DropTransactionsLegacyColumns';
import { PLANS as CLIENTS } from './20260930000043_DropClientsLegacyContactStatus';
import { PLANS as SHARES } from './20260930000044_DropSharesLegacyArtistProjectId';
import { PLANS as HR } from './20260930000045_DropHrLegacyMirrors';
import { PLANS as INVOICES } from './20260930000049_DropInvoicesLegacyAmount';
import { PLANS as EMPLOYEES_PII } from './20260930000053_DropEmployeesLegacyPiiColumns';
import {
  ARCHIVE_TABLES,
  CONFIRM_ENV,
  CONFIRM_TOKEN,
  RetireLegacyColumnDropArchives20260930000052 as Draft,
} from './20260930000052_RetireLegacyColumnDropArchives';

/** LC1 D3 draft guard: never registered, own confirmation, drops only the archives, irreversible. */
describe('RetireLegacyColumnDropArchives draft', () => {
  const prev = process.env[CONFIRM_ENV];
  afterEach(() => { if (prev === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = prev; });

  it('is not registered and migrations/index.ts does not import migration-drafts', () => {
    expect(ALL_MIGRATIONS.some((m) => m.name === Draft.name)).toBe(false);
    const index = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'index.ts'), 'utf8');
    expect(index).not.toContain('migration-drafts');
    expect(index).not.toContain(Draft.name);
    expect(fs.readdirSync(path.join(__dirname, '..', 'migrations')).some((f) => f.startsWith('20260930000052'))).toBe(false);
  });

  it('retires exactly the archives of every drop plan', () => {
    const planned = [...WORKS, ...PHONOGRAMS, ...TRANSACTIONS, ...CLIENTS, ...SHARES, ...HR, ...INVOICES, ...EMPLOYEES_PII].map(archiveOf);
    expect([...ARCHIVE_TABLES].sort()).toEqual([...planned].sort());
  });

  it('uses its own confirmation: the drop confirmation does not unlock it', async () => {
    expect(CONFIRM_ENV).not.toBe(DROP_ENV);
    expect(CONFIRM_TOKEN).not.toBe(DROP_TOKEN);
    delete process.env[CONFIRM_ENV];
    process.env[DROP_ENV] = DROP_TOKEN;
    try {
      for (const direction of ['up', 'down'] as const) {
        const query = jest.fn();
        await expect(new Draft()[direction]({ query } as never)).rejects.toThrow(/gated draft.*LEGACY_ARCHIVE_RETIRE_CONFIRM/);
        expect(query).not.toHaveBeenCalled();
      }
    } finally { delete process.env[DROP_ENV]; }
    process.env[CONFIRM_ENV] = 'yes';
    const query = jest.fn();
    await expect(new Draft().up({ query } as never)).rejects.toThrow(/gated draft/);
    expect(query).not.toHaveBeenCalled();
  });

  it('stops at the RLS-bypass guard', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const query = jest.fn().mockResolvedValue([{ bypass: false }]);
    await expect(new Draft().up({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up(): guard, lock_timeout, then only DROP TABLE IF EXISTS of the archives', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const sql: string[] = [];
    const query = jest.fn(async (text: string) => { sql.push(text); return text.includes('rolbypassrls') ? [{ bypass: true }] : []; });
    await new Draft().up({ query } as never);
    expect(sql[0]).toContain('rolbypassrls');
    expect(sql[1]).toContain(`SET LOCAL lock_timeout = '15s'`);
    expect(sql.slice(2)).toEqual(ARCHIVE_TABLES.map((t) => `DROP TABLE IF EXISTS "${t}"`));
    expect(sql.join('\n')).not.toMatch(/DROP COLUMN|ALTER TABLE|DELETE|TRUNCATE/i);
  });

  it('down() is irreversible even when confirmed', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const query = jest.fn();
    await expect(new Draft().down({ query } as never)).rejects.toThrow(/irreversible/);
    expect(query).not.toHaveBeenCalled();
  });
});
