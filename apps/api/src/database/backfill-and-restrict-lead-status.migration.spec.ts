import * as fs from 'fs';
import * as path from 'path';

/**
 * backfill-and-restrict-lead-status.migration.spec.ts
 *
 * Regression guard for the 'convertido' -> 'closed' mapping added
 * 2026-09-16 (pre-deploy DEV audit found 2 synthetic-fixture rows with this
 * value, not covered by the original nine PT->EN pairs — see the migration's
 * own doc comment for the read-only trace that proved it equivalent to
 * 'closed'). This migration was unpublished (dev-only, never applied to any
 * real environment) at the time this mapping was added, so it was amended in
 * place rather than followed by a patch migration.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260910000016_BackfillAndRestrictLeadStatusToEnglish.ts'),
  'utf8',
);

describe('BackfillAndRestrictLeadStatusToEnglish20260910000016', () => {
  it('maps convertido -> closed alongside all nine original PT->EN pairs', () => {
    const expectedPairs: Array<[string, string]> = [
      ['novo', 'new'],
      ['contato', 'contacted'],
      ['em_contato', 'in_contact'],
      ['qualificado', 'qualified'],
      ['proposta', 'proposal'],
      ['negociacao', 'negotiation'],
      ['fechado', 'closed'],
      ['perdido', 'lost'],
      ['inativo', 'inactive'],
      ['convertido', 'closed'],
    ];
    for (const [pt, en] of expectedPairs) {
      expect(migrationSrc).toMatch(new RegExp(`\\['${pt}', '${en}'\\]`));
    }
  });

  it('does not introduce a tenth distinct English value — convertido collapses onto the existing closed state', () => {
    const enValuesMatch = migrationSrc.match(/private readonly enValues = \[([\s\S]*?)\];/);
    expect(enValuesMatch).not.toBeNull();
    const enValues = [...(enValuesMatch?.[1].matchAll(/'([a-z_]+)'/g) ?? [])].map((m) => m[1]);
    expect(enValues).toEqual([
      'new', 'contacted', 'in_contact', 'qualified', 'proposal',
      'negotiation', 'closed', 'lost', 'inactive',
    ]);
    expect(new Set(enValues).size).toBe(9);
  });

  it('still fails closed on any status value outside the mapped set (unexpected-value guard unchanged)', () => {
    expect(migrationSrc).toMatch(/status NOT IN \(\$\{this\.enValues\.map/);
    expect(migrationSrc).toMatch(/cannot add CHECK constraint/);
    expect(migrationSrc).toMatch(/throw new Error/);
  });

  it('column DEFAULT is set to the English value (not left stale on the old PT default)', () => {
    expect(migrationSrc).toMatch(/ALTER COLUMN "status" SET DEFAULT 'new'/);
  });

  it('CHECK constraint is generated from enValues (not a separately-hardcoded list that could drift)', () => {
    expect(migrationSrc).toMatch(/ADD CONSTRAINT "chk_leads_status"/);
    expect(migrationSrc).toMatch(
      /CHECK \("status" IN \(\$\{this\.enValues\.map\(\(v\) => `'\$\{v\}'`\)\.join\(', '\)\}\)\)/,
    );
  });

  it('down() reverts the constraint, default and backfill', () => {
    expect(migrationSrc).toMatch(/async down/);
    expect(migrationSrc).toMatch(/DROP CONSTRAINT IF EXISTS "chk_leads_status"/);
    expect(migrationSrc).toMatch(/ALTER COLUMN "status" SET DEFAULT 'novo'/);
  });
});
