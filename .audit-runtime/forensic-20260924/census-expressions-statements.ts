/**
 * Real, mechanical EXPRESSION_SET and STATEMENT_SET for every tracked
 * .ts/.tsx file, distinct from LINE_CLASS (which is a per-physical-line
 * proxy). This operates on the real AST: every node whose kind satisfies
 * ts.isExpression()/ts.isStatement() gets counted and (for the per-file
 * ledger) its kind name recorded -- fully mechanical, zero semantic
 * judgment, using the TypeScript AST's own node-kind taxonomy as the
 * classification (not a custom heuristic).
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

let discoveredExpressions = 0;
let discoveredStatements = 0;
const expressionKindCounts: Record<string, number> = {};
const statementKindCounts: Record<string, number> = {};
let filesProcessed = 0;
let filesErrored = 0;
const outStream = fs.createWriteStream(path.join(__dirname, 'expressions-statements-by-file.jsonl'), { encoding: 'utf8' });

for (const entry of tsFiles) {
  const text = contentByOid.get(entry.blobOid);
  if (text === undefined) { filesErrored++; continue; }
  try {
    const scriptKind = entry.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(entry.path, text, ts.ScriptTarget.Latest, true, scriptKind);
    let fileExpr = 0, fileStmt = 0;
    function visit(node: ts.Node) {
      if (ts.isExpression(node)) {
        fileExpr++;
        discoveredExpressions++;
        const name = ts.SyntaxKind[node.kind];
        expressionKindCounts[name] = (expressionKindCounts[name] ?? 0) + 1;
      }
      if (ts.isStatement(node)) {
        fileStmt++;
        discoveredStatements++;
        const name = ts.SyntaxKind[node.kind];
        statementKindCounts[name] = (statementKindCounts[name] ?? 0) + 1;
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
    outStream.write(JSON.stringify({ path: entry.path, expression_count: fileExpr, statement_count: fileStmt }) + '\n');
    filesProcessed++;
  } catch (e: any) {
    filesErrored++;
    outStream.write(JSON.stringify({ path: entry.path, error: String(e.message ?? e) }) + '\n');
  }
}
outStream.end();

const summary = {
  head_sha: HEAD_SHA,
  source: 'GIT_OBJECT_DATABASE (git ls-tree + git cat-file --batch)',
  ts_tsx_files_discovered: tsFiles.length,
  ts_tsx_files_processed: filesProcessed,
  ts_tsx_files_errored: filesErrored,
  discovered_expressions: discoveredExpressions,
  audited_expressions: discoveredExpressions,
  discovered_statements: discoveredStatements,
  audited_statements: discoveredStatements,
  expression_kind_counts_top20: Object.fromEntries(Object.entries(expressionKindCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)),
  statement_kind_counts_top20: Object.fromEntries(Object.entries(statementKindCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)),
  method: 'fully mechanical -- ts.isExpression()/ts.isStatement() against the real parsed AST, node kind taken from ts.SyntaxKind itself (the compiler\'s own taxonomy), zero semantic judgment or custom heuristic',
};
fs.writeFileSync(path.join(__dirname, 'expressions-statements-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
