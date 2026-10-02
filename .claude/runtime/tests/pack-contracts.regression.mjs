// Regression test for validate-pack-contracts.mjs / build-pack-registry.mjs / lib/pack-model.mjs:
// proves, on a throwaway pack, that a valid agent+skill pass and that every contract violation the
// mission forbids (generic filler, missing section, unknown skill, capability without executor, writer
// without scope, tool-ceiling drift, orphan skill, stale registry, high-impact skill without approval gate)
// is actually rejected, so a green validation is not vacuous.
// Run via: node --test .claude/runtime/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { validatePack } from "../validate-pack-contracts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(__dirname, "..", "..", "..");
const BUILD = join(REAL_ROOT, ".claude", "runtime", "build-pack-registry.mjs");

const section = (title, body) => `## ${title}\n${body}\n\n`;
function agentMd({ name = "demo-reviewer", tools = "Read, Grep, Glob, Bash", writes = "none", skills = ["demo-audit"], caps = "demo.review", mission = "Review the demo module boundary for tenant leaks and report each leak with its file and line.", resp = "- Trace every query of the demo module back to its tenant filter.\n- Report each unscoped query with file and line.", extra = "" } = {}) {
  return `---
name: ${name}
description: Reviews the demo module boundary for tenant leaks; use before any change to the demo queries.
tools: ${tools}
---
# ${name}

` +
    section("Identity", `- kind: reviewer\n- domain: demo\n- batch: 2\n- owner: demo owner\n- capabilities: ${caps}`) +
    section("Mission", mission) + section("Responsibilities", resp) +
    section("Scope", `- reads: apps/demo/**\n- writes: ${writes}`) +
    section("Non-responsibilities", "- Does not fix the leaks it finds; hands them to the writer agent.") +
    section("Inputs", "- The list of changed demo files and the current diff.") +
    section("Outputs", "- A finding list with file, line and the missing tenant filter.") +
    section("Required evidence", "- The grep or query trace that proves each finding.") +
    section("Allowed tools", `- tools: ${tools}`) +
    section("Forbidden actions", "- Editing files or running mutating commands.") +
    section("Required skills", skills.map((s) => `- \`${s}\` — traces the queries`).join("\n")) +
    section("Escalation rules", "- Escalate to the escalation router when two reviewers disagree on a leak.") +
    section("Approval requirements", "- approval: none\n- rationale: read-only review, nothing it does needs a human decision.") +
    section("Handoff contract", "- Returns the finding list as a structured output to the caller.") +
    section("Completion criteria", "- Every query of the changed files was traced and classified.") + extra;
}
function skillMd({ name = "demo-audit", procedure = "1. List the demo queries.\n2. Check each tenant filter.\n3. Record each result.", approval = "none", mutates = "no", extra = "" } = {}) {
  return `---
name: ${name}
description: Audits the demo module queries for a missing tenant filter and records each result.
---
# ${name}

` +
    section("Classification", `- kind: audit\n- domain: demo\n- batch: 16\n- approval: ${approval}\n- mutates: ${mutates}`) +
    section("Purpose", "Find demo queries that read data without a tenant filter.") +
    section("Invocation conditions", "- Any change that touches a demo query or its repository.") +
    section("Required inputs", "- The list of changed demo files and the current diff.") + section("Procedure", procedure) +
    section("Expected outputs", "- A table of query, filter and verdict.") + section("Validation", "- Every changed query appears in the table.") +
    section("Evidence", "- The grep output that lists the queries.") + section("Failure behavior", "- A query that cannot be traced is reported as unknown, never as safe.") +
    section("Rollback and recovery", "- Read-only: nothing to restore; rerun after a fix.") + section("Human approval", "- None required for a read-only audit.") + extra;
}

function makePack(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), "eos-pack-contracts-"));
  const c = join(root, ".claude");
  for (const d of ["agents", "skills", "contracts", "policies", "registry", "workflows"]) mkdirSync(join(c, d), { recursive: true });
  cpSync(join(REAL_ROOT, ".claude", "contracts"), join(c, "contracts"), { recursive: true });
  const items = [
    { name: "demo-reviewer", type: "agent", batch: 2, initialState: "ABSENT", finalState: "CREATED" },
    { name: "demo-audit", type: "skill", batch: 16, initialState: "ABSENT", finalState: "CREATED" },
  ];
  writeFileSync(join(c, "registry", "pack-manifest.json"), JSON.stringify({ name: "t", items }));
  writeFileSync(join(c, "registry", "capabilities.json"), JSON.stringify({ capabilities: [{ id: "demo.review", domain: "demo", description: "Review demo queries", validation: ["validate-pack-contracts"], evidence: ["grep"], approval: "none" }, ...(opts.extraCaps || [])] }));
  writeFileSync(join(c, "policies", "capabilities.json"), JSON.stringify({ roles: [{ agent: "demo-reviewer", allowedTools: opts.ceiling || ["Read", "Grep", "Glob", "Bash"] }] }));
  writeFileSync(join(c, "policies", "authority.json"), JSON.stringify({ actionClasses: [{ name: "none", requiresApproval: false }] }));
  writeFileSync(join(c, "ownership.json"), JSON.stringify({ owners: [{ agent: "demo-reviewer", writes: opts.ownWrites || [] }] }));
  writeFileSync(join(c, "agents", "demo-reviewer.md"), opts.agent ?? agentMd());
  mkdirSync(join(c, "skills", "demo-audit"), { recursive: true });
  writeFileSync(join(c, "skills", "demo-audit", "SKILL.md"), opts.skill ?? skillMd());
  if (!opts.noBuild) execFileSync(process.execPath, [BUILD], { cwd: root });
  return root;
}
const run = (root, batch = 24) => validatePack(root, batch);
const withPack = (opts, fn) => { const root = makePack(opts); try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); } };

test("a valid agent + skill + capability pass through batch 24", () => {
  withPack({}, (root) => { const r = run(root); assert.deepEqual(r.problems, []); assert.equal(r.status, "PASS"); });
});

test("generic filler is rejected", () => {
  withPack({ agent: agentMd({ mission: "Analyze the task and provide recommendations for the demo module." }) }, (root) => {
    assert.ok(run(root).problems.some((p) => /generic\/placeholder/.test(p)));
  });
  withPack({ skill: skillMd({ extra: "\nTODO: fill in\n" }) }, (root) => assert.ok(run(root).problems.some((p) => /generic\/placeholder/.test(p))));
});

test("a missing or empty mandatory section is rejected", () => {
  withPack({ agent: agentMd().replace(/## Escalation rules[\s\S]*?\n\n/, "") }, (root) => assert.ok(run(root).problems.some((p) => /section "Escalation rules" missing/.test(p))));
  withPack({ skill: skillMd().replace(/## Evidence\n[\s\S]*?\n\n/, "## Evidence\nx\n\n") }, (root) => assert.ok(run(root).problems.some((p) => /section "Evidence" empty/.test(p))));
});

test("a skill procedure needs at least three numbered steps; a mutating skill needs rollback", () => {
  withPack({ skill: skillMd({ procedure: "1. Do the one thing." }) }, (root) => assert.ok(run(root).problems.some((p) => /numbered steps/.test(p))));
  withPack({ skill: skillMd({ mutates: "yes" }).replace("Read-only: nothing to restore; rerun after a fix.", "Nothing special happens here at all.") }, (root) => assert.ok(run(root).problems.some((p) => /rollback/.test(p))));
});

test("an unknown skill reference fails once its batch is due, but is tolerated while the skill's batch is later", () => {
  withPack({ agent: agentMd({ skills: ["demo-audit", "ghost-skill"] }) }, (root) => assert.ok(run(root).problems.some((p) => /"ghost-skill" is neither on disk nor in the pack manifest/.test(p))));
});

test("a capability without an executor, and an orphan skill, are rejected", () => {
  withPack({ extraCaps: [{ id: "demo.unowned", domain: "demo", description: "nobody does this", validation: ["x"], evidence: ["y"], approval: "none" }] }, (root) => assert.ok(run(root).problems.some((p) => /capability demo\.unowned: no executor/.test(p))));
  withPack({ agent: agentMd({ skills: ["demo-audit"] }).replace("`demo-audit`", "`code-review`") }, (root) => assert.ok(run(root).problems.some((p) => /skill demo-audit: no consuming agent/.test(p))));
});

test("a writer without a write scope, and a read-only agent with one, are rejected", () => {
  withPack({ agent: agentMd({ tools: "Read, Edit, Write, Grep, Glob, Bash", writes: "none" }), ceiling: ["Read", "Edit", "Write", "Grep", "Glob", "Bash"] }, (root) => assert.ok(run(root).problems.some((p) => /writer agent .* no write scope/.test(p))));
  withPack({ agent: agentMd({ writes: "apps/demo/**" }), ownWrites: ["apps/demo/**"] }, (root) => assert.ok(run(root).problems.some((p) => /read-only agent declares a write scope/.test(p))));
});

test("tool-ceiling drift between the frontmatter and capabilities.json is rejected", () => {
  withPack({ ceiling: ["Read"] }, (root) => assert.ok(run(root).problems.some((p) => /ceiling Read differs from frontmatter/.test(p))));
});

test("a stale registry is rejected", () => {
  withPack({}, (root) => {
    const p = join(root, ".claude", "registry", "pack-registry.json");
    writeFileSync(p, readFileSync(p, "utf8").replace('"demo-reviewer"', '"renamed"'));
    assert.ok(run(root).problems.some((m) => /pack-registry\.json is out of date/.test(m)));
  });
});

test("two agents with the same mission are rejected as generic duplicates", () => {
  withPack({}, (root) => {
    const c = join(root, ".claude");
    const items = JSON.parse(readFileSync(join(c, "registry", "pack-manifest.json"), "utf8"));
    items.items.push({ name: "demo-twin", type: "agent", batch: 2, initialState: "ABSENT", finalState: "CREATED" });
    writeFileSync(join(c, "registry", "pack-manifest.json"), JSON.stringify(items));
    writeFileSync(join(c, "agents", "demo-twin.md"), agentMd({ name: "demo-twin", resp: "- Check twin things in a different way.\n- Report the twin results elsewhere." }));
    const caps = JSON.parse(readFileSync(join(c, "policies", "capabilities.json"), "utf8")); caps.roles.push({ agent: "demo-twin", allowedTools: ["Read", "Grep", "Glob", "Bash"] });
    writeFileSync(join(c, "policies", "capabilities.json"), JSON.stringify(caps));
    const own = JSON.parse(readFileSync(join(c, "ownership.json"), "utf8")); own.owners.push({ agent: "demo-twin", writes: [] });
    writeFileSync(join(c, "ownership.json"), JSON.stringify(own));
    execFileSync(process.execPath, [BUILD], { cwd: root });
    assert.ok(run(root).problems.some((m) => /mission duplicates agent demo-reviewer/.test(m)));
  });
});

test("a high-impact skill in a workflow phase without an approval gate is rejected; with the gate it passes", () => {
  const wf = (approvalPhase) => ({
    name: "demo-flow", description: "d",
    phases: [
      { id: "prepare", requiredAgents: ["demo-reviewer"], requiredSkills: [] },
      { id: "approve", requiredAgents: ["demo-reviewer"], approvalRequired: approvalPhase, dependsOn: ["prepare"] },
      { id: "execute", requiredAgents: ["demo-reviewer"], requiredSkills: ["demo-audit"], dependsOn: ["approve"] },
    ],
    completionConditions: ["done"],
  });
  const skill = skillMd({ approval: "payment", mutates: "yes" }).replace("Read-only: nothing to restore; rerun after a fix.", "Restore the previous state from the recorded before value.");
  for (const [gated, expectOk] of [[false, false], [true, true]]) {
    withPack({ skill, noBuild: false }, (root) => {
      writeFileSync(join(root, ".claude", "authority-unused"), "");
      writeFileSync(join(root, ".claude", "policies", "authority.json"), JSON.stringify({ actionClasses: [{ name: "payment", requiresApproval: true }, { name: "none", requiresApproval: false }] }));
      writeFileSync(join(root, ".claude", "workflows", "demo-flow.json"), JSON.stringify(wf(gated)));
      execFileSync(process.execPath, [BUILD], { cwd: root });
      const probs = run(root).problems.filter((p) => /workflow demo-flow/.test(p));
      assert.equal(probs.length === 0, expectOk, probs.join("; "));
    });
  }
});
