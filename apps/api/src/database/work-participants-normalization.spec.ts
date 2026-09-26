import * as fs from 'fs';
import * as path from 'path';

/**
 * work-participants-normalization.spec.ts
 *
 * Permanent guard (2026-07-18 audit): `works.participantes` was a
 * single jsonb column representing a list of related records
 * (authorship) — normalized into `work_participants` (migration
 * WorkParticipantsNormalization20260718000011). `works.detentores` and
 * `works.co_compositores` were removed for having no proven active
 * writer (no input in the form, absent from the DTO, `importable: false`
 * in the Reports contract).
 *
 * This test is static: it ensures the entity does not reintroduce the removed
 * columns and that the migration has the required fail-fast validations
 * (do not lose data, do not use indiscriminate CASCADE, an honest down()).
 */
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260718000011_WorkParticipantsNormalization.ts'),
  'utf8',
);

function entityBlock(entityClassName: string): string {
  const start = entitiesSrc.indexOf(`export class ${entityClassName}`);
  if (start === -1) throw new Error(`Entity ${entityClassName} não encontrada em entities.ts`);
  const closingBrace = /\r?\n\}\r?\n/.exec(entitiesSrc.slice(start));
  if (!closingBrace) throw new Error(`Não foi possível localizar o fechamento da classe ${entityClassName}`);
  return entitiesSrc.slice(start, start + closingBrace.index);
}

describe('WorkEntity does not reintroduce removed columns', () => {
  const workBlock = entityBlock('WorkEntity');

  it('no longer declares `participantes`, `detentores` or `co_compositores` as @Column', () => {
    expect(workBlock).not.toMatch(/@Column\([^)]*\)\s*participantes:/);
    expect(workBlock).not.toMatch(/@Column\([^)]*\)\s*detentores:/);
    expect(workBlock).not.toMatch(/@Column\([^)]*\)\s*co_compositores:/);
  });

  it('keeps `compositor`, `compositores`, `editora` — real writer via bulk-import (Reports)', () => {
    expect(workBlock).toMatch(/@Column\([^)]*\)\s*compositor:/);
    expect(workBlock).toMatch(/@Column\([^)]*\)\s*compositores:/);
    expect(workBlock).toMatch(/@Column\([^)]*\)\s*editora:/);
  });

  it('has a relation to work_participants (participantes_rel)', () => {
    expect(workBlock).toMatch(/@OneToMany\(\(\) => WorkParticipantEntity/);
  });
});

describe('WorkParticipantEntity — tabela filha normalizada', () => {
  const block = entityBlock('WorkParticipantEntity');

  it('has the real columns extracted from ParticipanteForm (name, classe_funcao, link, percentual, sort_order)', () => {
    for (const field of ['tenant_id', 'work_id', 'name', 'classe_funcao', 'link', 'percentual', 'sort_order']) {
      expect(block).toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it('has an FK to works via work_id', () => {
    expect(block).toMatch(/@ManyToOne\(\(\) => WorkEntity/);
    expect(block).toMatch(/@JoinColumn\(\{ name: 'work_id' \}\)/);
  });
});

describe('Migration WorkParticipantsNormalization20260718000011 — data safety', () => {
  it('aborts (fail-fast) if any participantes item has an unknown format', () => {
    expect(migrationSrc).toMatch(/NOT \(item \? 'nome'\)/);
    expect(migrationSrc).toMatch(/throw new Error/);
  });

  it('aborts (fail-fast) if detentores/co_compositores still hold data before the columns are dropped', () => {
    expect(migrationSrc).toMatch(/detentores IS NOT NULL/);
    expect(migrationSrc).toMatch(/co_compositores IS NOT NULL/);
  });

  it('verifies the backfill lost no item (source count = target count) before dropping columns', () => {
    expect(migrationSrc).toMatch(/source_count/);
    expect(migrationSrc).toMatch(/target_count/);
  });

  it('uses neither DROP COLUMN CASCADE nor DROP TABLE CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP COLUMN[^;]*CASCADE/i);
    expect(migrationSrc).not.toMatch(/DROP TABLE[^;]*CASCADE/i);
  });

  it('has an honest down() — restores the columns and rebuilds the jsonb from work_participants', () => {
    expect(migrationSrc).toMatch(/ADD COLUMN IF NOT EXISTS participantes jsonb/);
    expect(migrationSrc).toMatch(/ADD COLUMN IF NOT EXISTS detentores text/);
    expect(migrationSrc).toMatch(/ADD COLUMN IF NOT EXISTS co_compositores text/);
    expect(migrationSrc).toMatch(/jsonb_agg/);
  });

  it('enables RLS with tenant_isolation on the child table', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/tenant_isolation/);
  });
});
