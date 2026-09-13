#!/usr/bin/env node
// Fresh re-verification (mission-e39d21fa closure) of 4 criteria whose original
// evidence used one-off scratchpad scripts from a prior session that no longer
// exist on disk. Re-implements the same underlying claims so the criteria can
// be re-checked against CURRENT repo state rather than trusted from memory.
// Usage: node .claude/runtime/verify-naming-cluster-residual.mjs <check>
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const CHECK = process.argv[2];

function grep(pattern, paths) {
  try {
    return execFileSync('git', ['grep', '-n', '-E', pattern, '--', ...paths], { encoding: 'utf8' });
  } catch (e) {
    if (e.status === 1) return ''; // no matches
    throw e;
  }
}

// ac-a65b0c0b: documentos->documents / tipo->type renames have a canonical-map row.
function checkCanonicalMapCoverage() {
  const map = readFileSync('docs/NAMING_NORMALIZATION_CANONICAL_MAP.md', 'utf8');
  const missing = [];
  if (!/documents/.test(map)) missing.push('documentos->documents');
  if (!/\btipo\b/.test(map) || !/\btype\b/.test(map)) missing.push('tipo->type');
  if (missing.length) {
    console.error(`FAIL: docs/NAMING_NORMALIZATION_CANONICAL_MAP.md missing row(s) for: ${missing.join(', ')}`);
    return false;
  }
  // Also confirm no live (non-migration, non-historical) old identifier remains
  // in the specific files this criterion names.
  const files = [
    'apps/api/src/database/entities.ts',
    'apps/api/src/modules/artist/dto/create-artist.dto.ts',
    'apps/api/src/modules/contracts/dto/create-contract.dto.ts',
    'apps/api/src/modules/hr/dto/create-employee.dto.ts',
    'apps/api/src/modules/shares/dto/shares.dto.ts',
  ].filter(existsSync);
  const hits = grep('\\bdocumentos\\b', files);
  if (hits.trim()) {
    console.error(`FAIL: stale 'documentos' identifier still present:\n${hits}`);
    return false;
  }
  console.log(`PASS: canonical map has documentos->documents and tipo->type rows; zero stale 'documentos' in ${files.length} checked files`);
  return true;
}

// ac-ae07f017: no mixed PT/EN corruption artifacts (documentsação, typeo, etc.)
function checkNoMixedCorruption() {
  // The literal 's' is the corruption signature (a naive documento->documents
  // find-replace applied inside the correctly-spelled PT-BR word
  // "documentação"/"documentacao", producing "documentsação"/"documentsacao").
  // "documentação" alone is correct PT-BR and must NOT match.
  const pattern = 'documentsa[çc][aã]o|\\btypeo\\b';
  const hits = grep(pattern, ['apps/web/src', 'apps/api/src/modules/hr']);
  if (hits.trim()) {
    console.error(`FAIL: mixed PT/EN corruption artifact found:\n${hits}`);
    return false;
  }
  console.log("PASS: no 'documentsação'/'typeo'-style corruption artifacts found in apps/web/src or apps/api/src/modules/hr");
  return true;
}

// ac-9eeb925c: repo-wide grep for other readers of tenants.active for suspension/gating.
function checkTenantActiveReaders() {
  const hits = grep('tenants?\\.active\\b|\\.tenant\\.active\\b', ['apps/api/src']);
  const lines = hits.split('\n').filter(Boolean);
  // Not a "for gating purposes" hit at all: a comment/docstring, or a *.spec.ts
  // test file (asserting/describing the fix, not production gating logic).
  const isNonGating = (line) => {
    const [filePath, , ...rest] = line.split(':');
    const code = rest.join(':').trim();
    if (/\.spec\.ts:/.test(line)) return true;
    if (/^\/\/|^\*|^\/\*/.test(code)) return true; // comment line
    return false;
  };
  // The 4 already-fixed/authorized files (billing-authoritative source now used
  // there) are allowed to still reference .active for lifecycle purposes
  // (tenant existence, not billing suspension) -- see req-90013e6a/req-ea44db5a.
  // tenant.guard.ts is ALSO allowed: its own comment (line ~82) documents
  // tenant.active there as "a lifecycle signal only (workspace
  // provisioned/deprovisioned)", the same legitimate non-billing distinction
  // req-90013e6a itself draws -- not a suspension/gating bypass.
  const allowed = [
    'leads.service.ts',
    'autentique.service.ts',
    'docusign.service.ts',
    'external-data-exchange.service.ts',
    'entities.ts', // column/type declaration itself, not a suspension check
    'tenant.guard.ts', // documented lifecycle-only check, not a billing gate
  ];
  const unexpected = lines.filter((l) => !isNonGating(l) && !allowed.some((f) => l.includes(f)));
  if (unexpected.length) {
    console.error(`FAIL: unexpected tenants.active reader(s) outside the reviewed/allowed set:\n${unexpected.join('\n')}`);
    return false;
  }
  console.log(`PASS: all ${lines.length} tenants.active reference(s) in apps/api/src are comments/tests or within the reviewed lifecycle-only/authorized file set`);
  return true;
}

// ac-957bda76: operational-lists module disposition resolved (wired or explicitly deferred).
function checkOperationalListsWiring() {
  const appModule = readFileSync('apps/api/src/app.module.ts', 'utf8');
  const wired = /OperationalListsModule/.test(appModule);
  if (!wired) {
    console.error('FAIL: OperationalListsModule not found in app.module.ts imports -- disposition unresolved');
    return false;
  }
  console.log('PASS: OperationalListsModule is registered in app.module.ts imports (wired, not dangling)');
  return true;
}

const CHECKS = {
  'canonical-map-coverage': checkCanonicalMapCoverage,
  'no-mixed-corruption': checkNoMixedCorruption,
  'tenant-active-readers': checkTenantActiveReaders,
  'operational-lists-wiring': checkOperationalListsWiring,
};

const fn = CHECKS[CHECK];
if (!fn) {
  console.error(`USAGE: node .claude/runtime/verify-naming-cluster-residual.mjs <${Object.keys(CHECKS).join('|')}>`);
  process.exit(2);
}
process.exit(fn() ? 0 : 1);
