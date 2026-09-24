/**
 * pt-column-naming-baseline.guard.spec.ts
 *
 * Proteção permanente (naming-closure Fase 4): converte o censo mecânico de
 * `.audit-runtime/census-pt-columns.ts` — que encontrou e permitiu a
 * classificação individual de 96 colunas físicas PT-suspeitas nesta missão
 * (ver docs/NAMING_NORMALIZATION_CANONICAL_MAP.md, "Phase 2 individual
 * classification") — de auditoria pontual em portão de CI permanente.
 *
 * Reimplementa aqui a MESMA heurística do script standalone (não importa o
 * script em si: ele roda como ESM `import.meta.url`, incompatível com o
 * ambiente CommonJS do Jest desta suíte) e compara o resultado atual contra
 * o baseline já commitado em `.audit-runtime/pt-column-census.jsonl`.
 *
 * Se este teste falhar, significa que uma nova coluna física com nome
 * PT-suspeito foi adicionada (ou uma existente foi removida/renomeada) sem
 * passar pelo mesmo processo de classificação individual desta missão:
 *   1. rode `npx tsx .audit-runtime/census-pt-columns.ts` a partir da raiz
 *      do monorepo para regenerar `pt-column-census.jsonl`;
 *   2. rode `npx tsx .audit-runtime/classify-pt-census.ts` para classificar
 *      cada item novo (LIVE_CANONICAL_PT / REPORT_ONLY / DEAD_CANDIDATE);
 *   3. trace manualmente qualquer DEAD_CANDIDATE antes de agir (nunca
 *      renomear/dropar por suspeita mecânica isolada — ver o near-miss de
 *      `works.compositor` documentado no canonical map);
 *   4. documente a decisão em docs/NAMING_NORMALIZATION_CANONICAL_MAP.md;
 *   5. commite os dois arquivos `.jsonl` regenerados junto com a mudança —
 *      isso atualiza o baseline que este guard lê, fazendo o teste passar
 *      de novo.
 *
 * Isto NÃO substitui a checagem individual (que exige julgamento humano) —
 * só garante que ela nunca é pulada silenciosamente.
 */
import * as fs from 'fs';
import * as path from 'path';

const ENTITIES_PATH = path.resolve(__dirname, 'entities.ts');
const BASELINE_PATH = path.resolve(__dirname, '../../../../.audit-runtime/pt-column-census.jsonl');

// Idêntico a .audit-runtime/census-pt-columns.ts — mantenha os dois em sincronia.
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

describe('Guarda permanente: censo de colunas físicas PT-suspeitas não diverge sem triagem (naming-closure Fase 4)', () => {
  it('o baseline commitado existe (.audit-runtime/pt-column-census.jsonl)', () => {
    expect(fs.existsSync(BASELINE_PATH)).toBe(true);
  });

  it('nenhuma coluna PT-suspeita nova aparece sem passar pela classificação individual', () => {
    const current = computeCurrentCensus();
    const baseline = readBaseline();
    const newHits = [...current].filter((h) => !baseline.has(h));
    if (newHits.length > 0) {
      throw new Error(
        `Coluna(s) física(s) PT-suspeita(s) nova(s), ainda não classificada(s): ${newHits.join(', ')}. ` +
        'Regenere e classifique via .audit-runtime/census-pt-columns.ts + classify-pt-census.ts, documente ' +
        'a decisão em docs/NAMING_NORMALIZATION_CANONICAL_MAP.md, e commite os .jsonl atualizados.',
      );
    }
  });

  it('nenhuma coluna do baseline foi removida/renomeada sem atualizar o baseline (mantém o gate honesto)', () => {
    const current = computeCurrentCensus();
    const baseline = readBaseline();
    const stale = [...baseline].filter((h) => !current.has(h));
    if (stale.length > 0) {
      throw new Error(
        `Coluna(s) do baseline não existem mais em entities.ts: ${stale.join(', ')}. ` +
        'Se foram legitimamente dropadas/renomeadas, regenere .audit-runtime/pt-column-census.jsonl ' +
        '(e pt-census-classified.jsonl) e commite a versão atualizada junto com a migration.',
      );
    }
  });
});
