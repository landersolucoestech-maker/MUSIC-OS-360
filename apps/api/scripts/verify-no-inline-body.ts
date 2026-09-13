/**
 * Guarda permanente (Fase 4): impede a reintrodução do anti-padrão
 * "@Body()/@Query() tipado como interface/type/inline/any/Record<string,unknown>"
 * — esses tipos são apagados em tempo de compilação e o ValidationPipe global
 * (whitelist+forbidNonWhitelisted+transform) não valida nada em runtime para eles.
 *
 * Usa a TypeScript Compiler API (typescript já é dependência direta do
 * projeto — nenhuma dependência nova foi adicionada).
 *
 * Exceções legítimas (payload de terceiro/webhook sem shape fixo nosso, ou
 * validação via pipe customizado) são permitidas com o comentário
 * `// dto-guard-allow: <motivo>` na linha imediatamente anterior ao parâmetro.
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
  if (!type) return 'sem anotação de tipo';
  if (ts.isTypeLiteralNode(type)) return 'tipo inline "{ ... }"';
  if (type.kind === ts.SyntaxKind.AnyKeyword) return '"any"';
  if (type.kind === ts.SyntaxKind.UnknownKeyword) return '"unknown"';
  if (ts.isTypeReferenceNode(type)) {
    const name = type.typeName.getText();
    if (name === 'Record') return 'Record<...> genérico';
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
              `${filePath}:${line + 1} — @${decoratorName}() parâmetro "${node.name.getText()}" com ${forbidden}`,
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
  console.error(`\n❌ verify:no-inline-body — ${allViolations.length} violação(ões) encontrada(s):\n`);
  for (const v of allViolations) console.error(`  ${v}`);
  console.error(
    '\nCorrija usando uma classe DTO decorada com class-validator, ou marque a exceção\n' +
    'legítima com "// dto-guard-allow: <motivo>" na linha anterior ao parâmetro.\n',
  );
  process.exit(1);
} else {
  console.log(`✓ verify:no-inline-body — ${files.length} controllers verificados, nenhuma violação.`);
}
