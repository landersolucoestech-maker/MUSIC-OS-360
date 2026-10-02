// Shared model of the MUSIC OS 360 pack: how pack agents/skills are parsed from their markdown
// (the single source of truth), which sections the agent/skill contracts require, and the
// deterministic checks both build-pack-registry.mjs and validate-pack-contracts.mjs run.
// Contracts: .claude/contracts/agent-contract.schema.json, skill-contract.schema.json,
// pack-manifest.schema.json, pack-registry.schema.json.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./frontmatter.mjs";

export const AGENT_SECTIONS = [
  "Identity", "Mission", "Responsibilities", "Scope", "Non-responsibilities", "Inputs", "Outputs",
  "Required evidence", "Allowed tools", "Forbidden actions", "Required skills", "Escalation rules",
  "Approval requirements", "Handoff contract", "Completion criteria",
];
export const SKILL_SECTIONS = [
  "Classification", "Purpose", "Invocation conditions", "Required inputs", "Procedure", "Expected outputs",
  "Validation", "Evidence", "Failure behavior", "Rollback and recovery", "Human approval",
];
export const AGENT_KINDS = [
  "orchestrator", "coordinator", "planner", "router", "controller", "mapper", "analyzer", "detector", "validator",
  "guardian", "engineer", "reviewer", "auditor", "investigator", "operational",
];
export const WRITER_TOOLS = ["Edit", "Write"];

/** Phrases that mark a definition as generic filler (forbidden by the mission: every definition must be concrete). */
export const GENERIC_PHRASES = [
  /analy[sz]e the task and provide recommendations/i,
  /perform the requested operation/i,
  /\bTODO\b/, /\bFIXME\b/, /\bTBD\b/, /lorem ipsum/i, /\bplaceholder\b/i, /\bstub\b/i,
  /to be (defined|written|completed) later/i,
];

export function listSections(body) {
  const out = new Map();
  const parts = `\n${body}`.split(/\n## /).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    out.set(heading, (nl === -1 ? "" : part.slice(nl + 1)).trim());
  }
  return out;
}

/** `- key: value` lines of a section. */
export function parseKv(text = "") {
  const kv = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*([A-Za-z][A-Za-z0-9 _-]*?)\s*:\s*(.+?)\s*$/);
    if (m) kv[m[1].toLowerCase()] = m[2];
  }
  return kv;
}

export function parseList(value = "") {
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "none") return [];
  return v.split(",").map((s) => s.trim().replace(/^`|`$/g, "")).filter(Boolean);
}

/** First backticked token of every bullet: "- `skill-name` — why". */
export function parseBacktickedBullets(text = "") {
  const names = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s*`([^`]+)`/);
    if (m) names.push(m[1].trim());
  }
  return names;
}

export function loadPackManifest(root) {
  const p = join(root, ".claude", "registry", "pack-manifest.json");
  if (!existsSync(p)) return { name: "missing", items: [] };
  return JSON.parse(readFileSync(p, "utf8"));
}

export function agentPath(root, name) { return join(root, ".claude", "agents", `${name}.md`); }
export function skillPath(root, name) { return join(root, ".claude", "skills", name, "SKILL.md"); }

export function parseAgentFile(path) {
  const raw = readFileSync(path, "utf8");
  const { data, body } = parseFrontmatter(raw);
  const sections = listSections(body);
  const identity = parseKv(sections.get("Identity"));
  const scope = parseKv(sections.get("Scope"));
  const approval = parseKv(sections.get("Approval requirements"));
  const tools = (data.tools || "").split(",").map((t) => t.trim()).filter(Boolean);
  return {
    path, frontmatter: data, sections, raw,
    name: data.name,
    kind: identity.kind, domain: identity.domain, batch: Number(identity.batch),
    owner: identity.owner, capabilities: parseList(identity.capabilities),
    tools, writes: parseList(scope.writes),
    skills: parseBacktickedBullets(sections.get("Required skills")),
    approval: approval.approval,
    sectionNames: [...sections.keys()],
  };
}

export function parseSkillFile(path) {
  const raw = readFileSync(path, "utf8");
  const { data, body } = parseFrontmatter(raw);
  const sections = listSections(body);
  const cls = parseKv(sections.get("Classification"));
  return {
    path, frontmatter: data, sections, raw,
    name: data.name, kind: cls.kind, domain: cls.domain, batch: Number(cls.batch),
    approval: cls.approval, mutates: /^yes$/i.test(cls.mutates || ""),
    capabilityUnavailable: /^yes$/i.test(cls["capability-unavailable"] || ""),
    sectionNames: [...sections.keys()],
  };
}

function nonEmpty(text) { return typeof text === "string" && text.replace(/\s+/g, " ").trim().length >= 25; }

export function checkAgent(a, ctx) {
  const errors = [];
  const { frontmatter: fm } = a;
  if (fm.name !== a.name || !a.name) errors.push("frontmatter name missing");
  if (!fm.description || fm.description.length < 40) errors.push("description shorter than 40 characters");
  if (!AGENT_KINDS.includes(a.kind)) errors.push(`kind "${a.kind}" not in ${AGENT_KINDS.join("|")}`);
  if (!a.domain) errors.push("identity.domain missing");
  if (!Number.isInteger(a.batch)) errors.push("identity.batch missing");
  if (!a.owner) errors.push("identity.owner missing");
  if (a.capabilities.length === 0) errors.push("identity.capabilities empty");
  for (const s of AGENT_SECTIONS) {
    if (!a.sections.has(s)) errors.push(`section "${s}" missing`);
    else if (!nonEmpty(a.sections.get(s))) errors.push(`section "${s}" empty or too short`);
  }
  if (a.tools.length === 0) errors.push("frontmatter tools empty");
  const allowedBody = parseList((a.sections.get("Allowed tools") || "").split("\n").find((l) => /tools\s*:/i.test(l))?.split(":")[1] || "");
  if (allowedBody.join(",") !== a.tools.join(",")) errors.push(`"Allowed tools" (${allowedBody.join(",")}) differs from frontmatter tools (${a.tools.join(",")})`);
  const isWriter = a.tools.some((t) => WRITER_TOOLS.includes(t));
  if (isWriter && a.writes.length === 0) errors.push("writer agent (Edit/Write) declares no write scope");
  if (!isWriter && a.writes.length > 0) errors.push("read-only agent declares a write scope");
  if (!a.approval) errors.push("approval requirements: `- approval:` line missing");
  if (a.skills.length === 0) errors.push("required skills empty");
  for (const s of a.skills) if (!ctx.skillKnown(s)) errors.push(`required skill "${s}" is neither on disk nor in the pack manifest`);
  for (const c of a.capabilities) if (ctx.capabilityIds && !ctx.capabilityIds.has(c)) errors.push(`capability "${c}" is not defined in .claude/registry/capabilities.json`);
  for (const re of GENERIC_PHRASES) if (re.test(a.raw)) errors.push(`generic/placeholder text matches ${re}`);
  return errors;
}

export function checkSkill(s, ctx) {
  const errors = [];
  const { frontmatter: fm } = s;
  if (fm.name !== s.name || !s.name) errors.push("frontmatter name missing");
  if (!fm.description || fm.description.length < 40) errors.push("description shorter than 40 characters");
  if (!s.kind) errors.push("classification.kind missing");
  if (!s.domain) errors.push("classification.domain missing");
  if (!Number.isInteger(s.batch)) errors.push("classification.batch missing");
  if (!s.approval) errors.push("classification.approval missing");
  for (const sec of SKILL_SECTIONS) {
    if (!s.sections.has(sec)) errors.push(`section "${sec}" missing`);
    else if (!nonEmpty(s.sections.get(sec))) errors.push(`section "${sec}" empty or too short`);
  }
  const steps = (s.sections.get("Procedure") || "").split("\n").filter((l) => /^\s*\d+\.\s+\S/.test(l));
  if (steps.length < 3) errors.push(`procedure has ${steps.length} numbered steps (need at least 3)`);
  if (s.mutates && !/rollback|restor|revert|compensat|undo/i.test(s.sections.get("Rollback and recovery") || "")) errors.push("mutating skill has no rollback/restore/compensation statement");
  if (s.capabilityUnavailable) {
    const t = s.raw;
    for (const k of ["required integration", "expected contract", "expected input", "expected output", "safe fallback"]) {
      if (!new RegExp(k, "i").test(t)) errors.push(`capability-unavailable skill lacks "${k}"`);
    }
  }
  for (const re of GENERIC_PHRASES) if (re.test(s.raw)) errors.push(`generic/placeholder text matches ${re}`);
  return errors;
}

export function listDir(dir) { return existsSync(dir) ? readdirSync(dir) : []; }
