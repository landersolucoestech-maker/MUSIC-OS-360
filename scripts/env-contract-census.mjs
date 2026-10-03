#!/usr/bin/env node
/**
 * scripts/env-contract-census.mjs: census and drift gate of the environment-variable contract.
 *
 *   node scripts/env-contract-census.mjs --check             # gate: exit 1 on any violation
 *   node scripts/env-contract-census.mjs --report [outDir]   # writes env-contract-matrix.{md,tsv}
 *
 * Reads ONLY names, presence, requirement, defaults and validation. It never prints a value: a variable's value
 * appears nowhere in the output, and a template line whose value looks like a real secret fails the gate.
 *
 * The contract it enforces (see docs/engineering/environment-contract.md):
 *   - API variables are validated by the zod schema in apps/api/src/core/config/env.schema.ts (single authority);
 *   - every template (development example, staging, production; root, API and web) only documents NAMES and
 *     placeholders: root = tooling/scripts view, apps/api and apps/web = the real per-app contract;
 *   - a variable the schema requires in production, or env:check requires locally, must be documented in all
 *     three environments of its app (active or commented); environment-specific variables (dev-only bypass flags,
 *     staging-only allowlists, production-only forbids) are listed explicitly and never forced equal;
 *   - every variable the API source reads must be validated by the schema or declared in
 *     scripts/env-contract.config.json with a reason; every web VITE_ variable the source reads must be in the three
 *     web templates; no template documents a variable nothing reads.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");

export const TEMPLATES = {
  root: { development: ".env.development.example", staging: ".env.staging", production: ".env.production" },
  api: { development: "apps/api/.env.development.example", staging: "apps/api/.env.staging", production: "apps/api/.env.production" },
  web: { development: "apps/web/.env.development.example", staging: "apps/web/.env.staging", production: "apps/web/.env.production" },
};
export const ENVS = ["development", "staging", "production"];
const CONFIG_PATH = path.join(here, "env-contract.config.json");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const tracked = () => execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);

/** KEY=value lines of a template: active, or commented with `# KEY=`. Values are dropped immediately. */
export function parseTemplate(text) {
  const vars = new Map();
  const valueShapes = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^(#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const status = m[1] ? "commented" : "active";
    const prev = vars.get(m[2]);
    if (!prev || (prev === "commented" && status === "active")) vars.set(m[2], status);
    valueShapes.push({ key: m[2], value: m[3].trim() });
  }
  return { vars, valueShapes };
}

/** Credentials that are JWTs by construction: a non-JWT value in their slot cannot be a working credential. */
const JWT_ONLY = /(ANON_KEY|SERVICE_ROLE_KEY)$/;

/** True when a template value could be a real secret (JWT, long hex, provider key prefix, URL with an inline password). */
export function looksLikeRealSecret(value, name = "") {
  const v = value.replace(/^["']|["']$/g, "");
  if (!v || /^<[^>]+>$/.test(v)) return false;
  // a JWT is a credential only with a signature part; a header plus a payload prefix (a truncated placeholder) is not
  if (/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(v)) return true;
  // a tracked template must not carry a credential-looking value in a credential slot, not even a truncated one:
  // a JWT-prefixed (`eyJ...`) fragment in an anon/service-role slot looks operational and is not (canonical form `<NAME>`)
  if (JWT_ONLY.test(name)) return /^eyJ/.test(v);
  if (/^[0-9a-f]{40,}$/i.test(v)) return true;
  if (/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{10,}/.test(v)) return true;
  if (/:\/\/[^/\s:@]+:(?!<)[^/\s@<]{6,}@/.test(v) && !/(PASSWORD|SENHA|TOKEN|<)/.test(v)) return true;
  return false;
}

const SECRET_NAME = /(SECRET|PASSWORD|_PASS$|TOKEN|PRIVATE|SERVICE_ROLE|ACCESS_KEY|API_KEY|ENCRYPTION_KEY|DATABASE_URL|REDIS_URL|REDIS_QUEUE_URL|DSN$|WEBHOOK)/;
const NOT_SECRET_NAME = /(^VITE_|PUBLIC|CLIENT_ID$|CLIENT_KEY$|APP_ID$|ANON_KEY$|REDIRECT_URI$|AUTH_BASE_URL$|INTEGRATION_KEY$|_HOST$|_PORT$|ENABLED$)/;
export const isSecretName = (name) => SECRET_NAME.test(name) && !NOT_SECRET_NAME.test(name);

/** Fields of the zod object: required-in-production, default, validated. Text based (the schema is TypeScript). */
export function parseSchema(text) {
  const s = text.indexOf("export const envSchema = z.object({");
  const e = text.indexOf("\n});", s);
  if (s < 0 || e < 0) throw new Error("env.schema.ts: envSchema object not found");
  const body = text.slice(s, e);
  const starts = [...body.matchAll(/^  ([A-Z][A-Z0-9_]*):/gm)];
  const fields = new Map();
  starts.forEach((m, i) => {
    const block = body.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : body.length);
    const def = /\.default\(([^)]*)\)/.exec(block);
    fields.set(m[1], {
      requiredInProduction: /process\.env\['NODE_ENV'\] !== 'production'/.test(block),
      hasDefault: Boolean(def),
      defaultLiteral: def ? def[1].trim() : null,
    });
  });
  return fields;
}

/** process.env reads of the API source (specs and tests excluded). */
export function apiEnvReads(files) {
  const reads = new Map();
  for (const f of files) {
    if (!/^apps\/api\/src\/.*\.ts$/.test(f) || /\.(spec|e2e-spec|test)\.ts$/.test(f) || /\/migrations\//.test(f) || /\/migration-drafts\//.test(f)) continue;
    const t = read(f);
    for (const m of t.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\])/g)) {
      const k = m[1] ?? m[2];
      reads.set(k, [...(reads.get(k) ?? []), f]);
    }
    for (const m of t.matchAll(/(?:config|configService|cfg)\.get(?:OrThrow)?(?:<[^>]*>)?\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g)) reads.set(m[1], [...(reads.get(m[1]) ?? []), f]);
  }
  return reads;
}

/** `process.env['X'] ?? 'literal'` fallbacks of the API source: name -> files. Secret-named ones are unsafe defaults. */
export function apiLiteralFallbacks(files) {
  const out = new Map();
  for (const f of files) {
    if (!/^apps\/api\/src\/.*\.ts$/.test(f) || /\.(spec|e2e-spec|test)\.ts$/.test(f) || /\/migrations\/|\/migration-drafts\//.test(f)) continue;
    const t = read(f);
    for (const m of t.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\])\s*(?:\?\?|\|\|)\s*(?:\(prodLike \? '' : )?'([^']+)'/g)) {
      const k = m[1] ?? m[2];
      out.set(k, [...(out.get(k) ?? []), f]);
    }
  }
  return out;
}

/**
 * Local-env loader contract of the API tooling: development variables come from apps/api/.env.development (then
 * <cwd>/.env.development) and process.env always wins. Divergences: a bare dotenv load (reads `.env`, a file nothing
 * documents) and any dotenv use while the package is not a declared dependency of apps/api (it then resolves only by
 * accident of hoisting and a try/catch silently loads nothing).
 */
export function loaderDivergences(files, apiPackageJson) {
  const out = [];
  const declared = Boolean(apiPackageJson.dependencies?.dotenv || apiPackageJson.devDependencies?.dotenv);
  for (const f of files) {
    if (!/^apps\/api\/(src|scripts)\/.*\.(ts|mjs|cjs|js)$|^apps\/api\/[^/]+\.(ts|mjs|cjs|js)$/.test(f) || /\.(spec|test|e2e-spec)\.[tj]s$/.test(f)) continue;
    const t = read(f);
    if (/dotenv\/config/.test(t) || /dotenv['"]\)\.config\(\s*\)/.test(t) || /\bdotenv\.config\(\s*\)/.test(t)) out.push(`${f}: bare dotenv load reads \`.env\`; use the .env.development contract`);
    if (!declared && /['"]dotenv['"]/.test(t)) out.push(`${f}: uses dotenv but apps/api/package.json does not declare it`);
  }
  return out;
}

/** import.meta.env.VITE_* reads of the web source (tests excluded). */
export function webEnvReads(files) {
  const reads = new Map();
  for (const f of files) {
    if (!/^apps\/web\/src\/.*\.(ts|tsx)$/.test(f) || /\.(test|spec)\.(ts|tsx)$/.test(f) || /\.d\.ts$/.test(f)) continue;
    const t = read(f);
    for (const m of t.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) reads.set(m[1], [...(reads.get(m[1]) ?? []), f]);
  }
  return reads;
}

export function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

/** Builds the whole census from the tracked tree. */
export function buildCensus() {
  const files = tracked();
  const cfg = loadConfig();
  const schema = parseSchema(read("apps/api/src/core/config/env.schema.ts"));
  const apiReads = apiEnvReads(files);
  const webReads = webEnvReads(files);
  const fallbacks = apiLiteralFallbacks(files);
  const tpl = {};
  const secretValueViolations = [];
  const missingTemplates = [];
  for (const [app, byEnv] of Object.entries(TEMPLATES)) {
    for (const env of ENVS) {
      const rel = byEnv[env];
      if (!files.includes(rel)) { missingTemplates.push(rel); tpl[`${app}.${env}`] = new Map(); continue; }
      const parsed = parseTemplate(read(rel));
      tpl[`${app}.${env}`] = parsed.vars;
      for (const { key, value } of parsed.valueShapes) if (looksLikeRealSecret(value, key)) secretValueViolations.push(`${rel}: ${key}`);
    }
  }
  const names = new Set([...schema.keys(), ...apiReads.keys(), ...webReads.keys()]);
  for (const t of Object.values(tpl)) for (const k of t.keys()) names.add(k);
  const rows = [];
  for (const name of [...names].sort()) {
    const isWeb = name.startsWith("VITE_");
    const cell = (env) => {
      const parts = [];
      for (const app of isWeb ? ["web"] : ["api", "root"]) {
        const st = tpl[`${app}.${env}`]?.get(name);
        if (st) parts.push(`${st === "active" ? "set" : "opt"}:${app}`);
      }
      return parts.length ? parts.join(",") : "-";
    };
    const sch = schema.get(name);
    const envCheckRequired = cfg.envCheckRequired.includes(name);
    const required = [sch?.requiredInProduction ? "production(schema)" : null, envCheckRequired ? "local(env:check)" : null, cfg.webRequired.includes(name) ? "web-build" : null].filter(Boolean).join("+") || "-";
    const validated = [sch ? "schema" : null, envCheckRequired ? "env:check" : null, isWeb && cfg.webGuarded.includes(name) ? "web-guard" : null].filter(Boolean).join("+") || "NO";
    rows.push({
      name,
      development: cell("development"), staging: cell("staging"), production: cell("production"),
      api: apiReads.has(name) || schema.has(name) ? "Y" : "-",
      web: webReads.has(name) || isWeb ? "Y" : "-",
      required,
      defaultValue: sch?.hasDefault ? (isSecretName(name) ? "default(secret!)" : `schema:${sch.defaultLiteral}`) : "-",
      validated,
      secret: isSecretName(name) ? "yes" : "no",
      source: [sch ? "env.schema.ts" : null, apiReads.has(name) ? "api-src" : null, webReads.has(name) ? "web-src" : null, ...Object.entries(tpl).filter(([, v]) => v.has(name)).map(([k]) => k)].filter(Boolean).join(" "),
      schemaField: sch ?? null, apiUsedIn: apiReads.get(name) ?? [], webUsedIn: webReads.get(name) ?? [], isWeb,
    });
  }
  return { rows, tpl, cfg, schema, apiReads, webReads, fallbacks, loaderDivergences: loaderDivergences(files, JSON.parse(read("apps/api/package.json"))), secretValueViolations, missingTemplates, files };
}

/** The gate: every violation class of the contract. Pure over the census. */
export function evaluate(c) {
  const v = {
    DEVELOPMENT_TEMPLATES_MISSING: [], ENV_SCHEMA_DIVERGENCES: [], MISSING_REQUIRED_VARIABLES: [], UNVALIDATED_VARIABLES: [],
    UNSAFE_DEFAULTS: [], ENV_DOCUMENTATION_DRIFT: [], COMMON_OBLIGATION_DRIFT: [], WEB_TEMPLATE_DRIFT: [], SECRET_LOOKING_VALUES: [],
    UNDOCUMENTED_VARIABLES: [], PENDING_PROTECTED_TEMPLATE_CLEANUP: [], ENV_LOADER_DIVERGENCES: [],
  };
  v.DEVELOPMENT_TEMPLATES_MISSING.push(...c.missingTemplates);
  v.SECRET_LOOKING_VALUES.push(...c.secretValueViolations);
  const only = c.cfg.environmentSpecific;
  v.ENV_LOADER_DIVERGENCES.push(...c.loaderDivergences);
  const prefixReason = (name) => Object.keys(c.cfg.templatePrefixes).find((p) => name.startsWith(p));
  for (const [name, files] of c.fallbacks) {
    if (isSecretName(name) && !c.cfg.acceptedSecretDefaults[name]) v.UNSAFE_DEFAULTS.push(`${name}: literal fallback in ${files[0]} on a secret-named variable`);
  }
  for (const r of c.rows) {
    const inTpl = (env) => r.isWeb ? r.web && r[env] !== "-" : r[env] !== "-";
    if (!r.isWeb) {
      if (/production\(schema\)/.test(r.required) && !/set:api/.test(r.production)) v.MISSING_REQUIRED_VARIABLES.push(`${r.name}: required in production, not set in ${TEMPLATES.api.production}`);
      const inTemplates = ENVS.some((env) => r[env] !== "-");
      if (c.cfg.pendingTemplateCleanup[r.name]) v.PENDING_PROTECTED_TEMPLATE_CLEANUP.push(`${r.name}: ${c.cfg.pendingTemplateCleanup[r.name]}`);
      else if (inTemplates && !r.schemaField && !c.cfg.templateOnly[r.name] && !prefixReason(r.name)) v.ENV_SCHEMA_DIVERGENCES.push(`${r.name}: documented in a template but not validated by env.schema.ts and not declared in env-contract.config.json`);
      if (r.schemaField && !inTemplates && !c.cfg.undocumentedOk[r.name]) v.UNDOCUMENTED_VARIABLES.push(`${r.name}: validated by the schema but documented in no template`);
      if (r.apiUsedIn.length && !r.schemaField && !c.cfg.unvalidatedReads[r.name] && !prefixReason(r.name)) v.UNVALIDATED_VARIABLES.push(`${r.name}: read by ${r.apiUsedIn[0]}${r.apiUsedIn.length > 1 ? ` (+${r.apiUsedIn.length - 1})` : ""}, not validated and not declared`);
      if (r.defaultValue === "default(secret!)" && !c.cfg.acceptedSecretDefaults[r.name]) v.UNSAFE_DEFAULTS.push(`${r.name}: schema default on a secret-named variable`);
    } else {
      if (r.webUsedIn.length || ENVS.some((env) => r[env] !== "-")) {
        for (const env of ENVS) if (r[env] === "-" && !c.cfg.buildInjected[r.name] && !(only[r.name] && !only[r.name].includes(env))) v.WEB_TEMPLATE_DRIFT.push(`${r.name}: not documented in the ${env} web template`);
      }
      if (!r.webUsedIn.length && ENVS.some((env) => r[env] !== "-") && !c.cfg.templateOnly[r.name] && !c.cfg.buildInjected[r.name]) v.ENV_SCHEMA_DIVERGENCES.push(`${r.name}: documented in a web template but no web source reads it`);
    }
  }
  // Drift rules over the per-app templates (names only). Environment-specific variables are never forced equal.
  const names = (app, env) => new Set(c.tpl[`${app}.${env}`]?.keys() ?? []);
  const pending = (name) => c.cfg.pendingTemplateAdditions[name];
  const note = (name, where, missing) => {
    if (only[name]) return;
    if (pending(name)) v.PENDING_PROTECTED_TEMPLATE_CLEANUP.push(`${name}: not documented in ${missing}: ${pending(name)}`);
    else v.COMMON_OBLIGATION_DRIFT.push(`${name}: documented in ${where} but not in ${missing}`);
  };
  for (const app of ["api", "web"]) {
    const dev = names(app, "development"), stg = names(app, "staging"), prod = names(app, "production");
    for (const n of new Set([...stg, ...prod])) {
      if (c.cfg.buildInjected[n]) continue;
      if (stg.has(n) && !prod.has(n)) note(n, `${app} staging`, `${app} production`);
      if (prod.has(n) && !stg.has(n)) note(n, `${app} production`, `${app} staging`);
      if (stg.has(n) && prod.has(n) && !dev.has(n)) note(n, `${app} staging and production`, `${app} development`);
    }
    for (const n of dev) if (!stg.has(n) && !prod.has(n) && !only[n] && !c.cfg.buildInjected[n]) note(n, `${app} development`, `${app} staging/production`);
  }
  for (const r of c.rows) {
    if (r.isWeb || only[r.name]) continue;
    // required in production by the schema, or required locally by env:check: documented for every environment of the API
    if (/production\(schema\)|local\(env:check\)/.test(r.required)) {
      for (const env of ENVS) if (!names("api", env).has(r.name) && !names("root", env).has(r.name)) v.COMMON_OBLIGATION_DRIFT.push(`${r.name}: required (${r.required}) but not documented for ${env}`);
    }
  }
  return v;
}

/** Environment variables named in active documentation that nothing defines (API schema, templates, config). */
export function documentationDrift(c) {
  const known = new Set([...c.rows.map((r) => r.name), ...Object.keys(c.cfg.documentationOnlyNames)]);
  const docs = c.files.filter((f) => /^(docs\/engineering\/|docs\/PROVISIONING_GUIDE\.md|docs\/STAGING_ARCHITECTURE\.md|docs\/SUPABASE_ENVIRONMENTS\.md|apps\/api\/(README|DATABASE|SECURITY_ARCHITECTURE)[^/]*\.md|README\.md)/.test(f) && f.endsWith(".md") && !/docs\/engineering\/pack\//.test(f));
  const out = [];
  for (const f of docs) {
    const t = read(f);
    if (/^>\s*Historical/m.test(t.slice(0, 300))) continue;
    for (const m of new Set([...t.matchAll(/`((?:VITE_)?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)].map((x) => x[1]))) {
      if (!known.has(m) && c.cfg.nonEnvTokens.includes(m) === false && /^(VITE_|[A-Z]+_(URL|KEY|SECRET|TOKEN|ID|HOST|PORT|ENABLED|EMAIL|PASSWORD|ORIGINS|DSN|REF|MODE|DISABLED|MOCK|BYPASS|CONFIRM|SUB|LEVEL|DAYS|HOURS|TTL)$)/.test(m)) out.push(`${f}: ${m}`);
    }
  }
  return out;
}

const cellText = (s) => s.replace(/\|/g, "/");
export function renderMatrix(c, drift) {
  const head = ["VARIABLE", "DEVELOPMENT", "STAGING", "PRODUCTION", "API", "WEB", "REQUIRED", "DEFAULT", "VALIDATED", "SECRET", "SOURCE"];
  const line = (r) => [r.name, r.development, r.staging, r.production, r.api, r.web, r.required, r.defaultValue, r.validated, r.secret, r.source].map(cellText);
  const tsv = [head.join("\t"), ...c.rows.map((r) => line(r).join("\t"))].join("\n") + "\n";
  const md = ["| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|", ...c.rows.map((r) => "| " + line(r).join(" | ") + " |")].join("\n") + "\n";
  return { tsv, md };
}

function main() {
  const mode = process.argv[2] ?? "--check";
  const c = buildCensus();
  const v = evaluate(c);
  v.ENV_DOCUMENTATION_DRIFT.push(...documentationDrift(c));
  const pending = v.PENDING_PROTECTED_TEMPLATE_CLEANUP;
  const total = Object.entries(v).reduce((n, [k, list]) => n + (k === "PENDING_PROTECTED_TEMPLATE_CLEANUP" ? 0 : list.length), 0);
  if (mode === "--report") {
    const outDir = path.resolve(ROOT, process.argv[3] ?? "docs/engineering");
    fs.mkdirSync(outDir, { recursive: true });
    const { tsv, md } = renderMatrix(c, v);
    fs.writeFileSync(path.join(outDir, "env-contract-matrix.tsv"), tsv);
    fs.writeFileSync(path.join(outDir, "env-contract-matrix.md"), `# Environment contract matrix (generated)\n\nGenerated by \`node scripts/env-contract-census.mjs --report\`. Names, presence, requirement, default and validation only; no value is read into this file.\nCells: \`set:<template>\` = active line, \`opt:<template>\` = commented line, \`-\` = absent. Templates: \`api\` = apps/api, \`root\` = repository root, \`web\` = apps/web.\n\n${md}`);
    console.log(`env contract matrix: ${c.rows.length} variables`);
    return;
  }
  console.log(`env-contract census: ${c.rows.length} variables, ${total} violation(s), ${pending.length} declared pending item(s) (protected templates)`);
  for (const [k, list] of Object.entries(v)) if (list.length && k !== "PENDING_PROTECTED_TEMPLATE_CLEANUP") { console.error(`\n${k} (${list.length}):\n  ${list.slice(0, 60).join("\n  ")}${list.length > 60 ? `\n  ... ${list.length - 60} more` : ""}`); }
  if (pending.length) console.log(`\nDeclared pending (scripts/env-contract.config.json, each with its reason):\n  ${pending.map((x) => x.split(":")[0] + ":" + x.split(":")[1].slice(0, 70)).join("\n  ")}`);
  if (total) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { console.error(`env-contract census FAILED: ${err.message}`); process.exit(2); }
}
