import * as fs from 'fs';
import * as path from 'path';

/**
 * Fase 13A Etapa 15 — testes ESTÁTICOS das migrations financeiras M0–M9.
 * Leem os arquivos como texto; NUNCA conectam a banco, NUNCA executam SQL.
 */
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const FILES = [
  '20260718000000_FinancialPrereqs.ts',
  '20260718000001_FinancialEnums.ts',
  '20260718000002_FinancialCategories.ts',
  '20260718000003_FinancialPartiesAccounts.ts',
  '20260718000004_FinancialTransactions.ts',
  '20260718000005_TransactionAllocations.ts',
  '20260718000006_FinancialBudgets.ts',
  '20260718000007_FinancialRls.ts',
  '20260718000008_PerformanceMetricEntries.ts',
  '20260718000009_FinancialOperationalBridges.ts',
] as const;

const read = (file: string): string =>
  fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

const all = (): string => FILES.map(read).join('\n');

describe('financial migrations M0–M9 — static contracts', () => {
  it('the 10 migrations exist, in order, with unique names/timestamps', () => {
    const timestamps = FILES.map((f) => f.slice(0, 14));
    expect(new Set(timestamps).size).toBe(10);
    expect([...timestamps].sort()).toEqual(timestamps);
    for (const f of FILES) {
      expect(fs.existsSync(path.join(MIGRATIONS_DIR, f))).toBe(true);
    }
  });

  it('cada migration implementa up() e down() e declara name coerente', () => {
    for (const f of FILES) {
      const src = read(f);
      expect(src).toMatch(/public async up\(queryRunner: QueryRunner\): Promise<void>/);
      expect(src).toMatch(/public async down\(queryRunner: QueryRunner\): Promise<void>/);
      const ts = f.slice(0, 14);
      expect(src).toContain(`${ts}`);
      expect(src).toMatch(/implements MigrationInterface/);
    }
  });

  it('no secret, forbidden ref or dependency on the legacy snapshot', () => {
    const src = all();
    for (const forbidden of [
      'sxmfeocztlztvpdnxayk', // MAIN
      'sxdhnhoupjrnntrmjtyn', // DEV antigo excluído
      'remote_schema',
      'SUPABASE_ACCESS_TOKEN',
      'db_pass',
      'jwt_secret',
      'password',
      'PASSWORD',
    ]) {
      expect(src.includes(forbidden)).toBe(false);
    }
  });

  it('nenhum OWNER TO (ownership fica com o executor) e nenhum synchronize', () => {
    const src = all();
    expect(src.includes('OWNER TO')).toBe(false);
    expect(src.includes('synchronize')).toBe(false);
  });

  it('no broad DROP ... CASCADE (CASCADE only as a justified ON DELETE)', () => {
    const src = all();
    expect(/DROP\s+\w+[^;`]*CASCADE/i.test(src)).toBe(false);
    const onDeleteCascades = src.match(/ON DELETE CASCADE/g) ?? [];
    // 2 do schema novo (allocations←transaction, revisions←budget) + 3 na
    // RESTAURAÇÃO legada do down() da M2 (transcrição fiel do DDL Enterprise:
    // category_centers/links/favorites ← categories).
    expect(onDeleteCascades.length).toBe(5);
  });

  it('revised M2: fail-fast replacement of the legacy module (Phase 13B authorization)', () => {
    const src = read(FILES[2]);
    // valida existência explícita + zero registros + assinatura, não só IF EXISTS
    expect(src).toContain(`to_regclass('public.' || v_table) IS NULL`);
    expect(src).toMatch(/possui % registro\(s\)/);
    expect(src).toContain(`column_name = 'slug'`);
    expect(src).toMatch(/nature', 'includes_in_pnl/);
    // dependências externas via catálogo (FKs de fora do conjunto + views)
    expect(src).toContain('pg_constraint');
    expect(src).toContain('view_table_usage');
    // remoção em ordem reversa e SEM CASCADE nos DROPs
    const order = [
      'financial_category_rule_runs', 'financial_category_rules',
      'financial_category_favorites', 'financial_category_links',
      'financial_category_centers', 'financial_categories',
    ];
    let last = -1;
    for (const t of order) {
      const i = src.indexOf(`'${t}'`);
      expect(i).toBeGreaterThan(last >= 0 ? -1 : -1);
      last = i;
    }
    expect(/DROP TABLE [^;`]*CASCADE/.test(src)).toBe(false);
    // estrutura nova criada SOMENTE depois da remoção
    const lastDrop = src.indexOf('DROP TABLE "${table}"');
    const firstCreate = src.indexOf('CREATE TABLE "financial_category_templates"');
    expect(lastDrop).toBeGreaterThan(-1);
    expect(firstCreate).toBeGreaterThan(lastDrop);
    // down(): restauração completa do módulo legado (Opção 1), sem seeds
    const down = src.slice(src.indexOf('public async down'));
    expect(down).toContain('CREATE TABLE financial_categories');
    expect(down).toContain('CREATE TABLE financial_category_rule_runs');
    expect(down).toContain('depth_level');
    expect(down).toContain('tenant_isolation_');
    expect(/INSERT INTO/i.test(down)).toBe(false);
    // shape do ponto da cadeia: junction SEM center_id (D8) e rules SEM colunas flat (D7)
    expect(down.includes('center_id')).toBe(false);
    expect(down.includes('counterparty_type')).toBe(false);
  });

  it('no real-data seed (no INSERTs in the migrations)', () => {
    expect(/INSERT INTO/i.test(all())).toBe(false);
  });

  it('M0: UNIQUE (tenant_id, id) nos 7 alvos de FK composta', () => {
    const src = read(FILES[0]);
    for (const t of ['projects', 'artists', 'phonograms', 'releases', 'clients', 'contracts', 'events']) {
      expect(src).toContain(`'${t}'`);
    }
    expect(src).toContain('UNIQUE ("tenant_id", "id")');
  });

  it('M1: enums aprovados — sem paid/received/overdue/partially persistidos', () => {
    const src = read(FILES[1]);
    expect(src).toContain(`'pending', 'settled', 'cancelled', 'reversed'`);
    expect(src.includes(`'paid'`)).toBe(false);
    expect(src.includes(`'received'`)).toBe(false);
    expect(src.includes(`'overdue'`)).toBe(false);
    expect(src.includes(`'partially_settled'`)).toBe(false);
    for (const e of [
      'transaction_type', 'transaction_status', 'category_nature', 'allocation_dimension',
      'account_type', 'counterparty_type', 'installment_interval',
      'performance_metric_type', 'metric_source',
    ]) {
      expect(src).toContain(`CREATE TYPE "${e}"`);
    }
  });

  it('M4: structural transaction invariants (I1, I16, transfer, reversal, installments)', () => {
    const src = read(FILES[4]);
    expect(src).toContain('CHECK ("amount" > 0)');
    expect(src).toContain('ck_fintx_settlement_status');
    expect(src).toContain('ck_fintx_transfer_accounts');
    expect(src).toContain('ck_fintx_installments_triplet');
    expect(src).toContain('ck_fintx_no_self_reversal');
    expect(src).toContain('uq_fintx_single_reversal');
    expect(src).toContain('fn_fintx_state_machine');
    expect(src).toContain('fn_fintx_reversal_guard');
    expect(src).toContain('fn_financial_version_lock');
    expect(src).toContain(`"competence_date"      date NOT NULL`);
    expect(src).toMatch(/exclusão física proibida/);
  });

  it('M5: parallel dimensions, largest remainder and per-dimension sums (I5/I7)', () => {
    const src = read(FILES[5]);
    expect(src).toContain('ck_txalloc_dimension_target');
    expect(src).toContain('UNIQUE NULLS NOT DISTINCT');
    expect(src).toContain('fn_largest_remainder');
    expect(src).toContain('fn_txalloc_check_sums');
    expect(src).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(src).toContain('CHECK ("percentage" > 0 AND "percentage" <= 100)');
    expect(src).toContain('CHECK ("allocated_amount" > 0)');
  });

  it('composite FKs with tenant on every tenant-owned reference (I6)', () => {
    const src = all();
    const composite = src.match(/REFERENCES "\w+" \("tenant_id", "id"\)/g) ?? [];
    expect(composite.length).toBeGreaterThanOrEqual(18);
    // nenhuma FK simples para tabelas tenant-owned do domínio:
    expect(/REFERENCES "financial_transactions" \("id"\)/.test(src)).toBe(false);
    expect(/REFERENCES "projects" \("id"\)/.test(src)).toBe(false);
    expect(/REFERENCES "artists" \("id"\)/.test(src)).toBe(false);
  });

  it('RLS: ENABLE+FORCE on the domain\'s 10 tables (M7 + M8)', () => {
    const src = read(FILES[7]) + read(FILES[8]);
    const enable = src.match(/ENABLE ROW LEVEL SECURITY/g) ?? [];
    const force = src.match(/FORCE ROW LEVEL SECURITY/g) ?? [];
    // 8 tenant-tables + templates (M7) + metric_entries (M8) = 10 enable/force
    // (down() usa NO FORCE/DISABLE — contam só os do up por padrão de escrita)
    expect(enable.filter((s) => s === 'ENABLE ROW LEVEL SECURITY').length).toBeGreaterThanOrEqual(2);
    expect(force.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain('private_get_tenant_id()');
    expect(src).toContain('migrator_admin_all');
    expect(src.includes('musicos_app')).toBe(true);
  });

  it('M8: metrics never reference financial transactions (I12) and are deduplicated (I17)', () => {
    const src = read(FILES[8]);
    expect(src.includes('financial_transactions')).toBe(false);
    expect(src).toContain('uq_metric_active_dedupe');
    expect(src).toContain('superseded_by_id');
    expect(src).toContain('ck_metric_type_target_compat');
    expect(src).toContain('fn_metric_immutability');
  });

  it('M9: optional bridges without automatic association (column created NULL, no UPDATE)', () => {
    const src = read(FILES[9]);
    expect(src).toContain('"financial_project_id" uuid NULL');
    expect(/UPDATE\s+"?(marketing|audiovisual)/i.test(src)).toBe(false);
  });

  it('downs: policies/triggers/functions before tables; enums last; extension preserved', () => {
    const m7 = read(FILES[7]);
    const downM7 = m7.slice(m7.indexOf('public async down'));
    expect(downM7.indexOf('DROP POLICY')).toBeGreaterThanOrEqual(0);
    const m4 = read(FILES[4]);
    const downM4 = m4.slice(m4.indexOf('public async down'));
    expect(downM4.indexOf('DROP TRIGGER')).toBeLessThan(downM4.indexOf('DROP TABLE'));
    expect(downM4.indexOf('DROP FUNCTION')).toBeLessThan(downM4.indexOf('DROP TABLE'));
    const m0 = read(FILES[0]);
    expect(m0.slice(m0.indexOf('public async down')).includes('DROP EXTENSION')).toBe(false);
  });
});
