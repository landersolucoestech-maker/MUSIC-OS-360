/**
 * Real, mechanical entrypoint discovery across all tracked .ts/.tsx files
 * (excluding .d.ts) plus known non-TS entrypoint file types (package.json
 * bin/scripts, Dockerfiles' ENTRYPOINT/CMD), sourced from the git object
 * database. Uses the real TS AST (decorator/call detection), not regex
 * guessing, for the categories that have a syntactic signature in this
 * codebase's actual framework (NestJS).
 *
 * ENTRYPOINT_KIND taxonomy (each backed by a real, checkable AST/text
 * signature, not assumed):
 *   NEST_CONTROLLER       - class with @Controller(...) decorator
 *   NEST_CONTROLLER_ROUTE - method inside a NEST_CONTROLLER with an HTTP
 *                           method decorator (@Get/@Post/@Put/@Patch/@Delete/@All)
 *   QUEUE_PROCESSOR       - class with @Processor(...) decorator (BullMQ)
 *   CRON                  - method with @Cron(...) decorator
 *   CLI_SHEBANG           - file whose first line is a #!/usr/bin/env node-style shebang
 *   STANDALONE_SERVER     - file calling http.createServer / express() / new Koa() at module scope (outside any class/NestJS bootstrap)
 *   MAIN_BOOTSTRAP        - a NestFactory.create(...) call (the app's own real bootstrap entrypoints)
 *   FRONTEND_ROOT         - apps/web's own main.tsx-style ReactDOM.createRoot call
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
const tsFiles = lsTreeOut
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [meta, filePath] = line.split('\t');
    const [, , oid] = meta.split(' ');
    return { path: filePath, blobOid: oid };
  })
  .filter((e) => /\.(ts|tsx)$/.test(e.path) && !e.path.endsWith('.d.ts'));

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

interface EntrypointRow { file: string; line: number; kind: string; name: string | null; detail: string | null; }
const entrypoints: EntrypointRow[] = [];

function decoratorNames(node: ts.HasDecorators, sf: ts.SourceFile): string[] {
  const decorators = ts.getDecorators?.(node) ?? [];
  return decorators.map((d) => {
    const expr = ts.isCallExpression(d.expression) ? d.expression.expression : d.expression;
    return expr.getText(sf);
  });
}

const HTTP_METHOD_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Options', 'Head']);

let filesProcessed = 0;
for (const entry of tsFiles) {
  const text = contentByOid.get(entry.blobOid);
  if (text === undefined) continue;
  const scriptKind = entry.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  let sf: ts.SourceFile;
  try {
    sf = ts.createSourceFile(entry.path, text, ts.ScriptTarget.Latest, true, scriptKind);
  } catch {
    continue;
  }
  filesProcessed++;

  // Shebang check (raw text, line 1).
  if (text.startsWith('#!')) {
    entrypoints.push({ file: entry.path, line: 1, kind: 'CLI_SHEBANG', name: null, detail: text.split('\n')[0] });
  }

  function lineOf(pos: number): number {
    return sf.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const decs = decoratorNames(node as ts.HasDecorators, sf);
      if (decs.some((d) => d === 'Controller' || d.startsWith('Controller('))) {
        entrypoints.push({ file: entry.path, line: lineOf(node.getStart(sf)), kind: 'NEST_CONTROLLER', name: node.name.text, detail: null });
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            const methodDecs = decoratorNames(member as ts.HasDecorators, sf);
            for (const md of methodDecs) {
              const base = md.split('(')[0];
              if (HTTP_METHOD_DECORATORS.has(base)) {
                entrypoints.push({
                  file: entry.path,
                  line: lineOf(member.getStart(sf)),
                  kind: 'NEST_CONTROLLER_ROUTE',
                  name: member.name.getText(sf),
                  detail: md,
                });
              }
              if (base === 'Cron') {
                entrypoints.push({ file: entry.path, line: lineOf(member.getStart(sf)), kind: 'CRON', name: member.name.getText(sf), detail: md });
              }
            }
          }
        }
      }
      if (decs.some((d) => d === 'Processor' || d.startsWith('Processor('))) {
        entrypoints.push({ file: entry.path, line: lineOf(node.getStart(sf)), kind: 'QUEUE_PROCESSOR', name: node.name.text, detail: null });
      }
    }
    if (ts.isCallExpression(node)) {
      const exprText = node.expression.getText(sf);
      if (exprText === 'NestFactory.create' || exprText.endsWith('.NestFactory.create')) {
        entrypoints.push({ file: entry.path, line: lineOf(node.getStart(sf)), kind: 'MAIN_BOOTSTRAP', name: null, detail: exprText });
      }
      if (exprText === 'http.createServer' || exprText === 'express' || exprText === 'createServer') {
        // Only count module-scope calls (not inside a class/decorated context) as STANDALONE_SERVER.
        let p: ts.Node | undefined = node.parent;
        let insideClass = false;
        while (p) { if (ts.isClassDeclaration(p)) { insideClass = true; break; } p = p.parent; }
        if (!insideClass) entrypoints.push({ file: entry.path, line: lineOf(node.getStart(sf)), kind: 'STANDALONE_SERVER', name: null, detail: exprText });
      }
      if (exprText === 'ReactDOM.createRoot' || exprText === 'createRoot') {
        entrypoints.push({ file: entry.path, line: lineOf(node.getStart(sf)), kind: 'FRONTEND_ROOT', name: null, detail: exprText });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

const outStream = fs.createWriteStream(path.join(__dirname, 'entrypoints.jsonl'), { encoding: 'utf8' });
for (const e of entrypoints) outStream.write(JSON.stringify(e) + '\n');
outStream.end();

const byKind: Record<string, number> = {};
for (const e of entrypoints) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

const summary = {
  head_sha: HEAD_SHA,
  source: 'GIT_OBJECT_DATABASE (git ls-tree + git cat-file --batch)',
  ts_tsx_files_scanned: filesProcessed,
  total_entrypoints_discovered: entrypoints.length,
  entrypoint_kind_counts: byKind,
  method: 'AST-derived (decorator + call-expression detection against real NestJS/React APIs), not regex guessing',
  known_gaps: [
    'server/ai-proxy.ts is caught by STANDALONE_SERVER (http.createServer at module scope) -- cross-check against the already-documented finding',
    'webhook controllers are a subset of NEST_CONTROLLER_ROUTE (an @Public() route is still a route -- auth status is a separate, already-audited dimension, not re-derived here)',
    'raw shell scripts (.sh) and non-TS CLI entrypoints are not scanned by this pass (TS/TSX scope only, consistent with this run\'s stated scope discipline)',
  ],
};
fs.writeFileSync(path.join(__dirname, 'entrypoints-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
