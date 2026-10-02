#!/usr/bin/env node
// Deterministic router of the pack: task -> intent -> capabilities -> agent -> skills -> tools ->
// validation -> evidence, with the approval decision. It reads .claude/registry/routing.json (intents,
// keywords, high-impact signals) and the derived pack-registry.json (agents, skills, capabilities) and
// emits routing-decision records (.claude/contracts/routing-decision.schema.json). It never executes
// anything: the orchestrators run the route.
//
//   node .claude/runtime/route-task.mjs --task "<text>" [--intent <id>] [--json]
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validate } from "./lib/schema-validate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DEFAULT = join(__dirname, "..", "..");
const readJson = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fb);

function words(text) { return String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function containsPhrase(haystack, phrase) {
  return ` ${haystack} `.includes(` ${words(phrase)} `);
}

export function classifyIntent(task, routing, explicitIntent) {
  if (explicitIntent) {
    const hit = routing.intents.find((i) => i.intent === explicitIntent);
    return hit ? { status: "OK", intent: hit } : { status: "UNKNOWN_INTENT", intent: null, candidates: [] };
  }
  const text = words(task);
  const scored = routing.intents
    .map((i) => ({ i, score: (i.keywords || []).filter((k) => containsPhrase(text, k)).length }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { status: "NEEDS_CLASSIFICATION", intent: null, candidates: [] };
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { status: "NEEDS_CLASSIFICATION", intent: null, candidates: scored.filter((s) => s.score === scored[0].score).map((s) => s.i.intent) };
  }
  return { status: "OK", intent: scored[0].i, candidates: [] };
}

export function approvalSignals(task, routing) {
  const text = words(task);
  const hits = [];
  for (const sig of routing.highImpactSignals || []) {
    if ((sig.patterns || []).some((p) => containsPhrase(text, p))) hits.push(sig.class);
  }
  return [...new Set(hits)];
}

export function routeTask({ task = "", intent: explicitIntent = null, root = ROOT_DEFAULT, now = new Date() } = {}) {
  const routing = readJson(join(root, ".claude", "registry", "routing.json"), { intents: [], highImpactSignals: [] });
  const registry = readJson(join(root, ".claude", "registry", "pack-registry.json"), { agents: [], skills: [], capabilities: [] });
  const cls = classifyIntent(task, routing, explicitIntent);
  if (cls.status !== "OK") return { status: cls.status, task, candidates: cls.candidates, routes: [] };

  const intent = cls.intent;
  const signals = approvalSignals(task, routing);
  const agentsByName = new Map(registry.agents.map((a) => [a.name, a]));
  const capById = new Map(registry.capabilities.map((c) => [c.id, c]));
  const routes = [];
  const unavailable = [];

  for (const capId of intent.capabilities) {
    const cap = capById.get(capId);
    if (!cap || cap.executors.length === 0) { unavailable.push({ capability: capId, reason: cap ? "no executor agent" : "capability not registered" }); continue; }
    const executors = cap.executors.map((n) => agentsByName.get(n)).filter(Boolean);
    const preferred = executors.filter((a) => a.domain === intent.domain);
    const ordered = [...preferred, ...executors.filter((a) => !preferred.includes(a))];
    const primary = ordered[0];
    const skills = primary.skills.filter((s) => cap.skills.includes(s));
    const approvalClass = signals[0] || (cap.approval !== "none" ? cap.approval : (primary.approval !== "none" ? primary.approval : undefined));
    const decision = {
      taskId: `route-${capId}`,
      intent: intent.intent,
      domain: intent.domain,
      capability: capId,
      agent: primary.name,
      skills: skills.length ? skills : primary.skills,
      tools: primary.tools,
      validation: cap.validation,
      evidence: cap.evidence,
      approvalRequired: Boolean(approvalClass),
      ...(approvalClass ? { approvalClass } : {}),
      fallbackAgents: ordered.slice(1).map((a) => a.name),
      createdAt: now.toISOString(),
    };
    const res = validate(join(root, ".claude", "contracts", "routing-decision.schema.json"), decision);
    if (!res.valid) throw new Error(`INVALID_ROUTING_DECISION ${capId}: ${res.errors.join("; ")}`);
    routes.push(decision);
  }

  const status = unavailable.length ? "CAPABILITY_UNAVAILABLE" : routes.some((r) => r.approvalRequired) ? "NEEDS_APPROVAL" : "OK";
  return { status, task, intent: intent.intent, domain: intent.domain, approvalSignals: signals, routes, unavailable };
}

function parseArgs(argv) {
  const out = { task: "", intent: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--task") out.task = argv[++i] || "";
    else if (argv[i] === "--intent") out.intent = argv[++i] || null;
    else if (argv[i] === "--json") out.json = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = existsSync(join(process.cwd(), ".claude")) ? process.cwd() : ROOT_DEFAULT;
  const res = routeTask({ task: args.task, intent: args.intent, root });
  console.log(JSON.stringify(res, null, args.json ? 2 : 1));
  if (res.status === "NEEDS_CLASSIFICATION" || res.status === "UNKNOWN_INTENT") process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
