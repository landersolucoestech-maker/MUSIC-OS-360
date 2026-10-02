// Regression test for route-task.mjs: intent classification (explicit, keyword, tie, none), high-impact
// approval signals, capability resolution to a legal executor (tool ceiling and write scope), the
// CAPABILITY_UNAVAILABLE path, contract validity of every emitted routing decision, and the global
// guarantee that every intent of the real routing table resolves to registered executors.
// Run via: node --test .claude/runtime/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { routeTask, classifyIntent, approvalSignals } from "../route-task.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(__dirname, "..", "..", "..");

function makeRoot(registry, routing) {
  const root = mkdtempSync(join(tmpdir(), "eos-route-"));
  mkdirSync(join(root, ".claude", "registry"), { recursive: true });
  cpSync(join(REAL_ROOT, ".claude", "contracts"), join(root, ".claude", "contracts"), { recursive: true });
  writeFileSync(join(root, ".claude", "registry", "pack-registry.json"), JSON.stringify(registry));
  writeFileSync(join(root, ".claude", "registry", "routing.json"), JSON.stringify(routing));
  return root;
}

const registry = {
  agents: [
    { name: "backend-writer", domain: "backend", tools: ["Read", "Edit", "Write", "Grep", "Glob", "Bash"], skills: ["create-service", "run-unit-tests"], approval: "none" },
    { name: "generic-reviewer", domain: "review", tools: ["Read", "Grep", "Glob", "Bash"], skills: ["code-review"], approval: "none" },
    { name: "payer", domain: "finance", tools: ["Read", "Grep", "Glob", "Bash"], skills: ["code-review"], approval: "payment" },
  ],
  skills: [],
  capabilities: [
    { id: "backend.change", executors: ["generic-reviewer", "backend-writer"], skills: ["create-service", "run-unit-tests", "code-review"], validation: ["unit tests"], evidence: ["test output"], approval: "none" },
    { id: "finance.pay", executors: ["payer"], skills: ["code-review"], validation: ["review"], evidence: ["record"], approval: "payment" },
    { id: "ghost.nothing", executors: [], skills: [], validation: ["x"], evidence: ["y"], approval: "none" },
  ],
};
const routing = {
  intents: [
    { intent: "change-backend", domain: "backend", keywords: ["backend change", "service layer"], capabilities: ["backend.change"] },
    { intent: "review-things", domain: "review", keywords: ["service layer"], capabilities: ["backend.change"] },
    { intent: "pay-someone", domain: "finance", keywords: ["pay vendor"], capabilities: ["finance.pay"] },
    { intent: "needs-ghost", domain: "backend", keywords: ["ghost run"], capabilities: ["backend.change", "ghost.nothing"] },
  ],
  highImpactSignals: [{ class: "payment", patterns: ["pay", "payout"] }, { class: "deletion", patterns: ["delete"] }],
};
const withRoot = (fn) => { const root = makeRoot(registry, routing); try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); } };

test("an explicit intent wins; an unknown explicit intent is reported", () => {
  assert.equal(classifyIntent("anything", routing, "pay-someone").intent.intent, "pay-someone");
  assert.equal(classifyIntent("anything", routing, "nope").status, "UNKNOWN_INTENT");
});

test("keyword classification picks the best match, ties and no match ask for classification instead of guessing", () => {
  assert.equal(classifyIntent("please do a backend change today", routing).intent.intent, "change-backend");
  const tie = classifyIntent("touch the service layer", routing);
  assert.equal(tie.status, "NEEDS_CLASSIFICATION");
  assert.deepEqual(tie.candidates.sort(), ["change-backend", "review-things"]);
  assert.equal(classifyIntent("completely unrelated words", routing).status, "NEEDS_CLASSIFICATION");
});

test("the primary executor is the agent of the intent domain; the others are fallbacks", () => {
  withRoot((root) => {
    const r = routeTask({ task: "backend change", root });
    assert.equal(r.status, "OK");
    assert.equal(r.routes[0].agent, "backend-writer");
    assert.deepEqual(r.routes[0].fallbackAgents, ["generic-reviewer"]);
    assert.deepEqual(r.routes[0].skills, ["create-service", "run-unit-tests"]);
    assert.deepEqual(r.routes[0].tools, ["Read", "Edit", "Write", "Grep", "Glob", "Bash"]);
  });
});

test("a high-impact signal in the text, or an approving capability, requires approval of that class", () => {
  withRoot((root) => {
    const byText = routeTask({ task: "backend change and delete the old rows", root });
    assert.equal(byText.status, "NEEDS_APPROVAL");
    assert.equal(byText.routes[0].approvalRequired, true);
    assert.equal(byText.routes[0].approvalClass, "deletion");
    const byCapability = routeTask({ task: "pay vendor", root });
    assert.equal(byCapability.status, "NEEDS_APPROVAL");
    assert.equal(byCapability.routes[0].approvalClass, "payment");
    assert.deepEqual(approvalSignals("no signal here", routing), []);
    assert.equal(routeTask({ task: "backend change", root }).routes[0].approvalRequired, false);
  });
});

test("a capability without an executor makes the whole route CAPABILITY_UNAVAILABLE and names it", () => {
  withRoot((root) => {
    const r = routeTask({ task: "ghost run", root });
    assert.equal(r.status, "CAPABILITY_UNAVAILABLE");
    assert.deepEqual(r.unavailable.map((u) => u.capability), ["ghost.nothing"]);
    assert.equal(r.routes.length, 1);
  });
});

test("every intent of the real routing table resolves, with a legal executor, tool ceiling and a valid decision", () => {
  const real = JSON.parse(readFileSync(join(REAL_ROOT, ".claude", "registry", "routing.json"), "utf8"));
  const caps = JSON.parse(readFileSync(join(REAL_ROOT, ".claude", "policies", "capabilities.json"), "utf8"));
  const ceilings = new Map(caps.roles.map((r) => [r.agent, r.allowedTools]));
  for (const i of real.intents) {
    const r = routeTask({ task: i.description, intent: i.intent, root: REAL_ROOT });
    assert.notEqual(r.status, "CAPABILITY_UNAVAILABLE", `${i.intent}: ${JSON.stringify(r.unavailable)}`);
    assert.equal(r.routes.length, i.capabilities.length, i.intent);
    for (const route of r.routes) {
      for (const t of route.tools) assert.ok((ceilings.get(route.agent) || []).includes(t), `${route.agent} tool ${t} above its ceiling`);
      assert.ok(route.validation.length > 0 && route.evidence.length > 0, `${route.capability} lacks validation or evidence`);
    }
  }
});
