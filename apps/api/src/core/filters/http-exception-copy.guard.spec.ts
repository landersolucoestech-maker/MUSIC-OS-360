/**
 * Guard: HttpException messages are end-user copy (PT-BR, rendered by the web
 * through toUserMessage()). They must never carry technical identifiers —
 * environment variable names, snake_case/camelCase field keys — nor the
 * internal term "tenant" (canonical PT-BR rendering: "workspace").
 *
 * Endpoints answered to machines (provider webhooks, the metrics scrape,
 * the dev-only auth shortcut) are listed in MACHINE_CONSUMER_FILES and are
 * exempt: their messages are English technical diagnostics by design.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const SRC = path.resolve(__dirname, '../..');

const MACHINE_CONSUMER_FILES = new Set([
  'core/external-data/external-data-exchange.service.ts',
  'core/metrics/metrics.controller.ts',
  'modules/auth/dev-auth.controller.ts',
  'modules/integrations/autentique/autentique.service.ts',
  'modules/integrations/docusign/docusign.service.ts',
  'modules/integrations/external-data.controller.ts',
  'modules/integrations/whatsapp/whatsapp-webhook.controller.ts',
]);

/** English machine responses allowed in otherwise user-facing files. */
const MACHINE_MESSAGES = new Set([
  // Stripe webhook endpoint: answered to Stripe, never rendered.
  'Stripe webhook secret unavailable',
  'Stripe signature missing',
  'Stripe raw body missing',
]);

const ENV_NAME = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;
const SNAKE_KEY = /\b[a-z]+_[a-z0-9_]+\b/;
const CAMEL_KEY = /\b[a-z]+[A-Z][A-Za-z0-9]*\b/;
const TENANT_WORD = /\btenant\b/i;
/** PT-BR copy starts with a capital letter; a bare lowercase key before a verb is a field name. */
const LEADING_FIELD_KEY = /^[a-z][a-z0-9]*\s+(é|são|deve|devem|precisa|não)(?!\p{L})/u;
/** English sentence vocabulary never appears in PT-BR copy. */
const ENGLISH_WORDS =
  /(?<!\p{L})(is|are|must|required|invalid|not found|missing|failed|unavailable|cannot|already exists|not allowed)(?!\p{L})/iu;
const PATTERNS = [ENV_NAME, SNAKE_KEY, CAMEL_KEY, TENANT_WORD, LEADING_FIELD_KEY, ENGLISH_WORDS];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'migrations') out.push(...sourceFiles(full));
    } else if (entry.name.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Literal text of the message argument (string, template head/spans, or { message }). */
function messageTexts(arg: ts.Expression | undefined): string[] {
  if (!arg) return [];
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return [arg.text];
  if (ts.isTemplateExpression(arg)) return [arg.head.text, ...arg.templateSpans.map((s) => s.literal.text)];
  if (ts.isBinaryExpression(arg)) return [...messageTexts(arg.left), ...messageTexts(arg.right)];
  if (ts.isParenthesizedExpression(arg)) return messageTexts(arg.expression);
  if (ts.isObjectLiteralExpression(arg)) {
    const prop = arg.properties.find(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText() === 'message',
    );
    return prop ? messageTexts(prop.initializer) : [];
  }
  return [];
}

function violations(): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    if (MACHINE_CONSUMER_FILES.has(rel)) continue;
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isNewExpression(node) && /Exception$/.test(node.expression.getText(sf))) {
        const text = messageTexts(node.arguments?.[0]).join(' ').trim();
        if (text && !MACHINE_MESSAGES.has(text)) {
          const hit = PATTERNS.find((re) => re.test(text));
          if (hit) {
            const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
            found.push(`${rel}:${line} ${hit} → ${text}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

describe('HttpException end-user copy carries no technical identifiers', () => {
  it('no env var names, field keys or "tenant" in exception messages', () => {
    expect(violations()).toEqual([]);
  });

  describe('self-test of the patterns', () => {
    const flagged = (text: string): boolean => PATTERNS.some((re) => re.test(text));

    it.each([
      ['accented PT-BR', 'Papéis globais do sistema são somente leitura.'],
      ['plural PT-BR', 'Somente o sistema pode criar ou alterar papéis no nível de proprietário.'],
      ['PT-BR with "é"', 'Título é obrigatório.'],
      ['PT-BR with "são"', 'As datas são inválidas.'],
      ['PT-BR guidance', 'Informe o tipo do material.'],
      ['PT-BR with "ausente"', 'Registro inválido ou ausente.'],
    ])('accepts valid PT-BR copy (%s)', (_label, text) => {
      expect(flagged(text)).toBe(false);
    });

    it.each([
      ['English field key before a PT verb', 'title é obrigatório.', LEADING_FIELD_KEY],
      ['English sentence (not found)', 'Artist not found', ENGLISH_WORDS],
      ['English sentence (is invalid)', 'Payload is invalid', ENGLISH_WORDS],
      ['snake_case key', 'contrato_id obrigatório', SNAKE_KEY],
      ['camelCase key', 'assetType é obrigatório', CAMEL_KEY],
      ['env var name', 'defina SOUNDCHARTS_CLIENT_ID', ENV_NAME],
      ['technical "tenant"', 'neste tenant', TENANT_WORD],
    ])('rejects %s', (_label, text, pattern) => {
      expect(pattern.test(text)).toBe(true);
    });
  });
});
