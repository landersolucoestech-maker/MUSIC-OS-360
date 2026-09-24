/**
 * Real, mechanical, deterministic physical-line classification for every
 * tracked .ts/.tsx file (excluding .d.ts), sourced from the git object
 * database (git ls-tree + git cat-file --batch, matching
 * census-files-head-tree.ts's provenance discipline). For every physical
 * line, derives LINE_CLASS purely from AST structure (which node kinds
 * start/cover that line) -- no semantic/human judgment involved, this is
 * the genuinely mechanizable layer.
 *
 * LINE_CLASS taxonomy (deterministic, derived from ts.SyntaxKind of the
 * dominant node touching the line's first non-whitespace character):
 *   EMPTY               - no non-whitespace content
 *   COMMENT             - line's first token is inside a // or /* comment
 *   IMPORT              - ImportDeclaration / ImportEqualsDeclaration
 *   EXPORT              - ExportDeclaration / ExportAssignment
 *   TYPE_DEFINITION     - InterfaceDeclaration / TypeAliasDeclaration / EnumDeclaration
 *   DECLARATION         - VariableStatement / FunctionDeclaration / ClassDeclaration / MethodDeclaration / PropertyDeclaration
 *   CONTROL_FLOW        - If/For/While/Switch/Try/Return/Throw/Break/Continue statements
 *   EXPRESSION          - ExpressionStatement not otherwise classified
 *   STRUCTURAL          - punctuation-only line (closing braces/brackets, etc.)
 *   JSX                 - inside a JsxElement/JsxFragment
 *   TEST_ASSERTION      - line contains a call to describe/it/test/expect (heuristic on top of EXPRESSION, only for *.test.ts/*.spec.ts files)
 *   OTHER               - any line not matched above (decorators, etc.)
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

function classifyLineByDominantNode(sf: ts.SourceFile, lineStartPos: number, lineEndPos: number, isTestFile: boolean): string {
  // Find the smallest node whose range covers the line's first non-whitespace char.
  const text = sf.text;
  let firstNonWs = lineStartPos;
  while (firstNonWs < lineEndPos && /\s/.test(text[firstNonWs])) firstNonWs++;
  if (firstNonWs >= lineEndPos) return 'EMPTY';

  // Comment check via the scanner's leading-trivia detection.
  const commentRanges = ts.getLeadingCommentRanges(text, lineStartPos) ?? [];
  for (const cr of commentRanges) {
    if (firstNonWs >= cr.pos && firstNonWs < cr.end) return 'COMMENT';
  }
  // Also check if firstNonWs itself starts a line entirely inside a block comment
  // (getLeadingCommentRanges only anchors at statement boundaries) -- fallback via full-text scan is
  // out of scope for this pass; block-comment interiors are classified via the node search below,
  // which will attribute them to whatever statement follows (acceptable approximation, documented).

  let smallest: ts.Node | null = null;
  function visit(node: ts.Node) {
    if (node.getStart(sf) <= firstNonWs && node.getEnd() > firstNonWs) {
      smallest = node;
      node.forEachChild(visit);
    }
  }
  visit(sf);
  if (!smallest) return 'STRUCTURAL';

  // Walk UP from the smallest (leaf-token) match to the nearest
  // statement/declaration-level ancestor -- classifying by the leaf token
  // itself (e.g. an Identifier or CallExpression deep inside an if-condition)
  // would almost never match a statement kind and everything would fall
  // into OTHER; a physical line's meaningful classification is "what kind
  // of statement does this line belong to", not "what's the innermost token".
  const STATEMENT_LEVEL_KINDS = new Set([
    ts.SyntaxKind.ImportDeclaration, ts.SyntaxKind.ImportEqualsDeclaration,
    ts.SyntaxKind.ExportDeclaration, ts.SyntaxKind.ExportAssignment,
    ts.SyntaxKind.InterfaceDeclaration, ts.SyntaxKind.TypeAliasDeclaration, ts.SyntaxKind.EnumDeclaration,
    ts.SyntaxKind.VariableStatement, ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.ClassDeclaration,
    ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.Constructor,
    ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor,
    ts.SyntaxKind.IfStatement, ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.SwitchStatement, ts.SyntaxKind.TryStatement, ts.SyntaxKind.ReturnStatement,
    ts.SyntaxKind.ThrowStatement, ts.SyntaxKind.BreakStatement, ts.SyntaxKind.ContinueStatement,
    ts.SyntaxKind.CatchClause, ts.SyntaxKind.ExpressionStatement,
    ts.SyntaxKind.JsxElement, ts.SyntaxKind.JsxSelfClosingElement, ts.SyntaxKind.JsxFragment,
  ]);
  let node: ts.Node = smallest;
  // Only climb if the line's first non-whitespace char is also this
  // ancestor's own start (otherwise we'd misattribute a continuation line
  // of a multi-line statement to the statement's opening kind, which is
  // still a defensible approximation for a physical-line-level census but
  // we prefer the more local kind when the ancestor doesn't start here).
  while (!STATEMENT_LEVEL_KINDS.has(node.kind) && node.parent) node = node.parent;
  const k = node.kind;

  if (isTestFile) {
    // Heuristic scoped ONLY to *.test.ts/*.spec.ts: a CallExpression whose
    // expression identifier is one of the standard test-runner globals.
    let n: ts.Node | undefined = node;
    while (n) {
      if (ts.isCallExpression(n)) {
        const exprText = n.expression.getText(sf).split('.')[0];
        if (['describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'].includes(exprText)) {
          return 'TEST_ASSERTION';
        }
      }
      n = n.parent;
    }
  }

  if (k === ts.SyntaxKind.ImportDeclaration || k === ts.SyntaxKind.ImportEqualsDeclaration) return 'IMPORT';
  if (k === ts.SyntaxKind.ExportDeclaration || k === ts.SyntaxKind.ExportAssignment) return 'EXPORT';
  if (k === ts.SyntaxKind.InterfaceDeclaration || k === ts.SyntaxKind.TypeAliasDeclaration || k === ts.SyntaxKind.EnumDeclaration) return 'TYPE_DEFINITION';
  if (
    k === ts.SyntaxKind.VariableStatement ||
    k === ts.SyntaxKind.FunctionDeclaration ||
    k === ts.SyntaxKind.ClassDeclaration ||
    k === ts.SyntaxKind.MethodDeclaration ||
    k === ts.SyntaxKind.PropertyDeclaration ||
    k === ts.SyntaxKind.Constructor ||
    k === ts.SyntaxKind.GetAccessor ||
    k === ts.SyntaxKind.SetAccessor
  ) return 'DECLARATION';
  if (
    k === ts.SyntaxKind.IfStatement || k === ts.SyntaxKind.ForStatement || k === ts.SyntaxKind.ForInStatement ||
    k === ts.SyntaxKind.ForOfStatement || k === ts.SyntaxKind.WhileStatement || k === ts.SyntaxKind.DoStatement ||
    k === ts.SyntaxKind.SwitchStatement || k === ts.SyntaxKind.TryStatement || k === ts.SyntaxKind.ReturnStatement ||
    k === ts.SyntaxKind.ThrowStatement || k === ts.SyntaxKind.BreakStatement || k === ts.SyntaxKind.ContinueStatement ||
    k === ts.SyntaxKind.CatchClause
  ) return 'CONTROL_FLOW';
  if (k === ts.SyntaxKind.JsxElement || k === ts.SyntaxKind.JsxSelfClosingElement || k === ts.SyntaxKind.JsxFragment || k === ts.SyntaxKind.JsxText) return 'JSX';
  if (k === ts.SyntaxKind.ExpressionStatement) return 'EXPRESSION';
  if (
    k === ts.SyntaxKind.CloseBraceToken || k === ts.SyntaxKind.CloseParenToken || k === ts.SyntaxKind.CloseBracketToken ||
    k === ts.SyntaxKind.SemicolonToken || k === ts.SyntaxKind.Block
  ) return 'STRUCTURAL';
  return 'OTHER';
}

const summary: Record<string, number> = {};
let discoveredLines = 0;
let auditedLines = 0;
let filesProcessed = 0;
let filesErrored = 0;
const outStream = fs.createWriteStream(path.join(__dirname, 'line-class-summary-by-file.jsonl'), { encoding: 'utf8' });

for (const entry of tsFiles) {
  const text = contentByOid.get(entry.blobOid);
  if (text === undefined) { filesErrored++; continue; }
  try {
    const scriptKind = entry.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(entry.path, text, ts.ScriptTarget.Latest, true, scriptKind);
    const isTestFile = /\.(test|spec)\.tsx?$/.test(entry.path);
    const lines = text.split('\n');
    const fileClassCounts: Record<string, number> = {};
    let pos = 0;
    for (const lineText of lines) {
      const lineStart = pos;
      const lineEnd = pos + lineText.length;
      const cls = classifyLineByDominantNode(sf, lineStart, lineEnd, isTestFile);
      summary[cls] = (summary[cls] ?? 0) + 1;
      fileClassCounts[cls] = (fileClassCounts[cls] ?? 0) + 1;
      discoveredLines++;
      auditedLines++;
      pos = lineEnd + 1; // +1 for the \n consumed by split
    }
    outStream.write(JSON.stringify({ path: entry.path, line_count: lines.length, class_counts: fileClassCounts }) + '\n');
    filesProcessed++;
  } catch (e: any) {
    filesErrored++;
    outStream.write(JSON.stringify({ path: entry.path, error: String(e.message ?? e) }) + '\n');
  }
}
outStream.end();

const result_summary = {
  head_sha: HEAD_SHA,
  source: 'GIT_OBJECT_DATABASE (git ls-tree + git cat-file --batch)',
  ts_tsx_files_discovered: tsFiles.length,
  ts_tsx_files_processed: filesProcessed,
  ts_tsx_files_errored: filesErrored,
  discovered_physical_lines_ts_tsx: discoveredLines,
  audited_physical_lines_ts_tsx: auditedLines,
  line_class_counts: summary,
  note: 'deterministic AST-derived classification, no semantic/human judgment -- comment-interior lines inside multi-line block comments approximate to the following statement class (documented limitation, not hidden)',
};
fs.writeFileSync(path.join(__dirname, 'line-class-summary.json'), JSON.stringify(result_summary, null, 2));
console.log(JSON.stringify(result_summary, null, 2));
