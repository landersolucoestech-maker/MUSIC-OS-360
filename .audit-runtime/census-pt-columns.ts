/**
 * Real, mechanical census of physical DB columns in entities.ts whose
 * TypeScript property name looks Portuguese, cross-referenced against the
 * LEGAL_DOMAIN_INTENTIONAL allowlist already ratified in
 * docs/NAMING_NORMALIZATION_CANONICAL_MAP.md. This is the naming-closure
 * mission's Phase 2 census input -- ground truth from the live entities.ts
 * source (not a memory of a prior session's subagent report, which may be
 * stale since Clusters A-F already renamed a large share of it).
 *
 * Heuristic: an identifier is flagged PT-suspect if it contains a
 * non-ASCII letter, OR matches a curated list of common Portuguese words/
 * morphemes that have appeared repeatedly as real findings this session
 * (nome, endereco, cidade, estado, pais, responsavel, telefone, data_,
 * numero, valor, tipo_, status is EN so excluded, etc.) and is NOT in the
 * legal/allowlist below. This is a recall-biased heuristic (over-flag,
 * then human/agent triage each hit) -- it is not a naming oracle by
 * itself, and every hit still needs the same trace-before-rename
 * discipline used in Clusters A-F.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTITIES_PATH = path.resolve(__dirname, '../apps/api/src/database/entities.ts');
const src = fs.readFileSync(ENTITIES_PATH, 'utf8');

// LEGAL_DOMAIN_INTENTIONAL + already-ratified exceptions from the canonical map.
const ALLOWLIST = new Set([
  'cpf', 'cpf_encrypted', 'cnpj', 'cnpj_encrypted', 'cpf_cnpj', 'cpf_cnpj_encrypted',
  'cfop', 'iss', 'issqn', 'aliquota_iss', 'iss_retido', 'pis', 'cofins', 'inss',
  'ir', 'ir_amount', 'csll', 'base_calculo', 'aliquota', 'natureza_operacao',
  'codigo_servico_municipal', 'codigo_municipio', 'inscricao_estadual', 'inscricao_municipal',
  'regime_tributario', 'simples_nacional', 'lucro_presumido', 'lucro_real',
  'nfse', 'nfe', 'nfce', 'tipo_nota', 'serie', 'tomador', 'tomador_cnpj',
  'tomador_inscricao_estadual', 'tomador_inscricao_municipal',
  'tomador_email', 'tomador_uf', 'tomador_cep', 'tomador_doc_encrypted', 'prestador',
  'prestador_id', 'nota_fiscal', 'numero_nota_fiscal',
  // display-label infra, not identifiers
  'field-labels',
]);

interface EntityBlock { className: string; tableName: string | null; start: number; end: number; }

function extractEntityBlocks(): EntityBlock[] {
  const blocks: EntityBlock[] = [];
  const classRe = /@Entity\('([^']+)'\)[^\n]*\n(?:@[A-Za-z]+\([^)]*\)\s*\n)*export class (\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(src))) {
    const tableName = m[1];
    const className = m[2];
    const start = m.index;
    const end = src.indexOf('\n}', start);
    blocks.push({ className, tableName, start, end: end === -1 ? src.length : end });
  }
  return blocks;
}

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

interface ColumnHit {
  table: string;
  className: string;
  field: string;
  columnOverride: string | null;
  type: string | null;
}

function main() {
  const blocks = extractEntityBlocks();
  const hits: ColumnHit[] = [];
  const colRe = /@Column\(\{([^}]*)\}\)\s*([A-Za-z_][A-Za-z0-9_]*)\s*[?!]?:/g;

  for (const block of blocks) {
    const blockSrc = src.slice(block.start, block.end);
    let m: RegExpExecArray | null;
    colRe.lastIndex = 0;
    while ((m = colRe.exec(blockSrc))) {
      const options = m[1];
      const field = m[2];
      if (!isPtSuspect(field)) continue;
      const typeMatch = /type:\s*'([^']+)'/.exec(options);
      const nameMatch = /name:\s*'([^']+)'/.exec(options);
      hits.push({
        table: block.tableName ?? '(unknown)',
        className: block.className,
        field,
        columnOverride: nameMatch ? nameMatch[1] : null,
        type: typeMatch ? typeMatch[1] : null,
      });
    }
  }

  hits.sort((a, b) => (a.table + a.field).localeCompare(b.table + b.field));

  const outPath = path.resolve(__dirname, 'pt-column-census.jsonl');
  fs.writeFileSync(outPath, hits.map((h) => JSON.stringify(h)).join('\n') + '\n');

  console.log(`Entities scanned: ${blocks.length}`);
  console.log(`PT-suspect physical columns found: ${hits.length}`);
  console.log(`Output: ${outPath}`);

  const byTable = new Map<string, number>();
  for (const h of hits) byTable.set(h.table, (byTable.get(h.table) ?? 0) + 1);
  const sortedTables = [...byTable.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\nBy table:');
  for (const [table, count] of sortedTables) console.log(`  ${table}: ${count}`);
}

main();
