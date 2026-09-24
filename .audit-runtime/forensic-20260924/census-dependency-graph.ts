/**
 * Real, mechanical dependency-edge graph for every tracked .ts/.tsx file
 * (excluding .d.ts), sourced from the git object database. For each file,
 * parses its import/export-from declarations via the TS AST (not regex),
 * resolves each specifier to a real repo-relative target path where
 * possible, and classifies the edge deterministically:
 *
 *   EXTERNAL_PACKAGE   - bare specifier resolving to node_modules (not
 *                        traced further -- external dependency, not part
 *                        of this repo's internal graph)
 *   UNRESOLVED         - relative/path-alias specifier that doesn't match
 *                        any real tracked file (dead import or resolved
 *                        via a mechanism this script doesn't model, e.g.
 *                        a bundler-only alias) -- flagged, not hidden
 *   INTRA_APP          - both files under the same top-level app (apps/api
 *                        or apps/web)
 *   CROSS_APP          - apps/api <-> apps/web (a real, serious boundary
 *                        violation if found -- both prior agent audits
 *                        this session found zero of these; this is the
 *                        first exhaustive, 100%-file mechanical check)
 *   PACKAGE_IMPORT     - target resolves into packages/*
 *   ROOT_LEVEL         - target resolves outside apps/* and packages/*
 *                        (e.g. server/, root scripts)
 */
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const HEAD_SHA = execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
const lsTreeOut = execSync(`git ls-tree -r ${HEAD_SHA}`, { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
const allEntries = lsTreeOut
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [meta, filePath] = line.split('\t');
    const [, , oid] = meta.split(' ');
    return { path: filePath, blobOid: oid };
  });
const tsFiles = allEntries.filter((e) => /\.(ts|tsx)$/.test(e.path) && !e.path.endsWith('.d.ts'));
const allTrackedPathSet = new Set(allEntries.map((e) => e.path));

const batchInput = tsFiles.map((e) => e.blobOid).join('\n');
const result = spawnSync('git', ['cat-file', '--batch'], { cwd: REPO_ROOT, input: batchInput, maxBuffer: 1024 * 1024 * 1024 });
if (result.status !== 0) throw new Error(`git cat-file --batch failed: ${result.stderr?.toString()}`);
const outBuf: Buffer = result.stdout;
const contentByOid = new Map<string, string>();
{
  let offset = 0;
  while (offset < outBuf.length) {
    const headerEnd = outBuf.indexOf(0x0a, offset);
    if (headerEnd === -1) break;
    const header = outBuf.subarray(offset, headerEnd).toString('utf8');
    const [sha, , sizeStr] = header.split(' ');
    const size = parseInt(sizeStr, 10);
    const contentStart = headerEnd + 1;
    contentByOid.set(sha, outBuf.subarray(contentStart, contentStart + size).toString('utf8'));
    offset = contentStart + size + 1;
  }
}

// Known path-alias prefixes used in this repo's tsconfig files (checked
// against apps/api/tsconfig.json and apps/web/tsconfig.app.json's real
// "paths" entries rather than assumed).
function loadAliases(tsconfigRelPath: string, appRoot: string): Array<{ prefix: string; target: string }> {
  const abs = path.join(REPO_ROOT, tsconfigRelPath);
  if (!fs.existsSync(abs)) return [];
  try {
    const raw = fs.readFileSync(abs, 'utf8');
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
    const paths = json.compilerOptions?.paths ?? {};
    const baseUrl = json.compilerOptions?.baseUrl ?? '.';
    const out: Array<{ prefix: string; target: string }> = [];
    for (const [key, vals] of Object.entries(paths as Record<string, string[]>)) {
      const prefix = key.replace(/\*$/, '');
      const targetRaw = (vals as string[])[0]?.replace(/\*$/, '') ?? '';
      const target = path.join(appRoot, baseUrl, targetRaw);
      out.push({ prefix, target });
    }
    return out;
  } catch {
    return [];
  }
}
const aliasMap: Array<{ prefix: string; target: string; scopeApp: string }> = [
  ...loadAliases('apps/api/tsconfig.json', 'apps/api').map((a) => ({ ...a, scopeApp: 'apps/api' })),
  ...loadAliases('apps/web/tsconfig.app.json', 'apps/web').map((a) => ({ ...a, scopeApp: 'apps/web' })),
];

function resolveSpecifier(specifier: string, fromFile: string): { kind: string; target: string | null } {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    // Try alias match first (scoped to the importing file's own app).
    const fromApp = fromFile.startsWith('apps/api/') ? 'apps/api' : fromFile.startsWith('apps/web/') ? 'apps/web' : null;
    for (const alias of aliasMap) {
      if (alias.scopeApp !== fromApp) continue;
      if (specifier.startsWith(alias.prefix)) {
        const rest = specifier.slice(alias.prefix.length);
        const resolved = path.posix.join(alias.target.replace(/\\/g, '/'), rest);
        return tryResolveToTracked(resolved);
      }
    }
    return { kind: 'EXTERNAL_PACKAGE', target: null };
  }
  const fromDir = path.posix.dirname(fromFile);
  const resolved = path.posix.normalize(path.posix.join(fromDir, specifier));
  return tryResolveToTracked(resolved);
}

function tryResolveToTracked(basePathMaybeExt: string): { kind: string; target: string | null } {
  // ESM NodeNext convention: source may literally specify "./env.js" for a
  // file that's really env.ts (the .js is the OUTPUT extension, valid TS
  // syntax) -- strip a trailing .js/.mjs before retrying.
  const basePathNoExt = basePathMaybeExt.replace(/\.(js|mjs)$/, '');
  const candidates = [
    basePathMaybeExt,
    basePathNoExt,
    `${basePathNoExt}.ts`,
    `${basePathNoExt}.tsx`,
    `${basePathNoExt}.js`,
    `${basePathNoExt}.mjs`,
    `${basePathNoExt}/index.ts`,
    `${basePathNoExt}/index.tsx`,
  ];
  for (const c of candidates) {
    if (allTrackedPathSet.has(c)) return { kind: 'RESOLVED', target: c };
  }
  return { kind: 'UNRESOLVED', target: null };
}

function classifyEdge(from: string, to: string): string {
  const fromApp = from.startsWith('apps/api/') ? 'apps/api' : from.startsWith('apps/web/') ? 'apps/web' : from.startsWith('packages/') ? 'packages' : 'root';
  const toApp = to.startsWith('apps/api/') ? 'apps/api' : to.startsWith('apps/web/') ? 'apps/web' : to.startsWith('packages/') ? 'packages' : 'root';
  if (fromApp === 'apps/api' && toApp === 'apps/web') return 'CROSS_APP';
  if (fromApp === 'apps/web' && toApp === 'apps/api') return 'CROSS_APP';
  if (toApp === 'packages') return 'PACKAGE_IMPORT';
  if (fromApp === toApp) return 'INTRA_APP';
  return 'ROOT_LEVEL';
}

interface EdgeRow { from: string; to_specifier: string; resolution: string; to_path: string | null; edge_class: string | null; }
const edges: EdgeRow[] = [];
let filesProcessed = 0;
let filesErrored = 0;

for (const entry of tsFiles) {
  const text = contentByOid.get(entry.blobOid);
  if (text === undefined) { filesErrored++; continue; }
  try {
    const scriptKind = entry.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(entry.path, text, ts.ScriptTarget.Latest, true, scriptKind);
    sf.forEachChild((node) => {
      let specifier: string | null = null;
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      if (specifier === null) return;
      const { kind, target } = resolveSpecifier(specifier, entry.path);
      const edgeClass = kind === 'RESOLVED' && target ? classifyEdge(entry.path, target) : null;
      edges.push({ from: entry.path, to_specifier: specifier, resolution: kind, to_path: target, edge_class: edgeClass });
    });
    filesProcessed++;
  } catch (e: any) {
    filesErrored++;
  }
}

const outStream = fs.createWriteStream(path.join(__dirname, 'dependency-edges.jsonl'), { encoding: 'utf8' });
for (const e of edges) outStream.write(JSON.stringify(e) + '\n');
outStream.end();

const byResolution: Record<string, number> = {};
const byClass: Record<string, number> = {};
for (const e of edges) {
  byResolution[e.resolution] = (byResolution[e.resolution] ?? 0) + 1;
  if (e.edge_class) byClass[e.edge_class] = (byClass[e.edge_class] ?? 0) + 1;
}
const crossAppEdges = edges.filter((e) => e.edge_class === 'CROSS_APP');

const summary = {
  head_sha: HEAD_SHA,
  source: 'GIT_OBJECT_DATABASE (git ls-tree + git cat-file --batch)',
  ts_tsx_files_discovered: tsFiles.length,
  ts_tsx_files_processed: filesProcessed,
  ts_tsx_files_errored: filesErrored,
  discovered_import_export_edges: edges.length,
  classified_edges: edges.filter((e) => e.edge_class !== null).length,
  unclassified_edges_reason: byResolution,
  edge_class_counts: byClass,
  cross_app_boundary_violations: crossAppEdges.length,
  cross_app_boundary_violation_details: crossAppEdges,
};
fs.writeFileSync(path.join(__dirname, 'dependency-edges-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
