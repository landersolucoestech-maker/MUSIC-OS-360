import * as fs from 'fs';
import * as path from 'path';

/**
 * client-entity-schema-alignment.spec.ts  (Parte 78)
 *
 * Guarda permanente: 20260719000010_RebuildClientsInCanonicalFormOrder
 * removeu fisicamente segmento/endereco/responsavel/prioridade/cpf/cnpj de
 * `clients`, mas `ClientEntity` (entities.ts) nunca foi atualizada — continuou
 * declarando as colunas mortas via @Column(), lado a lado com as novas. Toda
 * leitura (`GET /clients`, `GET /reports/entities/clients/export`) gerava
 * `SELECT ..., segmento, ... FROM clients` e quebrava com
 * `QueryFailedError: column "segmento" does not exist` — reproduzido via
 * Playwright real na Central de Relatórios.
 *
 * Este teste fixa a lista de colunas físicas da migration como fonte de
 * verdade e falha se `ClientEntity` divergir para qualquer lado (coluna
 * fantasma OU coluna física sem mapeamento TypeORM).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000010_RebuildClientsInCanonicalFormOrder.ts'),
  'utf8',
);
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');

// Colunas renomeadas por migrations POSTERIORES à reconstrução canônica
// (20260719000010) — a canônica é a fonte de verdade para a FORMA da
// tabela, mas não para nomes de coluna renomeados depois dela.
// 20260918000015_RenameNomePfNomeFantasiaOnClients renomeou nome_pf ->
// individual_name e nome_fantasia -> trade_name (Cluster D,
// naming-normalization mandate).
const RENAMED_AFTER_CANONICAL: Record<string, string> = {
  nome_pf: 'individual_name',
  nome_fantasia: 'trade_name',
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
  it('toda coluna física da migration canônica está mapeada em ClientEntity', () => {
    const migCols = extractMigrationColumns();
    const entCols = extractEntityColumns();
    const missing = migCols.filter((c) => !entCols.includes(c));
    expect(missing).toEqual([]);
  });

  it('ClientEntity não declara nenhuma coluna removida pela migration (segmento/endereco/responsavel/prioridade/cpf/cnpj)', () => {
    const entCols = extractEntityColumns();
    for (const ghost of ['segmento', 'endereco', 'responsavel', 'prioridade', 'cpf', 'cnpj']) {
      expect(entCols).not.toContain(ghost);
    }
  });

  it('ClientEntity não declara coluna alguma que não exista fisicamente na tabela', () => {
    const migCols = extractMigrationColumns();
    const entCols = extractEntityColumns().filter((c) => c !== 'id');
    const extra = entCols.filter((c) => !migCols.includes(c));
    expect(extra).toEqual([]);
  });
});
