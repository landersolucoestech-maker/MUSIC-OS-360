#!/usr/bin/env node
/**
 * scripts/naming/technical-naming-census.mjs — technical naming census and CI ratchet.
 *
 * Rule: engineering names are English; Portuguese only in end-user visible
 * frontend content (and in the exception classes of the canonical naming map).
 * The Portuguese vocabulary (pt-lexicon.mjs) is a SIGNAL: a hit is a candidate for
 * semantic review, never an automatic rename.
 *
 * Enforced surfaces (every one ratchets against the baseline; see
 * docs/NAMING_NORMALIZATION_CANONICAL_MAP.md):
 *   identifier     functions, classes, interfaces, types, enums and members, methods,
 *                  properties, variables, parameters, destructured bindings, and member reads
 *                  (`row.titulo`, `row['nome']`)
 *   objectKey      object-literal keys and destructured property names (wire/DB field names)
 *   value          technical string values: enum initializers, string-literal types, and any
 *                  lowercase/camelCase token literal (status values, option values, form field
 *                  names, test ids, query params); UX text is never token-shaped
 *   dbColumn       physical columns declared in apps/api/src/database/entities.ts
 *   filename / directory   every tracked path in the repository
 *   envVar, eventQueueJob, apiRoute, frontendRoute
 *   toolMessage    Portuguese prose (3+ words) in string literals of developer tooling (scripts/, apps/api/scripts/,
 *                  e2e/, infra/, .claude/runtime/): assertion names, log lines, skip reasons. UI text the tooling
 *                  asserts on is a documented exception (exact file, ledger row).
 *   dataFile       technical names inside tracked non-code data files (.sql outside migrations, .json,
 *                  .yml/.yaml, .toml): SQL identifiers (comments and string literals are skipped), JSON
 *                  keys and token-shaped JSON values, YAML/TOML keys
 *   testTitle, comment     Portuguese prose in test titles and code comments
 *   doc            Portuguese prose lines in tracked Markdown documentation
 * The migrated database schema (indexes, constraints, functions, policies, defaults,
 * CHECK values, unmapped columns) is enforced by schema-naming-census.mjs against a live DB.
 *
 * Not scanned: user-facing strings (JSX text, labels, messages — never token-shaped),
 * vendored third-party bundles, published migrations (immutable history: their class
 * names are recorded in the migrations table), mission bookkeeping (.claude/ops) and generated
 * the generated mutation-proof evidence file (docs/naming/audit/compat-mutation-proof.json).
 *
 * Baseline = known, classified debt (technical-naming-baseline.json), keyed by
 * path + kind + name so each entry is traceable. Names registered in the
 * canonical map's exception ledger are not debt and never enter the baseline.
 *
 *   node scripts/naming/technical-naming-census.mjs --check   # CI guard
 *   node scripts/naming/technical-naming-census.mjs --write   # regenerate baseline
 *   node scripts/naming/technical-naming-census.mjs --report  # coverage summary (JSON)
 *   node scripts/naming/technical-naming-census.mjs --list [surface]  # every debt entry
 *
 * --check fails when the current census differs from the baseline in EITHER
 * direction: growth is a new Portuguese technical name; shrinkage means a fixed
 * name whose entry must be removed in the same commit (so it can never be
 * reintroduced silently). Tooling errors (no files, missing baseline, parse
 * failure) exit non-zero; the guard never reports success on an empty scan.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ptWords, isPtProse } from "./pt-lexicon.mjs";
import { ROOT, loadAuthority, exceptionIndex } from "./canonical-map.mjs";
import { physicalColumns } from "./validate-canonical-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE = process.env.NAMING_BASELINE_PATH ? path.resolve(process.env.NAMING_BASELINE_PATH) : path.join(here, "technical-naming-baseline.json");
const require = createRequire(path.join(ROOT, "package.json"));
const ts = require("typescript");

export const SURFACES = ["apiRoute", "comment", "dbColumn", "dataFile", "toolMessage", "directory", "doc", "envVar", "eventQueueJob", "filename", "frontendRoute", "identifier", "objectKey", "testTitle", "value"];
const ENTITIES = "apps/api/src/database/entities.ts";

/** Third-party bundles committed as static assets: not our names. ledger: EXM-VENDORED */
export const VENDORED = new Set(["apps/web/public/pdf.mjs", "apps/web/public/pdf.worker.min.mjs"]);
/**
 * ledger: EXM-DETECTOR-FIXTURES
 * The naming detectors' own vocabulary and test fixtures necessarily contain Portuguese
 * words as data. Their identifiers are still checked; their string values, keys, test
 * titles and comments are not.
 */
export const DETECTOR_FIXTURES = new Set([
  "scripts/naming/pt-lexicon.mjs",
  "scripts/naming/technical-naming-census.mjs",
  "scripts/naming/technical-naming-census.test.mjs",
  "scripts/naming/schema-naming-census.test.mjs",
  "scripts/naming/naming-gates-mutation.test.mjs",
  "apps/api/src/database/pt-column-naming-baseline.guard.spec.ts",
  // old -> new rename table: the legacy Portuguese names are the data it maps away from
  "scripts/run-technical-english-normalization.mjs",
]);
/** Audit tooling (forensic/runtime audit scripts) is detector vocabulary, not product naming. */
export const DETECTOR_FIXTURE_PREFIXES = [".audit-runtime/"];
const isDetectorFixture = (f) => DETECTOR_FIXTURES.has(f) || DETECTOR_FIXTURE_PREFIXES.some((p) => f.startsWith(p));
/**
 * ledger: EXM-USER-INPUT-VOCABULARY
 * Portuguese words that are genuine END-USER INPUT vocabulary in one specific file: surname
 * particles (`das`, `dos`), boolean answers typed in Portuguese spreadsheets and chat (`sim`,
 * `nao`, `verdadeiro`, `falso`), chat navigation commands (`inicio`, `voltar`) and the defensive
 * redaction key `senha`. Exact file + exact value only, so any other string in the file is still checked.
 */
export const USER_INPUT_VOCABULARY = new Map([
  ["apps/web/src/shared/lib/format-name.ts", new Set(["das", "dos"])],
  ["apps/web/src/shared/lib/security.ts", new Set(["senha"])],
  ["apps/web/src/shared/lib/normalize.ts", new Set(["sim", "nao", "não"])],
  ["apps/api/src/modules/reports/import/import-validation.service.ts", new Set(["sim", "nao", "não", "verdadeiro", "falso"])],
  ["apps/api/src/modules/conversations/musicchat-automation.service.ts", new Set(["inicio", "início", "voltar"])],
]);
/**
 * ledger: EXM-PT-CONTENT-VOCABULARY
 * Portuguese words that are the DATA a file processes, not names the engineering team chose:
 * keyword probes of classifiers/planners matched against user-supplied filenames and titles,
 * Portuguese tokens parsed from (or fed to) LLM output and spreadsheet cells, and the example
 * column label of the Portuguese import template. Exact file + exact value, like
 * USER_INPUT_VOCABULARY, so any other string in the file is still checked.
 */
export const PT_CONTENT_VOCABULARY = new Map([
  ["apps/api/src/modules/assets/asset-classification.service.ts", new Set(["capa", "clipe", "videoclipe", "contrato", "guia"])],
  ["apps/api/src/core/automation/project-planning.automation.ts", new Set(["lancamento", "lançamento", "fonograma", "musica", "música", "turne", "turnê", "clipe", "obra"])],
  ["apps/web/src/modules/accounting/data/finance-category-rules.config.ts", new Set(["impulsionamento", "licenciamento", "mixagem", "masterização", "estúdio", "sincronização"])],
  ["apps/api/src/modules/reports/import/import-engine.service.ts", new Set(["exemplo"])],
  ["packages/ai-skills/src/ad-creative/parser.ts", new Set(["neutro", "direto"])],
  ["packages/ai-skills/src/analytics-tracking/prompt.ts", new Set(["nenhum"])],
  ["packages/ai-skills/src/audiovisual-briefing/parser.ts", new Set(["sim", "nao", "não", "videoclipe", "baixo", "médio", "alto"])],
  ["packages/ai-skills/src/campaign-report/parser.ts", new Set(["geral", "cancelada", "concluída", "desempenho"])],
  ["packages/ai-skills/src/campaign-report/prompt.ts", new Set(["cancelada", "concluída"])],
  ["packages/ai-skills/src/campaign-strategy/parser.ts", new Set(["geral"])],
  ["packages/ai-skills/src/catalog-metadata-validator/parser.ts", new Set(["sim", "nao", "não"])],
  ["packages/ai-skills/src/onboarding-cro/prompt.ts", new Set(["pendente", "concluído"])],
  ["packages/ai-skills/src/postiz/parser.ts", new Set(["conectado"])],
  ["packages/ai-skills/src/postiz/prompt.ts", new Set(["não"])],
  ["packages/ai-skills/src/release-checklist/parser.ts", new Set(["sim", "nao", "não"])],
  ["packages/ai-skills/src/release-checklist/prompt.ts", new Set(["sim", "não"])],
  ["packages/ai-skills/src/seo-audit/parser.ts", new Set(["presente", "ausente"])],
  ["packages/ai-skills/src/seo-audit/prompt.ts", new Set(["sim", "não"])],
  ["packages/ai-skills/src/social-content/parser.ts", new Set(["neutro", "direto"])],
  ["packages/ai-skills/src/support-triage/parser.ts", new Set(["sim", "nao", "não", "alta", "baixa", "crítica"])],
]);
/**
 * ledger: EXM-EXTERNAL-PROPERTY-NAMES
 * Property names that belong to a third-party payload we only read: ViaCEP (logradouro, bairro,
 * localidade, uf, ...), IBGE localities (nome, sigla, mesorregiao, ...) and ABRAMUS rows (duracao, compositores, ...). Exact file + exact
 * name; applies to identifier and object-key surfaces.
 */
export const EXTERNAL_PROPERTY_NAMES = new Map([
  ["apps/web/src/shared/lib/masks.ts", new Set(["cep", "logradouro", "complemento", "bairro", "localidade", "uf", "erro"])],
  ["apps/web/src/modules/marketing/components/campaign-builder/useIbgeLocations.ts", new Set(["nome", "sigla", "UF", "mesorregiao", "microrregiao"])],
  // ABRAMUS search rows: vendor-shaped fields read once at the adapter boundary (fromAbramusVendorRow) and mapped to English.
  ["apps/web/src/modules/integrations/hooks/useAbramus.ts", new Set(["duracao", "genero", "compositores", "letristas", "gravadora", "produtores", "data_registro", "artista_nome"])],
]);
/**
 * ledger: EXM-UX-ARGUMENT-CALLEES
 * Calls whose string arguments after the first are user-visible nouns/participles composed
 * into a PT-BR toast ("Obra excluída com sucesso"): handleConcurrencyConflict(err, "evento"),
 * reportBulkResult(result, "excluída", "obra").
 */
export const UX_ARGUMENT_CALLEES = new Set(["handleConcurrencyConflict", "reportBulkResult"]);
/**
 * ledger: EXM-EXTERNAL-TOOL-NAMES
 * Third-party ecosystem file names that collide with Portuguese words ("Cargo.lock" is the Rust
 * lockfile, not "cargo" = job role). Matched exactly and case-sensitively, so a real `cargo`
 * property or column is still reported. Never add a name this repository controls.
 */
export const EXTERNAL_TOOL_NAMES = new Set(["Cargo.lock", "Cargo.toml"]);
/** Published migrations are immutable history (class names are tracked in musicos360_migrations). */
export const isMigration = (f) => /(^|\/)migrations\//.test(f);
/** Mission bookkeeping and generated EVIDENCE: the mutation proof records the legacy names it mutated (evidence about a boundary, not a product surface). Only that one generated file is exempt; any other file under docs/naming/audit is scanned. */
export const GENERATED_EVIDENCE = new Set(["docs/naming/audit/compat-mutation-proof.json"]);
export const isBookkeeping = (f) => f.startsWith(".claude/ops/") || GENERATED_EVIDENCE.has(f);

export const layerOf = (f) => (f.startsWith("apps/web") ? "web" : f.startsWith("apps/api") ? "api" : f.startsWith("packages") ? "packages" : "scripts");
const TECHNICAL_NAME = /^[a-z0-9][a-z0-9_.:-]*$/; // event/queue/job/i18n-key shaped (never a UX label)
/** Token-shaped string values: snake_case, kebab-case or camelCase, starting lowercase, no spaces. Accent-aware (\p{L}): "áudio", "iluminação" are token-shaped too. */
export const VALUE_SHAPE = /^\p{Ll}[\p{L}\p{N}]*(?:[_-][\p{L}\p{N}]+)*$/u;
/**
 * Capitalized / accented Portuguese values that are persisted or compared as DATA ("Comunicação",
 * "Administração Musical": a marketing sector stored verbatim). One to four capitalized words, optionally
 * joined by Portuguese connectors, letters only (no digits or punctuation, so sentences and messages are
 * not matched). Reported only where the literal is data, not text: see isDataPosition.
 */
export const CAPITALIZED_VALUE_SHAPE = /^\p{Lu}\p{Ll}+(?:\s+(?:(?:de|da|do|das|dos|e)\s+)?\p{Lu}\p{Ll}+){0,2}$/u;
/** PT-BR label resources (`*.pt-br.ts`, `*-labels.ts`): their string values are display text by construction. */
export const isLabelResource = (f) => /\.pt-br\.[tj]sx?$/.test(f) || /(^|[-./])labels?\.[tj]sx?$/.test(f);
/** Names of classification fields whose value is persisted/compared verbatim (see CAPITALIZED_VALUE_SHAPE). */
export const PERSISTED_FIELD_KEYS = new Set(["sector", "department", "queue", "segment", "stage", "phase"]);
/**
 * Fixture record ids made of an uppercase code and a number ("ABR-123", "REL-7"): the code is an
 * abbreviation of the fixture, not a Portuguese word (`abr` = abril). Only the trailing code is
 * ignored; every other segment of the value is still checked.
 */
export const stripRecordId = (text) => text.replace(/(^|[-_])[A-Z]{2,6}-\d+$/, "$1");
/** JSX attributes and object properties whose string value is user-visible text. */
const UX_KEYS = new Set(["aria-label", "aria-description", "aria-placeholder", "aria-roledescription", "aria-valuetext", "title", "placeholder",
  "alt", "label", "description", "helperText", "tooltip", "emptyMessage", "emptyText", "subtitle", "hint", "message", "text", "confirmText",
  "cancelText", "itemLabel", "ariaLabel", "sub", "subvalue", "successMessage", "errorMessage", "heading", "caption", "labelPt", "labelPtBr", "displayPtBr"]);

/**
 * Real comments of a source file: the leading trivia of every token in the AST.
 * A regex over the raw text also matched `//` inside URLs and `/*` inside strings such
 * as accept="image/*" (reading until the next `*\/`), producing false positives.
 * JSX text is not trivia and is skipped.
 */
export function sourceComments(sf, text) {
  const seen = new Set();
  const out = [];
  const add = (ranges) => {
    for (const r of ranges ?? []) {
      if (seen.has(r.pos)) continue;
      seen.add(r.pos);
      out.push({ pos: r.pos, text: text.slice(r.pos, r.end) });
    }
  };
  // Positions where JSX text begins: what follows there is text, never comment trivia.
  const jsxTextStarts = new Set();
  const markJsxText = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) jsxTextStarts.add(node.getFullStart());
    ts.forEachChild(node, markJsxText);
  };
  markJsxText(sf);
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) return;
    if (!jsxTextStarts.has(node.getFullStart())) add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    // same-line comments after code (`x = 1; // note`) are trailing trivia
    if (!jsxTextStarts.has(node.getEnd())) add(ts.getTrailingCommentRanges(text, node.getEnd()));
    // `{/* note */}` in JSX: an expression container with no expression
    if (ts.isJsxExpression(node) && !node.expression) add(ts.getLeadingCommentRanges(text, node.getStart(sf) + 1));
    for (const child of node.getChildren(sf)) visit(child);
  };
  visit(sf);
  return out.sort((a, b) => a.pos - b.pos);
}

/**
 * Portuguese words of a route-like string: path segments (`/lancamentos/:id`), query keys and
 * query values (`?aba=operacional`). Template placeholders (`${…}`) are ignored.
 */
export function routeWords(link) {
  const [pathPart, query = ""] = link.split("?");
  const parts = [...pathPart.split("/"), ...query.split("&").flatMap((kv) => kv.split("="))]
    .map((p) => p.replace(/\$\{\}/g, " ").replace(/^:/, "").replace(/#.*$/, ""));
  return parts.flatMap((p) => ptWords(p));
}

/** Path surfaces of one tracked file: each Portuguese directory segment and the file name. */
export function scanPath(relPath) {
  const hits = [];
  const segs = relPath.split("/");
  for (let i = 0; i < segs.length - 1; i++) if (ptWords(segs[i]).length) hits.push({ surface: "directory", kind: "directory", name: segs.slice(0, i + 1).join("/"), line: 0 });
  const base = segs[segs.length - 1];
  const stem = base.replace(/\.(test|spec|e2e-spec|guard|stories)?\.?(tsx?|mts|cts|mjs|cjs|js|json|md|mdx|sql|ya?ml|png|jpe?g|svg|webp|gif|txt|xlsx|pdf|sh|toml|html|css)$/i, "");
  if (ptWords(stem).length) hits.push({ surface: "filename", kind: "filename", name: base, line: 0 });
  return hits;
}

/**
 * Scans one source file. Returns technical-name hits:
 * { surface, kind, name, line }. Pure: no filesystem access.
 */
export function scanSource(relPath, text) {
  const hits = scanPath(relPath).map((h) => ({ ...h, name: h.surface === "filename" ? h.name : h.name.split("/").pop() }));
  const add = (surface, kind, name, line) => hits.push({ surface, kind, name, line });
  if (!/\.(ts|tsx|mts|cts|mjs|cjs|js)$/.test(relPath)) return hits;
  const fixture = isDetectorFixture(relPath);
  const contentWords = new Set([...(USER_INPUT_VOCABULARY.get(relPath) ?? []), ...(PT_CONTENT_VOCABULARY.get(relPath) ?? [])]);
  const externalProps = EXTERNAL_PROPERTY_NAMES.get(relPath);

  const kind = relPath.endsWith("x") ? ts.ScriptKind.TSX : /\.(mjs|cjs|js)$/.test(relPath) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const claimed = new Set(); // string-literal nodes already reported by a more specific surface
  const ident = (kind, nameNode, at) => {
    if (!nameNode) return;
    const name = ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isPrivateIdentifier(nameNode) ? nameNode.text : null;
    if (!name) return;
    if (ts.isStringLiteral(nameNode)) claimed.add(nameNode);
    // i18n/label maps: string-literal keys are technical keys; values are UX and never scanned
    if (ts.isStringLiteral(nameNode) && !TECHNICAL_NAME.test(name)) return;
    if (externalProps?.has(name)) return;
    if (ptWords(name).length) add("identifier", kind, name, lineOf(at));
  };
  const isEnvAccess = (e) => ts.isPropertyAccessExpression(e) && e.name.text === "env"
    && ((ts.isIdentifier(e.expression) && e.expression.text === "process") || ts.isMetaProperty(e.expression));
  const env = (name, at) => { if (/^[A-Z][A-Z0-9_]+$/.test(name) && ptWords(name).length) add("envVar", "env", name, lineOf(at)); };
  const evt = (lit, at) => {
    if (ts.isStringLiteral(lit)) claimed.add(lit);
    const name = lit.text;
    if (TECHNICAL_NAME.test(name) && ptWords(name).length) add("eventQueueJob", "name", name, lineOf(at));
  };
  const objectKey = (nameNode, at) => {
    if (fixture || !nameNode || !(ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode))) return;
    if (ts.isStringLiteral(nameNode)) claimed.add(nameNode);
    const name = nameNode.text;
    if (EXTERNAL_TOOL_NAMES.has(name) || externalProps?.has(name)) return;
    if (TECHNICAL_NAME.test(name.replace(/[A-Z]/g, (c) => c.toLowerCase())) && ptWords(name).length) add("objectKey", "object-key", name, lineOf(at));
  };
  const isEnvSchema = relPath.endsWith("env.schema.ts");
  const isTestCall = (n) => ts.isCallExpression(n) && (ts.isIdentifier(n.expression) ? ["describe", "it", "test"].includes(n.expression.text)
    : ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && ["describe", "it", "test"].includes(n.expression.expression.text));
  const isModuleSpecifier = (n) => {
    const p = n.parent;
    return ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) || ts.isImportTypeNode(p?.parent ?? p)
      || (ts.isCallExpression(p) && (p.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(p.expression) && p.expression.text === "require")
        || (ts.isPropertyAccessExpression(p.expression) && ["mock", "doMock", "unmock", "requireActual", "importActual"].includes(p.expression.name.text))));
  };
  // A string rendered as JSX content ({cond ? "/mês" : "/ano"}) is user-visible text.
  const isRenderedText = (n) => {
    let cur = n;
    while (cur.parent && (ts.isConditionalExpression(cur.parent) || ts.isParenthesizedExpression(cur.parent)
      || (ts.isBinaryExpression(cur.parent) && ["||", "??", "&&"].includes(cur.parent.operatorToken.getText(sf))))) {
      if (ts.isConditionalExpression(cur.parent) && cur.parent.condition === cur) return false;
      cur = cur.parent;
    }
    return !!cur.parent && ts.isJsxExpression(cur.parent) && !!cur.parent.parent
      && (ts.isJsxElement(cur.parent.parent) || ts.isJsxFragment(cur.parent.parent));
  };
  const isUxValue = (n) => {
    if (isRenderedText(n)) return true;
    const p = n.parent;
    if (ts.isJsxAttribute(p) || (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent))) {
      const attr = ts.isJsxAttribute(p) ? p : p.parent;
      return UX_KEYS.has(attr.name.getText(sf));
    }
    if (ts.isPropertyAssignment(p) && p.initializer === n) {
      const key = p.name.getText(sf).replace(/^["']|["']$/g, "");
      // Swagger documentation: @ApiProperty({ example: 'uuid-do-contrato' }) is sample text, not a value.
      if (key === "example" && ts.isObjectLiteralExpression(p.parent) && ts.isCallExpression(p.parent.parent)
        && /^ApiProperty(Optional)?$/.test(p.parent.parent.expression.getText(sf))) return true;
      return UX_KEYS.has(key);
    }
    if (ts.isCallExpression(p) && p.arguments.indexOf(n) > 0) {
      const callee = ts.isIdentifier(p.expression) ? p.expression.text : ts.isPropertyAccessExpression(p.expression) ? p.expression.name.text : "";
      return UX_ARGUMENT_CALLEES.has(callee);
    }
    return false;
  };
  // A literal that is data rather than text: the value of a classification field written or compared
  // verbatim ({ sector: "Comunicação" }, row.status === "Pendente", case on a `.sector`). Label maps
  // keyed by English ids ({ pending: "Pendente" }) and free text are UX, not data, and are not matched.
  const keyText = (k) => (k ? k.getText(sf).replace(/^["']|["']$/g, "") : "");
  const isDataPosition = (n) => {
    const p = n.parent;
    if (ts.isPropertyAssignment(p) && p.initializer === n) return PERSISTED_FIELD_KEYS.has(keyText(p.name));
    if (ts.isBinaryExpression(p) && ["===", "!==", "==", "!="].includes(p.operatorToken.getText(sf))) {
      const other = p.left === n ? p.right : p.left;
      return ts.isPropertyAccessExpression(other) && PERSISTED_FIELD_KEYS.has(other.name.text);
    }
    return false;
  };
  let controllerBase = null;
  const isRouteSource = relPath.startsWith("apps/web/") || relPath.startsWith("e2e/");

  const visit = (n) => {
    if (ts.isFunctionDeclaration(n)) ident("function", n.name, n);
    else if (ts.isClassDeclaration(n)) ident("class", n.name, n);
    else if (ts.isInterfaceDeclaration(n)) ident("interface", n.name, n);
    else if (ts.isTypeAliasDeclaration(n)) {
      ident("type", n.name, n);
      // event/analytics name unions: type AnalyticsEventName = "release.created" | ...
      if (/event|queue|job/i.test(n.name.text)) {
        const lits = [];
        const collect = (t) => { if (ts.isUnionTypeNode(t)) t.types.forEach(collect); else if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) lits.push(t.literal); };
        collect(n.type);
        for (const l of lits) evt(l, l);
      }
    }
    else if (ts.isEnumDeclaration(n)) ident("enum", n.name, n);
    else if (ts.isEnumMember(n)) ident("enum-member", n.name, n);
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      ident("variable", n.name, n);
      let init = n.initializer;
      while (init && (ts.isAsExpression(init) || ts.isParenthesizedExpression(init) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(init)))) init = init.expression;
      if (init && ts.isObjectLiteralExpression(init) && /event|queue|job/i.test(n.name.text)) {
        for (const p of init.properties) if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) evt(p.initializer, p);
      }
    } else if (ts.isMethodDeclaration(n) || ts.isMethodSignature(n)) ident("method", n.name, n);
    else if (ts.isPropertyDeclaration(n) || ts.isPropertySignature(n)) ident("property", n.name, n);
    else if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
      if (isEnvSchema && ts.isIdentifier(n.name)) env(n.name.text, n);
      else if (ts.isStringLiteral(n.name) && TECHNICAL_NAME.test(n.name.text) && n.name.text.includes(".")) ident("i18n-key", n.name, n);
      else objectKey(n.name, n);
    } else if (ts.isParameter(n) && ts.isIdentifier(n.name)) ident("parameter", n.name, n);
    // destructured bindings: const [nomeCompleto, setNomeCompleto] = useState(); const { valor } = row
    else if (ts.isBindingElement(n)) {
      if (ts.isIdentifier(n.name)) ident("variable", n.name, n);
      if (n.propertyName) objectKey(n.propertyName, n); // const { valor: amount } = row
    }
    else if (ts.isPropertyAccessExpression(n) && isEnvAccess(n.expression)) env(n.name.text, n);
    else if (ts.isElementAccessExpression(n) && isEnvAccess(n.expression) && ts.isStringLiteral(n.argumentExpression)) { claimed.add(n.argumentExpression); env(n.argumentExpression.text, n); }
    // member READS (`row.titulo`, `row['nome']`): a legacy-field fallback is a technical use of the Portuguese name even when no declaration exists
    else if (ts.isPropertyAccessExpression(n)) ident("property-read", n.name, n);
    else if (ts.isElementAccessExpression(n) && n.argumentExpression && ts.isStringLiteral(n.argumentExpression)) ident("property-read", n.argumentExpression, n);
    else if (ts.isDecorator(n) && ts.isCallExpression(n.expression)) {
      const callee = n.expression.expression.getText(sf);
      const arg = n.expression.arguments[0];
      const litNodes = !arg ? [] : ts.isStringLiteral(arg) ? [arg]
        : ts.isArrayLiteralExpression(arg) ? arg.elements.filter(ts.isStringLiteral) : [];
      const lits = litNodes.map((l) => l.text);
      const lit = lits[0] ?? null;
      if (callee === "Controller" && lit != null) {
        litNodes.forEach((l) => claimed.add(l));
        controllerBase = lit;
        if (ptWords(lit).length) add("apiRoute", "route", `/${lit}`, lineOf(n));
      } else if (["Get", "Post", "Put", "Patch", "Delete"].includes(callee)) {
        litNodes.forEach((l) => claimed.add(l));
        for (const l of lits) if (ptWords(l).length) add("apiRoute", "route", `/${controllerBase ?? ""}/${l}`, lineOf(n));
      } else if (["OnEvent", "Processor", "InjectQueue"].includes(callee) && litNodes[0]) evt(litNodes[0], n);
    } else if (ts.isCallExpression(n)) {
      const target = n.expression;
      const callee = ts.isIdentifier(target) ? target.text
        : ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression) ? target.expression.text : null;
      const method = ts.isPropertyAccessExpression(target) ? target.name.text : callee;
      const a = n.arguments[0];
      if (a && ts.isStringLiteral(a) && ["emit", "emitAsync", "registerQueue"].includes(method ?? "")) evt(a, n);
      if (isTestCall(n) && a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) {
        claimed.add(a);
        if (!fixture && isPtProse(a.text)) add("testTitle", "test-title", a.text, lineOf(n));
      }
    } else if (ts.isJsxAttribute(n) && n.name.getText(sf) === "path" && n.initializer && ts.isStringLiteral(n.initializer)) {
      claimed.add(n.initializer);
      if (relPath.startsWith("apps/web/") && ptWords(n.initializer.text).length) add("frontendRoute", "route", n.initializer.text, lineOf(n));
    }
    if (!fixture && isRouteSource && !claimed.has(n) && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n))) {
      const link = ts.isTemplateExpression(n) ? n.head.text + n.templateSpans.map((sp) => `\${}${sp.literal.text}`).join("") : n.text;
      if (link.startsWith("/") && !link.startsWith("//") && /^[\x20-\x7e]*$/.test(link) && !isRenderedText(n) && routeWords(link).length) {
        claimed.add(n);
        add("frontendRoute", "link", link, lineOf(n));
      }
    }
    if (!fixture && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !claimed.has(n) && VALUE_SHAPE.test(n.text)
      && !isModuleSpecifier(n) && !isUxValue(n) && !contentWords.has(n.text) && ptWords(stripRecordId(n.text)).length) {
      const p = n.parent;
      const isKey = (ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isEnumMember(p)) && p.name === n;
      if (!isKey) add("value", ts.isLiteralTypeNode(p) ? "literal-type" : ts.isEnumMember(p) ? "enum-value" : "string", n.text, lineOf(n));
    }
    if (!fixture && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !claimed.has(n) && CAPITALIZED_VALUE_SHAPE.test(n.text)
      && !isLabelResource(relPath) && isDataPosition(n) && !isModuleSpecifier(n) && !isUxValue(n) && !contentWords.has(n.text) && ptWords(n.text).length) {
      claimed.add(n);
      add("value", "capitalized-string", n.text, lineOf(n));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!fixture) {
    for (const c of sourceComments(sf, text)) {
      if (isPtProse(c.text)) add("comment", "comment", "", sf.getLineAndCharacterOfPosition(c.pos).line + 1);
    }
  }
  return hits;
}

export const isToolingFile = (f) => /^(scripts\/|apps\/api\/scripts\/|e2e\/|infra\/|\.claude\/runtime\/)/.test(f) && /\.(ts|mts|mjs|cjs|js)$/.test(f);

/** Portuguese prose string literals (3+ words) of one tooling file (pure). */
export function scanToolMessages(relPath, text) {
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true);
  const out = new Set();
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n)) {
      const t = n.text ?? "";
      if (t.split(/\s+/).filter(Boolean).length >= 3 && isPtProse(t)) out.add(t.replace(/\s+/g, " ").trim().slice(0, 80));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return [...out].sort();
}

/** Lockfiles are generated by package managers and carry third-party names only. */
const DATA_SKIP = new Set(["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "Cargo.lock"]);
export const isDataFile = (f) => /\.(sql|json|ya?ml|toml)$/.test(f) && !DATA_SKIP.has(path.posix.basename(f));

/**
 * Technical names inside one data file (pure). SQL: identifiers outside comments and single-quoted literals
 * (an operator message is prose, a column name is not). JSON: keys and token-shaped string values (never
 * free text). YAML/TOML: keys. Returns the distinct names that carry a Portuguese word.
 */
export function scanData(relPath, text) {
  const names = new Set();
  const addTokens = (src) => { for (const t of src.match(/[\p{L}_][\p{L}\p{N}_]*/gu) ?? []) if (ptWords(t).length) names.add(t); };
  if (/\.sql$/.test(relPath)) {
    addTokens(text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").replace(/\$\$|'(?:[^']|'')*'/g, " "));
  } else if (/\.json$/.test(relPath)) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { return []; }
    const walk = (v) => {
      if (Array.isArray(v)) { for (const x of v) walk(x); return; }
      if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) { if (VALUE_SHAPE.test(k) || TECHNICAL_NAME.test(k)) addTokens(k); walk(x); }
        return;
      }
      if (typeof v === "string" && (VALUE_SHAPE.test(v) || /^[A-Z][A-Z0-9_]*$/.test(v)) && v.length <= 80) addTokens(v);
    };
    walk(parsed);
  } else {
    for (const m of text.matchAll(/^\s*-?\s*["']?([\p{L}_][\p{L}\p{N}_.-]*)["']?\s*[:=]/gmu)) addTokens(m[1]);
  }
  return [...names].sort();
}

/** Portuguese prose lines of a Markdown document (fenced code blocks are skipped). */
export function scanMarkdown(text) {
  let inFence = false;
  let lines = 0;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence || !line.trim()) continue;
    if (isPtProse(line.replace(/`[^`]*`/g, " "))) lines++;
  }
  return lines;
}

export function trackedFiles() {
  const files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(Boolean).sort()
    .filter((f) => fs.existsSync(path.join(ROOT, f)) && !VENDORED.has(f) && !isBookkeeping(f));
  if (files.length === 0) throw new Error("technical-naming census: no source files found (git ls-files returned nothing) — refusing to report success");
  return files;
}
const isCode = (f) => /\.(ts|tsx|mts|cts|mjs|cjs|js)$/.test(f) && !f.includes("/dist/") && !f.endsWith(".d.ts");
const isDoc = (f) => /\.mdx?$/.test(f);

/** Full census: debt (baseline-comparable), exceptions and report-only counters. */
export function census({ exceptions = exceptionIndex(loadAuthority()) } = {}) {
  const debt = {};
  const excepted = {};
  const exceptedClass = {};
  const reportOnly = { migrationFiles: 0 };
  const surfaces = Object.fromEntries(SURFACES.map((k) => [k, { candidates: 0, exceptions: 0 }]));
  let filesScanned = 0;
  const dirs = new Set();
  const seenDirs = new Set();
  const usedRows = new Set();
  const record = (surface, key, file, name, count = 1) => {
    const exc = name != null && exceptions.get(file, name, surface);
    if (exc) { usedRows.add(exc); for (const w of exceptions.wordRows?.(name) ?? []) usedRows.add(w); }
    const bucket = exc ? excepted : debt;
    if (exc) exceptedClass[key] = exc.exceptionClass ?? exc.disposition ?? "UNCLASSIFIED";
    bucket[key] = (bucket[key] ?? 0) + count;
    surfaces[surface].candidates += count;
    if (exc) surfaces[surface].exceptions += count;
  };
  const files = trackedFiles();
  if (!files.some(isCode)) throw new Error("technical-naming census: no code files found — refusing to report success");
  for (const f of files) {
    filesScanned++;
    for (const d of path.dirname(f).split("/")) dirs.add(d);
    if (isMigration(f)) {
      if (ptWords(path.basename(f)).length) reportOnly.migrationFiles++;
      continue; // historical: published migration names and SQL are immutable history
    }
    for (const h of scanPath(f)) {
      if (h.surface === "filename") { record("filename", `filename::${f}::filename::${h.name}`, f, h.name); continue; }
      const key = `directory::${h.name}`; // one entry per Portuguese directory, however many files it holds
      if (!seenDirs.has(key)) { seenDirs.add(key); record("directory", key, h.name, h.name.split("/").pop()); }
    }
    const hits = isCode(f) ? scanSource(f, fs.readFileSync(path.join(ROOT, f), "utf8")).filter((h) => h.surface !== "directory" && h.surface !== "filename") : [];
    for (const h of hits) {
      const key = h.surface === "comment" ? `comment::${f}` : `${h.surface}::${f}::${h.kind}::${h.name}`;
      record(h.surface, key, f, h.surface === "comment" ? null : h.name);
    }
    if (isToolingFile(f) && !DETECTOR_FIXTURES.has(f)) {
      for (const msg of scanToolMessages(f, fs.readFileSync(path.join(ROOT, f), "utf8"))) record("toolMessage", `toolMessage::${f}::message::${msg}`, f, msg);
    }
    if (isDataFile(f) && !isBookkeeping(f)) {
      for (const name of scanData(f, fs.readFileSync(path.join(ROOT, f), "utf8"))) record("dataFile", `dataFile::${f}::${name}`, f, name);
    }
    if (isDoc(f)) {
      const n = scanMarkdown(fs.readFileSync(path.join(ROOT, f), "utf8"));
      if (n) record("doc", `doc::${f}`, f, "*", n);
    }
  }
  for (const [table, cols] of physicalColumns()) {
    for (const col of cols) if (ptWords(col).length) record("dbColumn", `dbColumn::${table}.${col}`, ENTITIES, col);
  }
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return {
    filesScanned, directoriesScanned: dirs.size,
    surfaces: sorted(surfaces),
    debt: sorted(debt),
    excepted: sorted(excepted),
    exceptedClass: sorted(exceptedClass),
    reportOnly,
    /** ACTIVE ledger rows that matched no occurrence in the tree (obsolete boundaries: the code they documented is gone). */
    unusedRows: (exceptions.rows ?? []).filter((r) => !usedRows.has(r)),
  };
}

export function totalsBySurface(debt) {
  const t = {};
  for (const [k, v] of Object.entries(debt)) { const s = k.split("::")[0]; t[s] = (t[s] ?? 0) + v; }
  return Object.fromEntries(Object.entries(t).sort());
}

/** Compares a census with a baseline; returns { grown, shrunk }. */
export function compare(debt, baselineDebt) {
  const grown = [];
  const shrunk = [];
  for (const [k, v] of Object.entries(debt)) if (v > (baselineDebt[k] ?? 0)) grown.push(`${k} (${baselineDebt[k] ?? 0} -> ${v})`);
  for (const [k, v] of Object.entries(baselineDebt)) if ((debt[k] ?? 0) < v) shrunk.push(`${k} (${v} -> ${debt[k] ?? 0})`);
  return { grown, shrunk };
}

function main() {
  const mode = process.argv[2] ?? "--check";
  const c = census();
  if (mode === "--write") {
    const out = { totals: totalsBySurface(c.debt), debt: c.debt };
    fs.writeFileSync(BASELINE, JSON.stringify(out, null, 1) + "\n");
    console.log("baseline written", out.totals);
    return;
  }
  if (mode === "--report") {
    console.log(JSON.stringify({ filesScanned: c.filesScanned, directoriesScanned: c.directoriesScanned, surfaces: c.surfaces, debtTotals: totalsBySurface(c.debt), exceptionHits: Object.values(c.excepted).reduce((a, b) => a + b, 0), reportOnly: c.reportOnly }, null, 1));
    return;
  }
  if (mode === "--list") {
    const only = process.argv[3];
    for (const [k, v] of Object.entries(c.debt)) if (!only || k.startsWith(`${only}::`)) console.log(`${v}\t${k}`);
    return;
  }
  if (mode !== "--check") throw new Error(`unknown mode ${mode}`);
  if (!fs.existsSync(BASELINE)) throw new Error(`baseline not found: ${path.relative(ROOT, BASELINE)}`);
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  if (!base.debt || typeof base.debt !== "object") throw new Error("baseline has no debt section");
  const { grown, shrunk } = compare(c.debt, base.debt);
  console.log(`technical-naming census: ${c.filesScanned} files, debt ${JSON.stringify(totalsBySurface(c.debt))}`);
  if (grown.length) {
    console.error(`\nNEW Portuguese technical names (engineering = English; Portuguese only in user-visible UX text):\n  ${grown.slice(0, 200).join("\n  ")}${grown.length > 200 ? `\n  … ${grown.length - 200} more (--list)` : ""}`);
    console.error("\nRename to English. Only a documented exception (canonical-naming-map.json exceptions[]) may keep a Portuguese technical name.");
  }
  if (shrunk.length) {
    console.error(`\nBaseline is stale — these debts were removed and must be dropped from the baseline in the same commit (run --write):\n  ${shrunk.slice(0, 200).join("\n  ")}${shrunk.length > 200 ? `\n  … ${shrunk.length - 200} more` : ""}`);
  }
  if (c.unusedRows.length) {
    console.error(`\nStale exception rows (OBSOLETE_BOUNDARY: they match no occurrence; remove them from canonical-naming-map.json):\n  ${c.unusedRows.slice(0, 100).map((r) => `${r.exceptionClass} ${r.surface ?? "-"} ${r.path} :: ${r.currentName}`).join("\n  ")}${c.unusedRows.length > 100 ? `\n  … ${c.unusedRows.length - 100} more` : ""}`);
  }
  if (grown.length || shrunk.length || c.unusedRows.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { console.error(`technical-naming census FAILED: ${err.message}`); process.exit(2); }
}
