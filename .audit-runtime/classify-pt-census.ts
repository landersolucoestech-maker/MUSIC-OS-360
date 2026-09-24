/**
 * Individual (non-grouped) classification of every item in
 * pt-column-census.jsonl, per naming-closure Phase 2. For each physical
 * PT-suspect column found by the mechanical census, checks two real,
 * verifiable signals mechanically:
 *
 *   1. Is the field's key present in that table's DTO source (create/update)?
 *   2. Is the field declared in that table's Reports form-contract, and if
 *      so as col() (form + bulk-import writable) or ro() (report-only,
 *      neither form nor bulk-import can write it)?
 *
 * This mirrors exactly the two writer paths this session proved matter
 * (real form/DTO, and the Reports bulk-import engine's importableColumns)
 * after the works.compositor near-miss -- a field absent from both is a
 * strong dead-column candidate; present in either is presumptively live
 * and NOT a naming/collision finding (just an as-yet-untranslated PT
 * identifier, which is a much larger, separate initiative, not part of
 * this mission's Cluster A-G scope).
 *
 * This script does NOT itself decide "drop this column" -- that still
 * requires the full human-grade trace this session used for compositor/
 * compositores/interpretes/produtores/participacao. It produces the
 * individual, mechanical first-pass disposition the mission's Phase 2
 * requires, flagging anything that looks dead-on-both-signals for actual
 * manual investigation, and closing everything else with real evidence
 * (not a grouped "not yet audited" bucket).
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.resolve(__dirname, '../apps/api/src');

const census = fs
  .readFileSync(path.resolve(__dirname, 'pt-column-census.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l) as { table: string; className: string; field: string });

const contractsSrc = fs.readFileSync(
  path.join(API_SRC, 'modules/reports/form-contracts/report-form-contracts.ts'),
  'utf8',
);

// Map table -> module dir guess (for DTO lookup), covering every table in the census.
const TABLE_MODULE: Record<string, string> = {
  artists: 'artists',
  clients: 'clients',
  content_detections: 'content-detection',
  employees: 'hr',
  events: 'events',
  inventory_items: 'inventory',
  invoices: 'invoices',
  leads: 'leads',
  licenses: 'licensing',
  phonograms: 'phonograms',
  project_tracks: 'projects',
  releases: 'releases',
  shares: 'shares',
  takedowns: 'takedowns',
  transactions: 'transactions',
  works: 'works',
};

function findDtoSources(table: string): string {
  const guess = TABLE_MODULE[table];
  if (!guess) return '';
  const dir = path.join(API_SRC, 'modules', guess, 'dto');
  if (!fs.existsSync(dir)) return '';
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.dto.ts'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
}

function contractStatus(table: string, field: string): 'col' | 'ro' | 'meta' | 'absent' {
  // Find this table's contract block heuristically: from `tableName: '<table>'`
  // to the next `tableName:` occurrence.
  const marker = `tableName: '${table}',`;
  const start = contractsSrc.indexOf(marker);
  if (start === -1) return 'absent';
  const nextMarker = contractsSrc.indexOf("tableName: '", start + marker.length);
  const block = contractsSrc.slice(start, nextMarker === -1 ? undefined : nextMarker);
  const colRe = new RegExp(`col\\('${field}'`);
  const roRe = new RegExp(`ro\\('${field}'`);
  const metaRe = new RegExp(`meta\\('${field}'`);
  const encRe = new RegExp(`enc\\('[^']+',\\s*'${field}'`);
  if (colRe.test(block)) return 'col';
  if (encRe.test(block)) return 'col'; // enc() is a col() variant for encrypted fields -- equally live/writable.
  if (roRe.test(block)) return 'ro';
  if (metaRe.test(block)) return 'meta';
  return 'absent';
}

interface Classified {
  table: string;
  field: string;
  dtoPresent: boolean;
  contract: 'col' | 'ro' | 'meta' | 'absent';
  disposition: string;
}

const results: Classified[] = census.map((row) => {
  const dtoSrc = findDtoSources(row.table);
  const dtoPresent = dtoSrc.length > 0 && new RegExp(`\\b${row.field}\\??:`).test(dtoSrc);
  const contract = contractStatus(row.table, row.field);

  let disposition: string;
  if (contract === 'col') {
    // col()/enc() presence is the authoritative live-writability signal --
    // it accounts for alias-mapped DTOs (e.g. clients' English DTO ->
    // Portuguese physical column via normalizeClientPayload()) that a
    // literal-name DTO regex can't see. Confirmed against clients/leads
    // (Cluster D precedent) and takedowns/licenses (intentional dual FK +
    // free-text model) by manual trace this session.
    disposition = 'LIVE_CANONICAL_PT — real, bulk-import-writable form column per the Reports contract (accounts for alias-mapped DTOs); established single-source PT identifier, not a naming collision or dead-schema finding (full-schema Anglicization is a separate, larger initiative outside this mission)';
  } else if (dtoPresent) {
    disposition = 'LIVE_DTO_NOT_IN_CONTRACT — accepted by the DTO but not listed in the Reports contract (so not bulk-importable); check whether the real UI form actually uses it before assuming dead';
  } else if (contract === 'ro' || contract === 'meta') {
    disposition = 'REPORT_ONLY — declared read-only/derived in the contract, not form-writable; not a bug by itself unless a business rule silently depends on it (verify case-by-case before touching)';
  } else {
    disposition = 'DEAD_CANDIDATE — absent from DTO and from report contract; needs manual trace before any action (matches the pattern that was genuinely dead for phonograms.compositores/interpretes/produtores, and the pattern for project_tracks/origem_externa* -- both traced manually this session, see canonical map)';
  }

  return { table: row.table, field: row.field, dtoPresent, contract, disposition };
});

const outPath = path.resolve(__dirname, 'pt-census-classified.jsonl');
fs.writeFileSync(outPath, results.map((r) => JSON.stringify(r)).join('\n') + '\n');

console.log(`Classified: ${results.length}`);
const byDisposition = new Map<string, number>();
for (const r of results) {
  const key = r.disposition.split(' — ')[0];
  byDisposition.set(key, (byDisposition.get(key) ?? 0) + 1);
}
console.log('\nBy disposition:');
for (const [d, c] of [...byDisposition.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${d}: ${c}`);
}
console.log(`\nOutput: ${outPath}`);

console.log('\n=== DEAD_CANDIDATE and NEEDS_MANUAL_TRACE items (require real investigation) ===');
for (const r of results) {
  if (r.disposition.startsWith('DEAD_CANDIDATE') || r.disposition.startsWith('NEEDS_MANUAL_TRACE')) {
    console.log(`  ${r.table}.${r.field} — dto=${r.dtoPresent} contract=${r.contract}`);
  }
}
