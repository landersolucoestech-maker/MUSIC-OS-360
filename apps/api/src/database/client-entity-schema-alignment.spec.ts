import * as fs from 'fs';
import * as path from 'path';

/**
 * client-entity-schema-alignment.spec.ts  (Part 78)
 *
 * Permanent guard: 20260719000010_RebuildClientsInCanonicalFormOrder
 * physically removed segmento/endereco/responsavel/prioridade/cpf/cnpj from
 * `clients`, but `ClientEntity` (entities.ts) was never updated — it kept
 * declaring the dead columns via @Column(), side by side with the new ones. Every
 * read (`GET /clients`, `GET /reports/entities/clients/export`) generated
 * `SELECT ..., segmento, ... FROM clients` and broke with
 * `QueryFailedError: column "segmento" does not exist` — reproduced via
 * real Playwright in the Reports Center.
 *
 * This test pins the migration's physical column list as the source of
 * truth and fails if `ClientEntity` diverges in either direction (phantom
 * column OR a physical column without a TypeORM mapping).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000010_RebuildClientsInCanonicalFormOrder.ts'),
  'utf8',
);
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');

// Columns renamed by migrations LATER than the canonical rebuild
// (20260719000010) — the canonical one is the source of truth for the table's SHAPE,
// but not for column names renamed after it.
// 20260918000015_RenameNomePfNomeFantasiaOnClients renamed nome_pf ->
// individual_name and nome_fantasia -> trade_name (Cluster D,
// naming-normalization mandate). 20260918000029_RenameObservacoesToNotesOnClients
// renamed observacoes -> notes (Cluster F, same mandate).
const RENAMED_AFTER_CANONICAL: Record<string, string> = {
  nome_pf: 'individual_name',
  nome_fantasia: 'trade_name',
  observacoes: 'notes',
  // 20260921000003_RenameClientsGeoFieldsToEnglish (naming-closure Cluster D).
  cidade: 'city',
  estado: 'state',
};

function extractMigrationColumns(): string[] {
  const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
  return [...block.matchAll(/^\s*([a-z_]+)\s+\w/gm)]
    .map((m) => m[1])
    .map((c) => RENAMED_AFTER_CANONICAL[c] ?? c);
}

function extractEntityColumns(): string[] {
  const start = entitiesSrc.indexOf('export class ClientEntity');
  const end = entitiesSrc.indexOf('\n}', start);
  const block = entitiesSrc.slice(start, end);
  return [...block.matchAll(/\)\s*([A-Za-z_]+):\s/g)].map((m) => m[1]);
}

describe('ClientEntity <-> clients (physical schema) alignment', () => {
  it('every physical column of the canonical migration is mapped in ClientEntity', () => {
    const migCols = extractMigrationColumns();
    const entCols = extractEntityColumns();
    const missing = migCols.filter((c) => !entCols.includes(c));
    expect(missing).toEqual([]);
  });

  it('ClientEntity declares no column removed by the migration (segmento/endereco/responsavel/prioridade/cpf/cnpj)', () => {
    const entCols = extractEntityColumns();
    for (const ghost of ['segmento', 'endereco', 'responsavel', 'prioridade', 'cpf', 'cnpj']) {
      expect(entCols).not.toContain(ghost);
    }
  });

  it('ClientEntity declares no column that does not physically exist in the table', () => {
    const migCols = extractMigrationColumns();
    const entCols = extractEntityColumns().filter((c) => c !== 'id');
    const extra = entCols.filter((c) => !migCols.includes(c));
    expect(extra).toEqual([]);
  });
});
