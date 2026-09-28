import * as fs from 'fs';
import * as path from 'path';

/**
 * lead-entity-schema-alignment.spec.ts  (Part 79)
 *
 * Permanent guard: RebuildLeadsInCanonicalFormOrder (2026-07-19) physically
 * removed `score`/`pipeline_stage` from `leads` (proven orphans), but
 * `LeadEntity` kept declaring both via @Column. Every POST /leads
 * (real creation) failed with `QueryFailedError: column "score" of relation
 * "leads" does not exist` — reproduced when wiring the real CRM frontend to the
 * backend for the first time (the in-memory mock never exposed this bug).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000011_RebuildLeadsInCanonicalFormOrder.ts'),
  'utf8',
);
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');

// Columns renamed by migrations LATER than the canonical rebuild
// (naming-normalization mandate, 2026-09-05): a historical migration is never
// edited, so its text still states the old name — we map it here to the
// real current physical name.
// 20260918000039_RenameValorEstimadoToEstimatedValueOnLeads renamed
// valor_estimado -> estimated_value (Cluster G, naming-normalization).
// 20260920000007 renamed tipo_cliente/tipo_servico -> client_type/
// service_type (final naming-closure mission).
const POST_REBUILD_RENAMES: Record<string, string> = {
  cliente_id: 'client_id',
  valor_estimado: 'estimated_value',
  tipo_cliente: 'client_type',
  tipo_servico: 'service_type',
  // 20260921000004_RenameLeadsGeoFieldsToEnglish (naming-closure Cluster D).
  cidade: 'city',
  estado: 'state',
  pais: 'country',
  // 20260928000011_CanonicalizeLeadsToEnglish (CZ-033).
  nome: 'name',
  telefone_encrypted: 'phone_encrypted',
  empresa: 'company',
  fonte: 'source',
  nome_completo: 'full_name',
  nome_artistico: 'stage_name',
  payload_servico: 'service_payload',
  dados_internos_crm: 'crm_internal_data',
};

// 20260921000005_DropDeadLeadsCrmDualStorageColumns (naming-closure Cluster
// E) dropped these 7 physical columns -- a dead dual-storage location for
// concepts real usage always wrote into crm_internal_data (jsonb); 0
// non-null rows confirmed on all 7 before dropping. Post-rename names (the
// canonical migration text still says valor_estimado, mapped above).
const REMOVED_AFTER_CANONICAL = new Set([
  'origem_lead', 'responsavel', 'prioridade', 'temperatura',
  'estimated_value', 'probabilidade_fechamento', 'proximo_follow_up',
]);

function extractMigrationColumns(): string[] {
  const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
  return [...block.matchAll(/^\s*"?([A-Za-z_]+)"?\s+\w/gm)]
    .map((m) => POST_REBUILD_RENAMES[m[1]] ?? m[1])
    .filter((c) => !REMOVED_AFTER_CANONICAL.has(c));
}

function extractEntityColumns(): string[] {
  const start = entitiesSrc.indexOf('export class LeadEntity');
  const end = entitiesSrc.indexOf('\n}', start);
  const block = entitiesSrc.slice(start, end);
  // TypeScript properties declared via @Column (uses `name:` to map
  // to the real physical column when the TS name diverges -- none currently
  // in LeadEntity; origemLead/probabilidadeFechamento, the only previous
  // examples, were removed entirely in
  // 20260921000005_DropDeadLeadsCrmDualStorageColumns).
  const nameOverrides = [...block.matchAll(/name:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  const tsProps = [...block.matchAll(/\)\s*([A-Za-z_]+):\s/g)].map((m) => m[1]);
  const overriddenProps = new Set<string>();
  const physicalNames = tsProps.filter((p) => !overriddenProps.has(p));
  return [...physicalNames, ...nameOverrides];
}

describe('LeadEntity <-> leads (physical schema) alignment', () => {
  it('every physical column of the canonical migration is mapped in LeadEntity', () => {
    const migCols = extractMigrationColumns();
    const entCols = extractEntityColumns();
    const missing = migCols.filter((c) => !entCols.includes(c));
    expect(missing).toEqual([]);
  });

  it('LeadEntity declares no removed column (score/pipeline_stage and the dead Cluster E dual storage)', () => {
    const entCols = extractEntityColumns();
    for (const ghost of [
      'score', 'pipeline_stage',
      'origem_lead', 'origemLead', 'responsavel', 'prioridade', 'temperatura',
      'estimated_value', 'probabilidade_fechamento', 'probabilidadeFechamento',
      'proximo_follow_up',
    ]) {
      expect(entCols).not.toContain(ghost);
    }
  });

  it('LeadEntity declares no column that does not physically exist in the table', () => {
    const migCols = extractMigrationColumns();
    const entCols = extractEntityColumns().filter((c) => c !== 'id' && c !== 'interactions');
    const extra = entCols.filter((c) => !migCols.includes(c));
    expect(extra).toEqual([]);
  });
});
