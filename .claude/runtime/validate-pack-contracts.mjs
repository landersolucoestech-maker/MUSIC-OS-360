#!/usr/bin/env node
// Validates the MUSIC OS 360 pack against its contracts (agent-contract, skill-contract, pack-manifest,
// capability-entry, routing, workflows). Deterministic and read-only. It is the executable form of the
// per-batch validation of the mission: syntax, references, orphans, duplication, contracts, registry drift,
// ownership/tool ceilings, approval gates.
//
//   node .claude/runtime/validate-pack-contracts.mjs [--through-batch N] [--json]
//
// `--through-batch N` (default 24) means: every manifest item with batch <= N must exist and satisfy its
// contract; items of a later batch may be absent (PENDING) and may be referenced by earlier definitions.
// From batch 18 on, every skill needs a consuming agent; from batch 19 on workflows are checked; from batch 20
// on approval classes must exist in .claude/policies/authority.json; at 24 nothing may be PENDING.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPack, buildRegistry } from "./build-pack-registry.mjs";
import { checkAgent, checkSkill, listSections } from "./lib/pack-model.mjs";
import { parseFrontmatter } from "./lib/frontmatter.mjs";
import { validate } from "./lib/schema-validate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DEFAULT = join(__dirname, "..", "..");
const readJson = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fb);

function norm(t) { return String(t || "").replace(/\s+/g, " ").trim().toLowerCase(); }

export function validatePack(root = ROOT_DEFAULT, throughBatch = 24) {
  const problems = [];
  const warn = [];
  const { manifest, agents, skills, capDefs } = loadPack(root);
  const contractsDir = join(root, ".claude", "contracts");

  const manifestAgents = new Map(manifest.items.filter((i) => i.type === "agent").map((i) => [i.name, i]));
  const manifestSkills = new Map(manifest.items.filter((i) => i.type === "skill").map((i) => [i.name, i]));
  const agentNames = new Set(agents.map((a) => a.name));
  const skillNames = new Set(skills.map((s) => s.name));
  const coreSkills = new Set(existsSync(join(root, ".claude", "skills")) ? readdirSync(join(root, ".claude", "skills")) : []);

  // manifest shape
  const mres = validate(join(contractsDir, "pack-manifest.schema.json"), manifest);
  if (!mres.valid) problems.push(...mres.errors.map((e) => `pack-manifest: ${e}`));

  // A. every due item exists
  for (const it of manifest.items) {
    if (it.batch > throughBatch) continue;
    const file = it.type === "agent" ? join(root, ".claude", "agents", `${it.name}.md`) : join(root, ".claude", "skills", it.name, "SKILL.md");
    if (!existsSync(file)) problems.push(`missing ${it.type} "${it.name}" (batch ${it.batch})`);
  }

  // B. definitions on disk that look like pack members but are not in the manifest
  for (const f of existsSync(join(root, ".claude", "agents")) ? readdirSync(join(root, ".claude", "agents")) : []) {
    if (!f.endsWith(".md")) continue;
    const name = f.slice(0, -3);
    if (manifestAgents.has(name)) continue;
    const sections = listSections(parseFrontmatter(readFileSync(join(root, ".claude", "agents", f), "utf8")).body);
    if (sections.has("Identity") && /batch\s*:/i.test(sections.get("Identity"))) problems.push(`agent "${name}" has a pack Identity but is not in pack-manifest.json (unregistered definition)`);
  }

  const skillKnown = (s) => coreSkills.has(s) || skillNames.has(s) || (manifestSkills.has(s) && manifestSkills.get(s).batch > throughBatch);
  const capabilityIds = new Set(capDefs.map((c) => c.id));
  const ctx = { skillKnown, capabilityIds };

  // C. per-file contracts
  for (const a of agents) {
    const item = manifestAgents.get(a.name);
    if (item && item.batch > throughBatch) continue;
    for (const e of checkAgent(a, ctx)) problems.push(`agent ${a.name}: ${e}`);
    if (item && item.batch !== a.batch) problems.push(`agent ${a.name}: identity.batch ${a.batch} differs from manifest batch ${item.batch}`);
  }
  for (const s of skills) {
    const item = manifestSkills.get(s.name);
    if (item && item.batch > throughBatch) continue;
    for (const e of checkSkill(s, ctx)) problems.push(`skill ${s.name}: ${e}`);
    if (item && item.batch !== s.batch) problems.push(`skill ${s.name}: classification.batch ${s.batch} differs from manifest batch ${item.batch}`);
  }

  // D. tool ceilings and ownership
  const caps = readJson(join(root, ".claude", "policies", "capabilities.json"), { roles: [] });
  const own = readJson(join(root, ".claude", "ownership.json"), { owners: [] });
  for (const a of agents) {
    const role = caps.roles.find((r) => r.agent === a.name);
    if (!role) problems.push(`agent ${a.name}: not in .claude/policies/capabilities.json (run build-pack-registry.mjs --sync-policy)`);
    else if (role.allowedTools.join(",") !== a.tools.join(",")) problems.push(`agent ${a.name}: capabilities.json ceiling ${role.allowedTools.join(",")} differs from frontmatter ${a.tools.join(",")}`);
    const owner = own.owners.find((o) => o.agent === a.name);
    if (!owner) problems.push(`agent ${a.name}: not in .claude/ownership.json`);
    else if (owner.writes.join("|") !== a.writes.join("|")) problems.push(`agent ${a.name}: ownership writes differ from the declared Scope writes`);
  }

  // E. capabilities: executor + skill
  for (const c of capDefs) {
    const res = validate(join(contractsDir, "capability-entry.schema.json"), { ...c, executors: c.executors || ["_derived"], skills: c.skills || ["_derived"] });
    if (!res.valid) problems.push(...res.errors.map((e) => `capability ${c.id}: ${e}`));
  }
  const registry = buildRegistry(root);
  for (const c of registry.capabilities) {
    if (c.executors.length === 0) problems.push(`capability ${c.id}: no executor agent (capability without executor)`);
    else if (c.skills.length === 0) problems.push(`capability ${c.id}: executors consume no skill`);
  }

  // F. skills consumed, agents with skills
  if (throughBatch >= 18) {
    for (const s of registry.skills) if (s.consumers.length === 0) problems.push(`skill ${s.name}: no consuming agent (orphan skill)`);
  }

  // G. duplication of the parts that must be specific
  const dup = (label, pick) => {
    const seen = new Map();
    for (const a of agents) {
      const k = norm(pick(a));
      if (k.length < 25) continue;
      if (seen.has(k)) problems.push(`agent ${a.name}: ${label} duplicates agent ${seen.get(k)} (generic definition)`);
      else seen.set(k, a.name);
    }
  };
  dup("mission", (a) => a.sections.get("Mission"));
  dup("responsibilities", (a) => a.sections.get("Responsibilities"));
  const seenPurpose = new Map();
  for (const s of skills) {
    const k = norm(s.sections.get("Purpose"));
    if (k.length < 25) continue;
    if (seenPurpose.has(k)) problems.push(`skill ${s.name}: purpose duplicates skill ${seenPurpose.get(k)}`);
    else seenPurpose.set(k, s.name);
  }

  // H. approval vocabulary
  if (throughBatch >= 20) {
    const classes = new Set((readJson(join(root, ".claude", "policies", "authority.json"), { actionClasses: [] }).actionClasses || []).map((c) => c.name).concat("none"));
    for (const a of agents) if (a.approval && !classes.has(a.approval.split(/[ ,]/)[0])) problems.push(`agent ${a.name}: approval class "${a.approval}" not in authority.json`);
    for (const s of skills) if (s.approval && !classes.has(s.approval.split(/[ ,]/)[0])) problems.push(`skill ${s.name}: approval class "${s.approval}" not in authority.json`);
  }

  // I. workflows
  if (throughBatch >= 19) {
    const wdir = join(root, ".claude", "workflows");
    const skillApproval = new Map(skills.map((s) => [s.name, s.approval]));
    for (const f of existsSync(wdir) ? readdirSync(wdir).filter((x) => x.endsWith(".json")) : []) {
      const w = JSON.parse(readFileSync(join(wdir, f), "utf8"));
      const res = validate(join(contractsDir, "workflow-manifest.schema.json"), w);
      if (!res.valid) problems.push(...res.errors.map((e) => `workflow ${w.name}: ${e}`));
      const approved = new Set();
      for (const ph of w.phases || []) {
        for (const ag of ph.requiredAgents || []) if (!agentNames.has(ag) && !existsSync(join(root, ".claude", "agents", `${ag}.md`))) problems.push(`workflow ${w.name}/${ph.id}: unknown agent "${ag}"`);
        for (const sk of ph.requiredSkills || []) if (!skillKnown(sk) && !existsSync(join(root, ".claude", "skills", sk))) problems.push(`workflow ${w.name}/${ph.id}: unknown skill "${sk}"`);
        if (ph.approvalRequired) approved.add(ph.id);
        const guarded = ph.approvalRequired || (ph.dependsOn || []).some((d) => approved.has(d));
        for (const sk of ph.requiredSkills || []) {
          const ap = skillApproval.get(sk);
          if (ap && ap !== "none" && !guarded) problems.push(`workflow ${w.name}/${ph.id}: high-impact skill "${sk}" (approval ${ap}) has no approval gate before it`);
        }
        if (ph.approvalRequired) approved.add(ph.id);
      }
      if (!(w.completionConditions || []).length && w.domain) warn.push(`workflow ${w.name}: no completionConditions`);
    }
  }

  // J. routing
  const routingPath = join(root, ".claude", "registry", "routing.json");
  if (existsSync(routingPath)) {
    const routing = readJson(routingPath);
    for (const r of routing.intents || []) {
      for (const c of r.capabilities || []) if (!capabilityIds.has(c)) problems.push(`routing intent ${r.intent}: unknown capability "${c}"`);
    }
  }

  // K. registry drift
  const regPath = join(root, ".claude", "registry", "pack-registry.json");
  const expected = JSON.stringify(registry, null, 1) + "\n";
  if (!existsSync(regPath)) problems.push("pack-registry.json missing (run build-pack-registry.mjs)");
  else if (readFileSync(regPath, "utf8") !== expected) problems.push("pack-registry.json is out of date (run build-pack-registry.mjs)");

  // L. closure
  if (throughBatch >= 24) {
    for (const it of manifest.items) if (it.finalState === "PENDING") problems.push(`manifest item "${it.name}" still PENDING at final batch`);
  }

  return {
    status: problems.length === 0 ? "PASS" : "FAIL",
    throughBatch,
    counts: { manifestItems: manifest.items.length, agentsPresent: agents.length, skillsPresent: skills.length, capabilities: capDefs.length },
    problems,
    warnings: warn,
  };
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--through-batch");
  const through = i >= 0 ? Number(args[i + 1]) : 24;
  const root = existsSync(join(process.cwd(), ".claude")) ? process.cwd() : ROOT_DEFAULT;
  const res = validatePack(root, through);
  if (args.includes("--json")) console.log(JSON.stringify(res, null, 2));
  else {
    console.log(`pack contracts through batch ${through}: ${res.status} (${JSON.stringify(res.counts)})`);
    for (const p of res.problems.slice(0, 80)) console.log(`  - ${p}`);
    if (res.problems.length > 80) console.log(`  … ${res.problems.length - 80} more (--json)`);
    for (const w of res.warnings) console.log(`  warn: ${w}`);
  }
  if (res.status !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
