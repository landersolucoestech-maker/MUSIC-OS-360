/**
 * Real token/AST-node/symbol census for every tracked .ts/.tsx source file
 * (excluding .d.ts), using the TypeScript Compiler API (an existing project
 * dependency -- no new tooling introduced).
 *
 * v2 -- fixes two real bugs found by independent review (AGENT-02,
 * 2026-09-24) in v1's standalone `ts.createScanner` re-lex pass:
 *   1. v1 passed `scriptKind` into createScanner's 3rd positional arg, which
 *      is actually `languageVariant` (Standard=0/JSX=1) -- so JSX close tags
 *      (`</Foo>`) were never recognized as the single LessThanSlashToken,
 *      inflating token_count by 2 tokens each occurrence across all .tsx
 *      files.
 *   2. v1 never called `reScanSlashToken()`, so every regex literal was
 *      fragmented into several spurious punctuation/identifier tokens
 *      instead of one RegularExpressionLiteral token (regex disambiguation
 *      requires parser context, which a bare scan loop doesn't have).
 *
 * Fix: stop re-lexing text independently. Instead derive token_count from
 * the SAME already-correct parser output used for ast_node_count/
 * symbol_count (ts.createSourceFile with setParentNodes=true) by counting
 * leaf nodes of the full-fidelity concrete syntax tree via getChildren() --
 * the real parser already resolves JSX/regex ambiguity correctly (proven:
 * ast_node_count and symbol_count were never affected by the two bugs
 * above, since they come from ts.forEachChild on the same parser output).
 *
 *   - tokens: leaf-node count of the full-fidelity tree (node.getChildren()
 *     recursion; a node with zero children is a token)
 *   - AST nodes: counted via a full recursive ts.forEachChild traversal
 *     (semantic/composite nodes only, as before -- unaffected by the bug)
 *   - top-level named symbols: function/class/interface/type/enum/const/let
 *     declarations at any nesting depth (a real, mechanical symbol surface,
 *     not a claim of full type-checker binding resolution -- that would
 *     require a full program/project build per file, which is a materially
 *     larger and slower undertaking; this is the syntactic symbol surface,
 *     stated as exactly that, not oversold as semantic binding).
 *
 * This is a genuinely executed static pass over real source text. It does
 * NOT attempt full type-checked symbol binding (that requires building a
 * full ts.Program per tsconfig project, which is a materially larger,
 * slower undertaking outside this pass's scope) -- stated explicitly, not
 * hidden.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const trackedRaw = execSync('git ls-files', { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
const files = trackedRaw
  .split('\n')
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'));

interface AstRow {
  path: string;
  token_count: number;
  ast_node_count: number;
  symbol_count: number;
  parse_diagnostics: number;
}

const SYMBOL_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.ModuleDeclaration,
]);

function countAstNodesSymbolsAndTokens(sf: ts.SourceFile): { nodes: number; symbols: number; tokens: number } {
  let nodes = 0;
  let symbols = 0;
  function visit(node: ts.Node) {
    nodes++;
    if (SYMBOL_KINDS.has(node.kind)) symbols++;
    ts.forEachChild(node, visit);
  }
  visit(sf);

  // Token count via the full-fidelity tree's leaves -- reuses the real
  // parser's already-correct JSX/regex disambiguation instead of a
  // separate, context-free re-lex pass. EndOfFileToken excluded to match
  // v1's convention (its while-loop stopped before counting EOF).
  let tokens = 0;
  function visitFull(node: ts.Node) {
    const children = node.getChildren(sf);
    if (children.length === 0) {
      if (node.kind !== ts.SyntaxKind.EndOfFileToken) tokens++;
      return;
    }
    for (const child of children) visitFull(child);
  }
  visitFull(sf);

  return { nodes, symbols, tokens };
}

const rows: AstRow[] = [];
let errors = 0;
const outStream = fs.createWriteStream(path.join(__dirname, 'ast-census.jsonl'), { encoding: 'utf8' });

for (const relPath of files) {
  const abs = path.join(REPO_ROOT, relPath);
  try {
    const text = fs.readFileSync(abs, 'utf8');
    const scriptKind = relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, scriptKind);
    const { nodes, symbols, tokens } = countAstNodesSymbolsAndTokens(sf);
    const parseDiagnostics = (sf as any).parseDiagnostics ? (sf as any).parseDiagnostics.length : 0;
    const row: AstRow = {
      path: relPath,
      token_count: tokens,
      ast_node_count: nodes,
      symbol_count: symbols,
      parse_diagnostics: parseDiagnostics,
    };
    rows.push(row);
    outStream.write(JSON.stringify(row) + '\n');
  } catch (e: any) {
    errors++;
    outStream.write(JSON.stringify({ path: relPath, error: String(e.message ?? e) }) + '\n');
  }
}
outStream.end();

const totalTokens = rows.reduce((a, r) => a + r.token_count, 0);
const totalNodes = rows.reduce((a, r) => a + r.ast_node_count, 0);
const totalSymbols = rows.reduce((a, r) => a + r.symbol_count, 0);
const filesWithParseDiagnostics = rows.filter((r) => r.parse_diagnostics > 0).length;

const summary = {
  discovered_ts_files: files.length,
  audited_ts_files: rows.length,
  read_or_parse_errors: errors,
  files_with_parse_diagnostics: filesWithParseDiagnostics,
  discovered_tokens: totalTokens,
  discovered_ast_nodes: totalNodes,
  discovered_syntactic_symbols: totalSymbols,
  note: 'syntactic symbol surface only -- not full type-checker binding resolution (that requires a full ts.Program build, out of scope for this pass)',
};
fs.writeFileSync(path.join(__dirname, 'ast-census-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
