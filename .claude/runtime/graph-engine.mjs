#!/usr/bin/env node
// Loads a .claude/workflows/*.json workflow-manifest, validates it, and builds an
// execution-graph (nodes = phases, edges = dependsOn) with cycle detection and
// topological "what can run next" queries. Consumer: mission-orchestrator when
// running the systemic-audit (or any) workflow; gate-engine.mjs walks the same
// graph to know which gates apply to which phase.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validate } from "./lib/schema-validate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function contractsDir(cwd) {
  const local = join(cwd, ".claude", "contracts");
  return existsSync(local) ? local : join(__dirname, "..", "contracts");
}

function workflowsDir(cwd) {
  const local = join(cwd, ".claude", "workflows");
  return existsSync(local) ? local : join(__dirname, "..", "workflows");
}

// Names become file names (workflows/<name>.json): reject anything that could leave the directory.
export const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function loadWorkflow(name, cwd = process.cwd()) {
  if (typeof name !== "string" || !SAFE_NAME.test(name) || name.includes("..")) throw new Error(`INVALID_WORKFLOW_NAME: ${JSON.stringify(name)}`);
  const path = join(workflowsDir(cwd), `${name}.json`);
  if (!existsSync(path)) throw new Error(`UNKNOWN_WORKFLOW: ${name} (looked in ${path})`);
  const data = JSON.parse(readFileSync(path, "utf8"));
  const result = validate(join(contractsDir(cwd), "workflow-manifest.schema.json"), data);
  if (!result.valid) throw new Error(`INVALID_WORKFLOW (${name}): ${result.errors.join("; ")}`);
  return data;
}

export function detectCycle(phases) {
  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(phases.map((p) => [p.id, p]));
  function visit(id, path) {
    if (visited.has(id)) return null;
    if (visiting.has(id)) return [...path, id];
    visiting.add(id);
    for (const dep of byId.get(id)?.dependsOn || []) {
      const cycle = visit(dep, [...path, id]);
      if (cycle) return cycle;
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  }
  for (const p of phases) {
    const cycle = visit(p.id, []);
    if (cycle) return cycle;
  }
  return null;
}

// execution-graph isn't a RECORD_KINDS entry (it's a structural artifact derived
// from a workflow, not an ops audit record) — validated and returned directly.
export function build(workflowName, cwd = process.cwd()) {
  const workflow = loadWorkflow(workflowName, cwd);
  const cycle = detectCycle(workflow.phases);
  if (cycle) throw new Error(`WORKFLOW_HAS_CYCLE: ${cycle.join(" -> ")}`);
  const nodes = workflow.phases.map((p) => ({
    id: p.id, kind: "agent", ref: (p.requiredAgents || [])[0] || p.id,
    dependsOn: p.dependsOn || [], status: "PENDING",
  }));
  const graph = { id: `graph-${workflowName}-${Date.now().toString(36)}`, workflowName, nodes };
  const result = validate(join(contractsDir(cwd), "execution-graph.schema.json"), graph);
  if (!result.valid) throw new Error(`INVALID_EXECUTION_GRAPH: ${result.errors.join("; ")}`);
  return graph;
}

/** Nodes whose dependencies are all DONE and which are themselves still PENDING. */
export function nextRunnable(graph) {
  const statusById = new Map(graph.nodes.map((n) => [n.id, n.status]));
  return graph.nodes.filter((n) => n.status === "PENDING" && n.dependsOn.every((d) => statusById.get(d) === "DONE"));
}

function main() {
  const [cmd, name] = process.argv.slice(2);
  if (cmd !== "build" || !name) {
    console.log(JSON.stringify({ status: "ERROR", message: "USAGE: graph-engine.mjs build <workflow-name>" }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(build(name), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
