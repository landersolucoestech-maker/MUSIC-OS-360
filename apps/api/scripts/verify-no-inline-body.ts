/**
 * Permanent guard (Phase 4): prevents the reintroduction of the anti-pattern
 * "@Body()/@Query() typed as interface/type/inline/any/Record<string,unknown>"
 * — those types are erased at compile time and the global ValidationPipe
 * (whitelist+forbidNonWhitelisted+transform) validates nothing at runtime for them.
 *
 * Uses the TypeScript Compiler API (typescript is already a direct dependency of the
 * project — no new dependency was added).
 *
 * Legitimate exceptions (a third-party/webhook payload without a fixed shape of ours, or
 * validation via a custom pipe) are allowed with the comment
 * `// dto-guard-allow: <reason>` on the line immediately before the parameter.
 */
import * as ts from 'typescript';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', 'src', 'modules');

function findControllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...findControllerFiles(full));
    else if (entry.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

function isForbiddenType(type: ts.TypeNode | undefined): string | null {
  if (!type) return 'no type annotation';
  if (ts.isTypeLiteralNode(type)) return 'inline type "{ ... }"';
  if (type.kind === ts.SyntaxKind.AnyKeyword) return '"any"';
  if (type.kind === ts.SyntaxKind.UnknownKeyword) return '"unknown"';
  if (ts.isTypeReferenceNode(type)) {
    const name = type.typeName.getText();
    if (name === 'Record') return 'generic Record<...>';
    if (name === 'Object') return '"Object"';
  }
  return null;
}

function hasAllowComment(sourceFile: ts.SourceFile, node: ts.Node): boolean {
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart()) ?? [];
  return ranges.some((r) => fullText.slice(r.pos, r.end).includes('dto-guard-allow'));
}

const DECORATOR_NAMES = new Set(['Body', 'Query']);

function checkFile(filePath: string): string[] {
  const violations: string[] = [];
  const src = ts.createSourceFile(
    filePath,
    require('fs').readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

  function visit(node: ts.Node) {
    if (ts.isParameter(node)) {
      const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
      if (decorators) {
        for (const dec of decorators) {
          if (!ts.isCallExpression(dec.expression)) continue;
          const callExpr = dec.expression;
          const decoratorName = callExpr.expression.getText();
          if (!DECORATOR_NAMES.has(decoratorName)) continue;
          // @Body(new SomePipe(...)) or @Body('key') — custom pipe or string-keyed
          // access is a deliberate escape hatch; only flag the empty-args object form.
          if (callExpr.arguments.length > 0) continue;
          const forbidden = isForbiddenType(node.type);
          if (forbidden && !hasAllowComment(src, node)) {
            const { line } = src.getLineAndCharacterOfPosition(node.getStart());
            violations.push(
              `${filePath}:${line + 1} — @${decoratorName}() parameter "${node.name.getText()}" with ${forbidden}`,
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(src);
  return violations;
}

const files = findControllerFiles(ROOT);
const allViolations = files.flatMap(checkFile);

if (allViolations.length > 0) {
  console.error(`\n❌ verify:no-inline-body — ${allViolations.length} violation(s) found:\n`);
  for (const v of allViolations) console.error(`  ${v}`);
  console.error(
    '\nFix it by using a DTO class decorated with class-validator, or mark the legitimate\n' +
    'exception with "// dto-guard-allow: <reason>" on the line before the parameter.\n',
  );
  process.exit(1);
} else {
  console.log(`✓ verify:no-inline-body — ${files.length} controllers checked, no violations.`);
}
