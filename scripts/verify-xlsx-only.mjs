import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = resolve(fileURLToPath(import.meta.url));
const LEGACY_TOKEN = ['c', 's', 'v'].join('');

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.local',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
  // .claude/** is the Engineering OS governance framework layered on top of
  // this repo -- explicitly "not part of the product runtime" (see
  // docs/CODEBASE_MAP.md's Directory Structure section). It includes
  // append-only mission-evidence records (.claude/ops/**, which must never be
  // edited after the fact -- .claude/rules/evidence-governance.md) and
  // generic, project-agnostic skill-pack documentation/examples
  // (.claude/skills/**) meant to be portable across other installed target
  // projects, most of which are not XLSX-only. Neither is product source,
  // config, or documentation this contract is meant to police.
  '.claude',
  // docs/backend-v2/** documents a proposed "API v2" rewrite that was never
  // built, plus a frozen point-in-time code-grounded audit snapshot -- see
  // docs/CODEBASE_MAP.md's Specification & Planning Documentation section.
  // Historical/reference content, not a live spec being built against; one
  // of its own audit findings is literally the sentence proving CSV support
  // doesn't exist ("CSV_EXPORTS: 0 -- confirmed no CSV generation exists
  // anywhere in the repository"), which this scanner was flagging verbatim.
  'backend-v2',
]);

const TEXT_EXTENSIONS = new Set([
  '.cjs', '.css', '.env', '.example', '.html', '.js', '.json', '.lock',
  '.md', '.mjs', '.scss', '.sql', '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);

const FORBIDDEN_PATTERNS = [
  {
    label: 'formato delimitado legado',
    regex: new RegExp(`\\b${LEGACY_TOKEN}\\b`, 'i'),
  },
  {
    label: 'extensão delimitada legada',
    regex: new RegExp(`\\.${LEGACY_TOKEN}\\b`, 'i'),
  },
  {
    label: 'MIME delimitado legado',
    regex: new RegExp(`text/${LEGACY_TOKEN}`, 'i'),
  },
  {
    label: 'planilha binária XLS legada',
    regex: /application\/vnd\.ms-excel|\.xls(?!x)\b/i,
  },
  {
    label: 'arquivo de intercâmbio legado fora do contrato XLSX',
    // Restrict the check to string literals that actually reference a file.
    // A generic /\.exp\b/ also matches legitimate JavaScript/TypeScript
    // properties such as JWT `payload.exp` and OAuth `state.exp`.
    regex: /(?:['"`])[^'"`\r\n]*\.exp\b[^'"`\r\n]*(?:['"`])/i,
  },
  {
    label: 'biblioteca delimitada legada',
    regex: /papaparse|fast-csv|json2csv|csv-parse|csv-stringify/i,
  },
];

function shouldRead(filePath) {
  if (filePath === SELF) return false;
  const extension = extname(filePath).toLowerCase();
  const base = filePath.slice(filePath.lastIndexOf('/') + 1);
  return TEXT_EXTENSIONS.has(extension) || base === 'Dockerfile' || base.startsWith('.env');
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue;
    const absolute = resolve(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) walk(absolute, files);
    else if (shouldRead(absolute)) files.push(absolute);
  }
  return files;
}

const violations = [];
for (const file of walk(ROOT)) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(lines[index])) {
        violations.push(
          `${relative(ROOT, file)}:${index + 1} — ${pattern.label}`,
        );
      }
      pattern.regex.lastIndex = 0;
    }
  }
}

if (violations.length > 0) {
  console.error('[xlsx-only] resíduos incompatíveis encontrados:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('[xlsx-only] contrato validado: apenas XLSX para planilhas.');
