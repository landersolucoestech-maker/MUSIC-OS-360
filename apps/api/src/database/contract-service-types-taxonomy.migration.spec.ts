import { CanonicalizeContractServiceTypeValuesAndIndex20260930000002 as Migration } from './migrations/20260930000002_CanonicalizeContractServiceTypeValuesAndIndex';
import { ALL_MIGRATIONS } from './migrations';
import {
  CONTRACT_SERVICE_TYPE_CANONICAL_FINANCIAL_MODELS,
  CONTRACT_SERVICE_TYPE_CLIENT_TYPES,
  CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES,
  LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES,
  LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS,
  LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES,
  LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE,
} from '../modules/contract-service-types/contract-service-type.vocabulary';
import { getMetadataArgsStorage } from 'typeorm';
import { ContractServiceTypeEntity } from './entities';

type Call = { sql: string; params?: unknown[] };

function runner() {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: true }];
    if (sql.includes('count(*)::int AS affected')) return [{ affected: 1 }];
    return [];
  });
  return { query, calls };
}

// The external-rights phrase is handled by its own migration (20260930000017), not by this one.
const migration2FinancialModels = Object.entries(LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS)
  .filter(([legacy]) => legacy !== LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE);

const legacyPairs = [
  ...migration2FinancialModels,
  ...Object.entries(LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES),
];

describe('CanonicalizeContractServiceTypeValuesAndIndex20260930000002', () => {
  const migration = new Migration();

  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it('up() bounds lock waits right after the RLS guard', async () => {
    const { calls } = runner();
    await migration.up({ query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return sql.includes('rolbypassrls') ? [{ bypass: true }] : sql.includes('affected') ? [{ affected: 0 }] : [];
    }) } as never);
    expect(calls[0].sql).toContain('rolbypassrls');
    expect(calls[1].sql).toContain(`SET LOCAL lock_timeout = '15s'`);
  });

  it('up() backs the pre-image up BEFORE any UPDATE, and the side table denies every non-bypass role', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const firstUpdate = calls.findIndex((c) => /UPDATE "contract_service_types"/.test(c.sql));
    const backupInsert = calls.findIndex((c) => c.sql.includes('INSERT INTO "contract_service_types_taxonomy_backup_20260930"'));
    expect(backupInsert).toBeGreaterThan(-1);
    expect(backupInsert).toBeLessThan(firstUpdate);
    const sqlText = calls.map((c) => c.sql).join('\n');
    expect(sqlText).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sqlText).toContain('FORCE ROW LEVEL SECURITY');
    expect(sqlText).not.toMatch(/CREATE POLICY/);
    expect(sqlText).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  it('up() backfills exactly the unambiguous legacy pairs with bound parameters, never touching updated_at', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const scalar = calls.filter((c) => c.sql.includes('WITH updated AS') && Array.isArray(c.params) && c.params.length === 2);
    expect(scalar.map((c) => c.params)).toEqual(legacyPairs.map(([legacy, canonical]) => [legacy, canonical]));
    const clientTypes = calls.find((c) => c.sql.includes(`UPDATE "contract_service_types" SET "client_types"`))!;
    expect(JSON.parse(String(clientTypes.params![0]))).toEqual(LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES);
    for (const c of calls) expect(c.sql).not.toContain('updated_at');
    for (const canonical of [
      ...Object.values(LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES),
      ...migration2FinancialModels.map(([, canonical]) => canonical),
      ...Object.values(LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES),
    ]) {
      expect([...CONTRACT_SERVICE_TYPE_CLIENT_TYPES, ...CONTRACT_SERVICE_TYPE_CANONICAL_FINANCIAL_MODELS, ...CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES]).toContain(canonical);
    }
  });

  it("leaves 'recebimentos externos de direitos' (handled by 20260930000017) and 'royalties' alone and adds NO constraint", async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    await migration.down({ query } as never);
    const sqlText = calls.map((c) => c.sql + JSON.stringify(c.params ?? [])).join('\n');
    expect(sqlText).not.toContain(LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE);
    expect(sqlText).not.toContain('royalties');
    expect(sqlText).not.toContain('external_rights');
    expect(sqlText).not.toMatch(/ADD CONSTRAINT|CHECK\s*\(/);
  });

  it('up() renames the index only through the guarded DO block and switches both defaults', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const rename = calls.find((c) => c.sql.includes('ALTER INDEX'))!;
    expect(rename.sql).toContain(`to_regclass('public.idx_contracts_data_fim') IS NOT NULL`);
    expect(rename.sql).toContain(`to_regclass('public.idx_contracts_end_date') IS NULL`);
    expect(rename.sql).toContain(`RENAME TO "idx_contracts_end_date"`);
    const sqlText = calls.map((c) => c.sql).join('\n');
    expect(sqlText).toContain(`"financial_model" SET DEFAULT 'fixed_value'`);
    expect(sqlText).toContain(`"financial_payment_frequency" SET DEFAULT 'one_time'`);
  });

  it('up() ends with read-only residue reporting (SELECT only, never aborts on residue)', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const tail = calls.slice(-3);
    for (const c of tail) expect(c.sql.trimStart()).toMatch(/^SELECT/);
  });

  it('down() reverses defaults, values and index name in the opposite order of up()', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    const scalar = calls.filter((c) => c.sql.includes('WITH updated AS') && Array.isArray(c.params) && c.params.length === 2);
    expect(scalar.map((c) => c.params)).toEqual([
      ...Object.entries(LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES).map(([legacy, canonical]) => [canonical, legacy]),
      ...migration2FinancialModels.map(([legacy, canonical]) => [canonical, legacy]),
    ]);
    const sqlText = calls.map((c) => c.sql).join('\n');
    expect(sqlText).toContain(`"financial_model" SET DEFAULT 'valor_fixo'`);
    expect(sqlText).toContain(`"financial_payment_frequency" SET DEFAULT 'unico'`);
    expect(sqlText).toContain(`RENAME TO "idx_contracts_data_fim"`);
    // the forensic side table is never dropped by down()
    expect(sqlText).not.toMatch(/DROP TABLE/);
  });

  it('the entity defaults equal the migrated column defaults', () => {
    const columnDefault = (property: string) =>
      getMetadataArgsStorage().columns.find((c) => c.target === ContractServiceTypeEntity && c.propertyName === property)?.options.default;
    expect(columnDefault('financial_model')).toBe('fixed_value');
    expect(columnDefault('financial_payment_frequency')).toBe('one_time');
  });
});
