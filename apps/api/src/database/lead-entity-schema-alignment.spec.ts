import * as fs from 'fs';
import * as path from 'path';

/**
 * lead-entity-schema-alignment.spec.ts  (Parte 79)
 *
 * Guarda permanente: RebuildLeadsInCanonicalFormOrder (2026-07-19) removeu
 * fisicamente `score`/`pipeline_stage` de `leads` (órfãs comprovadas), mas
 * `LeadEntity` continuava declarando ambas via @Column. Todo POST /leads
 * (criação real) falhava com `QueryFailedError: column "score" of relation
 * "leads" does not exist` — reproduzido ao ligar o frontend real do CRM ao
 * backend pela primeira vez (o mock em memória nunca expôs este bug).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000011_RebuildLeadsInCanonicalFormOrder.ts'),
  'utf8',
);
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');

// Colunas renomeadas por migrations POSTERIORES à reconstrução canônica
// (naming-normalization mandate, 2026-09-05): a migration histórica nunca é
// editada, então seu texto ainda diz o nome antigo — mapeamos aqui para o
// nome físico atual real.
// 20260918000039_RenameValorEstimadoToEstimatedValueOnLeads renomeou
// valor_estimado -> estimated_value (Cluster G, naming-normalization).
// 20260920000007 renomeou tipo_cliente/tipo_servico -> client_type/
// service_type (final naming-closure mission).
const POST_REBUILD_RENAMES: Record<string, string> = {
  cliente_id: 'client_id',
  valor_estimado: 'estimated_value',
  tipo_cliente: 'client_type',
  tipo_servico: 'service_type',
};

function extractMigrationColumns(): string[] {
  const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
  return [...block.matchAll(/^\s*"?([A-Za-z_]+)"?\s+\w/gm)].map(
    (m) => POST_REBUILD_RENAMES[m[1]] ?? m[1],
  );
}

function extractEntityColumns(): string[] {
  const start = entitiesSrc.indexOf('export class LeadEntity');
  const end = entitiesSrc.indexOf('\n}', start);
  const block = entitiesSrc.slice(start, end);
  // Propriedades TypeScript declaradas via @Column (usa `name:` para mapear
  // para a coluna física real quando o nome TS diverge, ex.: tipoServico).
  const nameOverrides = [...block.matchAll(/name:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  const tsProps = [...block.matchAll(/\)\s*([A-Za-z_]+):\s/g)].map((m) => m[1]);
  const overriddenProps = new Set(['origemLead', 'probabilidadeFechamento']);
  const physicalNames = tsProps.filter((p) => !overriddenProps.has(p));
  return [...physicalNames, ...nameOverrides];
}

describe('LeadEntity <-> leads (physical schema) alignment', () => {
  it('toda coluna física da migration canônica está mapeada em LeadEntity', () => {
    const migCols = extractMigrationColumns();
    const entCols = extractEntityColumns();
    const missing = migCols.filter((c) => !entCols.includes(c));
    expect(missing).toEqual([]);
  });

  it('LeadEntity não declara nenhuma coluna removida pela migration (score/pipeline_stage)', () => {
    const entCols = extractEntityColumns();
    for (const ghost of ['score', 'pipeline_stage']) {
      expect(entCols).not.toContain(ghost);
    }
  });

  it('LeadEntity não declara coluna alguma que não exista fisicamente na tabela', () => {
    const migCols = extractMigrationColumns();
    const entCols = extractEntityColumns().filter((c) => c !== 'id' && c !== 'interactions');
    const extra = entCols.filter((c) => !migCols.includes(c));
    expect(extra).toEqual([]);
  });
});
