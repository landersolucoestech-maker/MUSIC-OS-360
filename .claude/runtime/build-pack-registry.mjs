#!/usr/bin/env node
// Builds .claude/registry/pack-registry.json from the pack's markdown definitions (the single source of
// truth): every agent and skill with its classification, the capabilities each agent declares, the skills
// each agent consumes (-> `consumers` of a skill, `executors` of a capability), the workflows and the routing.
// The registry is derived: never edit it by hand; validate-pack-contracts.mjs fails when it drifts.
//
//   node .claude/runtime/build-pack-registry.mjs            write the registry
//   node .claude/runtime/build-pack-registry.mjs --check    exit 1 when the file on disk differs
//   node .claude/runtime/build-pack-registry.mjs --sync-policy   also (re)write the pack agents' entries in
//        .claude/policies/capabilities.json (tool ceiling = frontmatter tools) and .claude/ownership.json
//        (write scope = Scope `- writes:`)
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPackManifest, agentPath, skillPath, parseAgentFile, parseSkillFile } from "./lib/pack-model.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DEFAULT = join(__dirname, "..", "..");

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function loadPack(root = ROOT_DEFAULT) {
  const manifest = loadPackManifest(root);
  const agents = [];
  const skills = [];
  for (const item of manifest.items) {
    if (item.type === "agent" && existsSync(agentPath(root, item.name))) agents.push(parseAgentFile(agentPath(root, item.name)));
    if (item.type === "skill" && existsSync(skillPath(root, item.name))) skills.push(parseSkillFile(skillPath(root, item.name)));
  }
  const capDefs = readJson(join(root, ".claude", "registry", "capabilities.json"), { capabilities: [] }).capabilities;
  return { manifest, agents, skills, capDefs, supplementalDefinitions: manifest.supplementalDefinitions || { agents: [], skills: [] } };
}

export function buildRegistry(root = ROOT_DEFAULT) {
  const { manifest, agents, skills, capDefs, supplementalDefinitions } = loadPack(root);
  const consumers = new Map();
  for (const a of agents) for (const s of a.skills) consumers.set(s, [...(consumers.get(s) || []), a.name]);

  const capabilities = capDefs.map((c) => {
    const executors = agents.filter((a) => a.capabilities.includes(c.id)).map((a) => a.name).sort();
    const skillSet = new Set(agents.filter((a) => a.capabilities.includes(c.id)).flatMap((a) => a.skills));
    return { ...c, executors, skills: [...skillSet].sort() };
  }).sort((x, y) => (x.id < y.id ? -1 : 1));

  const workflowsDir = join(root, ".claude", "workflows");
  const workflows = existsSync(workflowsDir)
    ? readdirSync(workflowsDir).filter((f) => f.endsWith(".json")).sort().map((f) => {
        const w = JSON.parse(readFileSync(join(workflowsDir, f), "utf8"));
        return { name: w.name, file: `.claude/workflows/${f}`, phases: (w.phases || []).length };
      })
    : [];

  return {
    generatedFrom: ".claude/agents/*.md, .claude/skills/*/SKILL.md, .claude/registry/capabilities.json, .claude/workflows/*.json",
    counts: {
      packItems: manifest.items.length,
      agents: agents.length,
      skills: skills.length,
      capabilities: capabilities.length,
      workflows: workflows.length,
      supplementalAgents: supplementalDefinitions.agents.length,
      supplementalSkills: supplementalDefinitions.skills.length,
      totalAgents: agents.length + supplementalDefinitions.agents.length,
      totalSkills: skills.length + supplementalDefinitions.skills.length,
    },
    supplementalDefinitions,
    agents: agents.map((a) => ({
      name: a.name, kind: a.kind, domain: a.domain, batch: a.batch, owner: a.owner,
      path: `.claude/agents/${a.name}.md`, tools: a.tools, writes: a.writes, capabilities: a.capabilities,
      skills: a.skills, approval: a.approval,
    })).sort(byName),
    skills: skills.map((s) => ({
      name: s.name, kind: s.kind, domain: s.domain, batch: s.batch, approval: s.approval, mutates: s.mutates,
      path: `.claude/skills/${s.name}/SKILL.md`, consumers: (consumers.get(s.name) || []).sort(),
    })).sort(byName),
    capabilities,
    workflows,
  };
}

function syncPolicy(root, agents) {
  const capPath = join(root, ".claude", "policies", "capabilities.json");
  const caps = readJson(capPath);
  const packNames = new Set(agents.map((a) => a.name));
  const kept = caps.roles.filter((r) => !packNames.has(r.agent));
  const added = agents.map((a) => ({ agent: a.name, allowedTools: a.tools }));
  caps.roles = [...kept, ...added.sort((x, y) => (x.agent < y.agent ? -1 : 1))];
  writeFileSync(capPath, JSON.stringify(caps, null, 2) + "\n");

  const ownPath = join(root, ".claude", "ownership.json");
  const own = readJson(ownPath);
  const keptOwners = own.owners.filter((o) => !packNames.has(o.agent));
  const newOwners = agents.map((a) => ({
    agent: a.name,
    writes: a.writes,
    note: a.writes.length ? `pack writer (${a.domain}); scope declared in .claude/agents/${a.name}.md` : "pack agent, read-only by contract",
  }));
  own.owners = [...keptOwners, ...newOwners.sort((x, y) => (x.agent < y.agent ? -1 : 1))];
  writeFileSync(ownPath, JSON.stringify(own, null, 2) + "\n");
}

function main() {
  const root = process.cwd().includes(".claude") ? ROOT_DEFAULT : (existsSync(join(process.cwd(), ".claude")) ? process.cwd() : ROOT_DEFAULT);
  const registry = buildRegistry(root);
  const text = JSON.stringify(registry, null, 1) + "\n";
  const out = join(root, ".claude", "registry", "pack-registry.json");
  if (process.argv.includes("--check")) {
    const current = existsSync(out) ? readFileSync(out, "utf8") : "";
    if (current !== text) { console.error("pack-registry.json is out of date: run node .claude/runtime/build-pack-registry.mjs"); process.exit(1); }
    console.log(JSON.stringify({ status: "OK", counts: registry.counts }));
    return;
  }
  writeFileSync(out, text);
  if (process.argv.includes("--sync-policy")) syncPolicy(root, loadPack(root).agents);
  console.log(JSON.stringify({ status: "WRITTEN", counts: registry.counts }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
