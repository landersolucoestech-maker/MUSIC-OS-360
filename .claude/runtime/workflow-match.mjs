#!/usr/bin/env node
// WORKFLOW DISCOVERY AND MATCHING. Discovery reads every .claude/workflows/*.json, validates it against
// the manifest contract and refuses unsafe names. Matching scores each discovered workflow against an
// order and persists ALL candidates (not only the winner) as a `workflow-match` record, so the choice is
// auditable. A workflow is selected only when its score reaches the threshold and it beats the runner-up;
// otherwise the result is NO_MATCH or AMBIGUOUS, which is a pack gap to fix, never a licence to bypass the
// workflow layer.
//
//   node .claude/runtime/workflow-match.mjs --order "<text>" [--intent <id>] [--record] [--json]
//   node .claude/runtime/workflow-match.mjs --discover
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validate } from "./lib/schema-validate.mjs";
import { addRecord } from "./lib/record-store.mjs";
import { classifyIntent } from "./route-task.mjs";
import { SAFE_NAME } from "./graph-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DEFAULT = join(__dirname, "..", "..");

export const MATCH_THRESHOLD = 4;
const KEYWORD_POINTS = 2;
const INTENT_POINTS = 3;
const EXAMPLE_POINTS = 2;
const EXCLUDE_PENALTY = 5;

export const normalize = (text) =>
  String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const containsPhrase = (haystack, phrase) => ` ${haystack} `.includes(` ${normalize(phrase)} `);

function tokens(text) {
  return new Set(normalize(text).split(" ").filter((t) => t.length > 3));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Discover every workflow manifest. Invalid or unsafe files are reported, never silently skipped. */
export function discover(cwd = ROOT_DEFAULT) {
  // A repository without its own pack (a scratch checkout) falls back to the pack that ships with the runtime.
  const base = existsSync(join(cwd, ".claude", "workflows")) ? cwd : ROOT_DEFAULT;
  const dir = join(base, ".claude", "workflows");
  const contracts = join(base, ".claude", "contracts", "workflow-manifest.schema.json");
  const found = [];
  const problems = [];
  if (!existsSync(dir)) return { workflows: found, problems: [`no workflows directory: ${dir}`] };
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const name = file.slice(0, -5);
    if (!SAFE_NAME.test(name) || name.includes("..")) { problems.push(`${file}: unsafe workflow name`); continue; }
    let data;
    try { data = JSON.parse(readFileSync(join(dir, file), "utf8")); } catch (e) { problems.push(`${file}: invalid JSON (${e.message})`); continue; }
    const res = validate(contracts, data);
    if (!res.valid) { problems.push(`${file}: ${res.errors.join("; ")}`); continue; }
    if (data.name !== name) { problems.push(`${file}: name "${data.name}" differs from the file name`); continue; }
    found.push(data);
  }
  return { workflows: found, problems };
}

export function scoreWorkflow(workflow, orderText, intentId) {
  const order = normalize(orderText);
  const m = workflow.match || { keywords: [], examples: [] };
  const matchedKeywords = (m.keywords || []).filter((k) => containsPhrase(order, k));
  const matchedIntent = !!(intentId && (m.intents || []).includes(intentId));
  const orderTokens = tokens(orderText);
  const exampleSimilarity = Math.max(0, ...(m.examples || []).map((e) => jaccard(orderTokens, tokens(e))));
  const excluded = (m.excludes || []).filter((k) => containsPhrase(order, k));
  const reasons = [];
  let score = 0;
  if (matchedKeywords.length) { score += matchedKeywords.length * KEYWORD_POINTS; reasons.push(`keywords: ${matchedKeywords.join(", ")}`); }
  if (matchedIntent) { score += INTENT_POINTS; reasons.push(`intent ${intentId}`); }
  if (exampleSimilarity >= 0.3) { score += EXAMPLE_POINTS; reasons.push(`example similarity ${exampleSimilarity.toFixed(2)}`); }
  if (excluded.length) { score -= EXCLUDE_PENALTY * excluded.length; reasons.push(`excluded by: ${excluded.join(", ")}`); }
  if (!workflow.match) reasons.push("no match metadata (cannot be selected)");
  return { workflow: workflow.name, score, matchedKeywords, matchedIntent, exampleSimilarity: Number(exampleSimilarity.toFixed(3)), excluded, reasons };
}

/** Pure matching: returns every candidate and the decision. Persisting is the caller's choice. */
export function matchOrder({ order, intent = null, cwd = ROOT_DEFAULT } = {}) {
  if (!order || typeof order !== "string") throw new Error('USAGE: matchOrder({ order: "<text>" })');
  const { workflows, problems } = discover(cwd);
  let intentId = intent;
  if (!intentId) {
    try {
      const routing = JSON.parse(readFileSync(join(existsSync(join(cwd, ".claude", "registry", "routing.json")) ? cwd : ROOT_DEFAULT, ".claude", "registry", "routing.json"), "utf8"));
      const cls = classifyIntent(order, routing, null);
      if (cls.status === "OK") intentId = cls.intent.intent;
    } catch { /* routing is optional for matching; keywords decide */ }
  }
  const candidates = workflows.map((w) => scoreWorkflow(w, order, intentId)).sort((a, b) => b.score - a.score || a.workflow.localeCompare(b.workflow));
  const [top, second] = candidates;
  let status = "NO_MATCH";
  let selected = null;
  if (top && top.score >= MATCH_THRESHOLD) {
    if (second && second.score === top.score) status = "AMBIGUOUS";
    else { status = "MATCHED"; selected = top.workflow; }
  }
  return { order, intent: intentId, threshold: MATCH_THRESHOLD, candidates, selected, status, discoveryProblems: problems };
}

export function recordMatch(result, cwd = ROOT_DEFAULT) {
  const { discoveryProblems, ...rest } = result;
  return addRecord(cwd, "workflow-match", { ...rest, intent: rest.intent ?? null });
}

/** Self-check used by the workflow coverage gate: each workflow's own examples must select it. */
export function coverage(cwd = ROOT_DEFAULT) {
  const { workflows, problems } = discover(cwd);
  const failures = [...problems];
  for (const w of workflows) {
    if (!w.match) { failures.push(`${w.name}: no match metadata`); continue; }
    for (const ex of w.match.examples || []) {
      const r = matchOrder({ order: ex, cwd });
      if (r.selected !== w.name) failures.push(`${w.name}: example "${ex}" selected ${r.selected ?? r.status} (top: ${r.candidates[0]?.workflow}@${r.candidates[0]?.score})`);
    }
  }
  return { workflows: workflows.length, failures };
}

function main() {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : null; };
  if (flag("discover")) { console.log(JSON.stringify(discover(), (k, v) => (k === "phases" ? undefined : v), 2)); return; }
  if (flag("coverage")) { const c = coverage(); console.log(JSON.stringify(c, null, 2)); process.exitCode = c.failures.length ? 1 : 0; return; }
  const order = flag("order");
  if (!order || order === true) { console.error('USAGE: workflow-match.mjs --order "<text>" [--intent id] [--record] | --discover | --coverage'); process.exitCode = 2; return; }
  const res = matchOrder({ order, intent: flag("intent") || null });
  const out = flag("record") ? { ...res, record: recordMatch(res).id } : res;
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = res.status === "MATCHED" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
