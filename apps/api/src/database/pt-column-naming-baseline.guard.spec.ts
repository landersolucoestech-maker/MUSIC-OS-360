/**
 * pt-column-naming-baseline.guard.spec.ts
 *
 * Permanent protection (naming-closure Phase 4): turns the mechanical census of
 * `.audit-runtime/census-pt-columns.ts` — which found and allowed the
 * individual classification of 96 PT-suspect physical columns in this mission
 * (see docs/NAMING_NORMALIZATION_CANONICAL_MAP.md, "Phase 2 individual
 * classification") — from a one-off audit into a permanent CI gate.
 *
 * Reimplements here the SAME heuristic as the standalone script (it does not import the
 * script itself: it runs as ESM `import.meta.url`, incompatible with the
 * CommonJS Jest environment of this suite) and compares the current result against
 * the baseline already committed in `.audit-runtime/pt-column-census.jsonl`.
 *
 * If this test fails, it means a new physical column with a
 * PT-suspect name was added (or an existing one was removed/renamed) without
 * going through this mission's individual classification process:
 *   1. run `npx tsx .audit-runtime/census-pt-columns.ts` from the monorepo
 *      root to regenerate `pt-column-census.jsonl`;
 *   2. run `npx tsx .audit-runtime/classify-pt-census.ts` to classify
 *      each new item (LIVE_CANONICAL_PT / REPORT_ONLY / DEAD_CANDIDATE);
 *   3. manually trace any DEAD_CANDIDATE before acting (never
 *      rename/drop on isolated mechanical suspicion — see the
 *      `works.compositor` near-miss documented in the canonical map);
 *   4. document the decision in docs/NAMING_NORMALIZATION_CANONICAL_MAP.md;
 *   5. commit the two regenerated `.jsonl` files together with the change —
 *      that updates the baseline this guard reads, making the test pass
 *      again.
 *
 * This does NOT replace the individual check (which requires human judgment) —
 * it only ensures it is never skipped silently.
 */
import * as fs from 'fs';
import * as path from 'path';

const ENTITIES_PATH = path.resolve(__dirname, 'entities.ts');
const BASELINE_PATH = path.resolve(__dirname, '../../../../.audit-runtime/pt-column-census.jsonl');

// Identical to .audit-runtime/census-pt-columns.ts — keep the two in sync.
const ALLOWLIST = new Set([
  'cpf', 'cpf_encrypted', 'cnpj', 'cnpj_encrypted', 'cpf_cnpj', 'cpf_cnpj_encrypted',
  'cfop', 'iss', 'issqn', 'aliquota_iss', 'iss_retido', 'pis', 'cofins', 'inss',
  'ir', 'ir_amount', 'csll', 'base_calculo', 'aliquota', 'natureza_operacao',
  'codigo_servico_municipal', 'codigo_municipio', 'inscricao_estadual', 'inscricao_municipal',
  'regime_tributario', 'simples_nacional', 'lucro_presumido', 'lucro_real',
  'nfse', 'nfe', 'nfce', 'tipo_nota', 'serie', 'tomador', 'tomador_nome', 'tomador_cnpj',
  'tomador_razao_social', 'tomador_inscricao_estadual', 'tomador_inscricao_municipal',
  'tomador_email', 'tomador_uf', 'tomador_cep', 'tomador_doc_encrypted', 'prestador',
  'prestador_id', 'nota_fiscal', 'numero_nota_fiscal',
  'field-labels',
]);

const PT_SUSPECT_TOKENS = [
  'nome', 'endereco', 'cidade', 'estado', 'pais', 'responsavel', 'telefone',
  'numero', 'valor', 'data_', 'observacoes', 'notas', 'descricao', 'titulo',
  'categoria', 'prioridade', 'temperatura', 'origem', 'proximo', 'fonte',
  'empresa', 'contato', 'localizacao', 'setor', 'segmento', 'perfil',
  'razao_social', 'gravadora', 'genero', 'idioma', 'duracao', 'instrumental',
  'gravacao', 'lancamento', 'registro', 'letra', 'compositor', 'interprete',
  'produtor', 'artista', 'musica', 'obra', 'fonograma', 'faixa', 'capa',
];

function isPtSuspect(field: string): boolean {
  if (ALLOWLIST.has(field)) return false;
  if (/[áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/.test(field)) return true;
  const lower = field.toLowerCase();
  return PT_SUSPECT_TOKENS.some((tok) => lower.includes(tok));
}

interface EntityBlock { className: string; tableName: string | null; start: number; end: number; }

function extractEntityBlocks(src: string): EntityBlock[] {
  const blocks: EntityBlock[] = [];
  const classRe = /@Entity\('([^']+)'\)[^\n]*\n(?:@[A-Za-z]+\([^)]*\)\s*\n)*export class (\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(src))) {
    const start = m.index;
    const end = src.indexOf('\n}', start);
    blocks.push({ className: m[2], tableName: m[1], start, end: end === -1 ? src.length : end });
  }
  return blocks;
}

function computeCurrentCensus(): Set<string> {
  const src = fs.readFileSync(ENTITIES_PATH, 'utf8');
  const blocks = extractEntityBlocks(src);
  const hits = new Set<string>();
  const colRe = /@Column\(\{([^}]*)\}\)\s*([A-Za-z_][A-Za-z0-9_]*)\s*[?!]?:/g;

  for (const block of blocks) {
    const blockSrc = src.slice(block.start, block.end);
    colRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = colRe.exec(blockSrc))) {
      const field = m[2];
      if (isPtSuspect(field)) hits.add(`${block.tableName}.${field}`);
    }
  }
  return hits;
}

function readBaseline(): Set<string> {
  const lines = fs.readFileSync(BASELINE_PATH, 'utf8').trim().split('\n');
  return new Set(lines.map((l) => {
    const row = JSON.parse(l) as { table: string; field: string };
    return `${row.table}.${row.field}`;
  }));
}

describe('Permanent guard: the census of PT-suspect physical columns does not diverge without triage (naming-closure Phase 4)', () => {
  it('o baseline commitado existe (.audit-runtime/pt-column-census.jsonl)', () => {
    expect(fs.existsSync(BASELINE_PATH)).toBe(true);
  });

  it('no new PT-suspect column appears without individual classification', () => {
    const current = computeCurrentCensus();
    const baseline = readBaseline();
    const newHits = [...current].filter((h) => !baseline.has(h));
    if (newHits.length > 0) {
      throw new Error(
        `New PT-suspect physical column(s), not yet classified: ${newHits.join(', ')}. ` +
        'Regenere e classifique via .audit-runtime/census-pt-columns.ts + classify-pt-census.ts, documente ' +
        'the decision in docs/NAMING_NORMALIZATION_CANONICAL_MAP.md, and commit the updated .jsonl files.',
      );
    }
  });

  it('no baseline column was removed/renamed without updating the baseline (keeps the gate honest)', () => {
    const current = computeCurrentCensus();
    const baseline = readBaseline();
    const stale = [...baseline].filter((h) => !current.has(h));
    if (stale.length > 0) {
      throw new Error(
        `Baseline column(s) no longer exist in entities.ts: ${stale.join(', ')}. ` +
        'Se foram legitimamente dropadas/renomeadas, regenere .audit-runtime/pt-column-census.jsonl ' +
        '(and pt-census-classified.jsonl) and commit the updated version together with the migration.',
      );
    }
  });

  // Positive/negative proof of the isPtSuspect heuristic, isolated from the real entities.ts
  // (direct evidence that the mechanism detects correctly, not just "it worked once").
  describe('isPtSuspect: true positive on a known dead column, true negative on an intentional legal-domain term', () => {
    it.each([
      // Simulated reintroduction of the 3 dead columns dropped by 20260923000002 --
      // if they ever reappear as @Column, this proves the guard would catch them.
      'compositores', 'interpretes', 'produtores',
      // Sample of real PT-suspect tokens already classified LIVE_CANONICAL_PT
      // (the heuristic correctly marks them "suspect" -- suspect != dead;
      // the individual classification decides LIVE vs DEAD, not this guard).
      'nome_completo', 'telefone_encrypted', 'razao_social', 'data_prevista',
    ])('"%s" IS detected as PT-suspect', (field) => {
      expect(isPtSuspect(field)).toBe(true);
    });

    it.each([
      // LEGAL_DOMAIN_INTENTIONAL -- should never trigger the guard even though they are PT.
      'cpf', 'cnpj', 'cpf_cnpj_encrypted', 'inscricao_estadual', 'tomador_razao_social',
      'nfse', 'aliquota_iss', 'regime_tributario',
      // Pure EN terms -- must never trigger.
      'created_at', 'tenant_id', 'status', 'party_role', 'percentage',
    ])('"%s" NÃO é detectado como PT-suspeito (falso-positivo seria um defeito do guard)', (field) => {
      expect(isPtSuspect(field)).toBe(false);
    });
  });
});
