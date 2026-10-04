import test from "node:test";
import assert from "node:assert/strict";
import { wiringSites, unprovenSites, siteKey, moduleDirOf, HELPERS, classifyWiring, isUnwiredDraft, staleExemptions, validExemption } from "./compat-wiring-proof.mjs";

const SERVICE = `import { applyDeprecatedFieldAliases } from "../x";
export class S {
  create(dto) {
    const data = applyDeprecatedFieldAliases(dto, TABLE);
    return this.repo.save(data);
  }
  update(dto) { return this.repo.save(applyDeprecatedFieldAliases(dto, OTHER)); }
}`;

test("wiring sites: every production call of a covered helper is found with its first argument; the definition and specs are skipped", () => {
  const files = new Map([
    ["apps/api/src/modules/m/m.service.ts", SERVICE],
    ["apps/api/src/common/helper.ts", "export function applyDeprecatedFieldAliases(a, t) { return a; }\nconst x = applyDeprecatedFieldAliases(1, 2);"],
    ["apps/api/src/modules/m/m.service.spec.ts", "applyDeprecatedFieldAliases(dto, TABLE);"],
    ["apps/api/src/modules/m/other.ts", "const unrelated = other(dto);"],
  ]);
  const sites = wiringSites(files);
  assert.deepEqual(sites.map((s) => [s.file, s.line, s.first]), [["apps/api/src/modules/m/m.service.ts", 4, "dto"], ["apps/api/src/modules/m/m.service.ts", 7, "dto"]]);
  assert.ok(HELPERS.has("applyDeprecatedFieldAliases"));
  // the mutation is a pure text replacement of the call by its first argument
  const s = sites[0];
  assert.ok((SERVICE.slice(0, s.start) + s.first + SERVICE.slice(s.end)).includes("const data = dto;"));
});

test("moduleDirOf: the module directory owns the specs that must notice the wiring", () => {
  assert.equal(moduleDirOf("apps/api/src/modules/hr/hr.service.ts"), "apps/api/src/modules/hr");
  assert.equal(moduleDirOf("apps/api/src/modules/audiovisual/projects/projects.service.ts"), "apps/api/src/modules/audiovisual");
  assert.equal(moduleDirOf("apps/api/src/core/rbac/rbac.service.ts"), "apps/api/src/core/rbac");
  assert.equal(moduleDirOf("apps/api/src/common/compat/x.ts"), "apps/api/src/common/compat");
});

test("gate: a site is proven only by a KILLED record fresh for the file and for the module specs", () => {
  const site = { file: "apps/api/src/modules/m/m.service.ts", line: 4, text: "applyDeprecatedFieldAliases(dto, TABLE)" };
  const rec = (over = {}) => ({ ...site, fileSha256: "F", testsSha256: "T", verdict: "KILLED", ...over });
  const run = (records, fileSha = "F", specs = "T") => unprovenSites([site], records, () => fileSha, () => specs).length;
  assert.equal(run([rec()]), 0);
  assert.equal(run([]), 1, "no record");
  assert.equal(run([rec({ verdict: "SURVIVED" })]), 1, "a surviving bypass: the wiring is not needed by any test");
  assert.equal(run([rec({ verdict: "INCONCLUSIVE" })]), 1, "a compile or load error is not a kill");
  assert.equal(run([rec({ verdict: "BASELINE_RED" })]), 1);
  assert.equal(run([rec()], "F2"), 1, "an edited file makes the record stale");
  assert.equal(run([rec()], "F", "T2"), 1, "an edited spec of the module makes the record stale");
  assert.equal(siteKey(site), `${site.file}\u0000${site.line}\u0000${site.text}`);
});

test("consumer sites: a call of a function imported from a credited file (relative, @/ alias, barrel re-export, namespace) is a site; type-only imports, specs and uncredited files are not", () => {
  const files = new Map([
    ["apps/web/src/modules/m/lib/vocab.ts", "export const canon = (x) => x; export const other = (x) => x;"],
    ["apps/web/src/modules/m/lib/index.ts", "export * from './vocab';"],
    ["apps/web/src/modules/m/a.tsx", "import { canon } from './lib/vocab';\nexport const A = () => canon(raw);"],
    ["apps/web/src/modules/m/b.tsx", "import { canon as c } from '@/modules/m/lib';\nexport const B = () => c(raw, 2);"],
    ["apps/web/src/modules/m/c.tsx", "import * as v from './lib/vocab';\nexport const C = () => v.other(raw);"],
    ["apps/web/src/modules/m/d.tsx", "import type { canon } from './lib/vocab';\nexport const D = () => canon(raw);"],
    ["apps/web/src/modules/m/e.tsx", "import { thing } from './uncredited';\nexport const E = () => thing(raw);"],
    ["apps/web/src/modules/m/uncredited.ts", "export const thing = (x) => x;"],
    ["apps/web/src/modules/m/a.test.tsx", "import { canon } from './lib/vocab'; canon(raw);"],
    ["apps/web/src/App.tsx", "import { legacyRoutes } from './modules/m/lib/vocab';\nexport const X = () => <>{legacyRoutes()}</>;"],
  ]);
  const credited = new Set(["apps/web/src/modules/m/lib/vocab.ts"]);
  const sites = wiringSites(files, credited).filter((s) => s.kind === "CONSUMER");
  assert.deepEqual(sites.map((s) => [s.file, s.first]).sort(), [
    ["apps/web/src/App.tsx", "undefined"],
    ["apps/web/src/modules/m/a.tsx", "raw"],
    ["apps/web/src/modules/m/b.tsx", "raw"],
    ["apps/web/src/modules/m/c.tsx", "raw"],
  ]);
  assert.ok(sites.every((s) => s.target === "apps/web/src/modules/m/lib/vocab.ts"));
  // no credited files: only helper sites are searched
  assert.deepEqual(wiringSites(files).filter((s) => s.kind === "CONSUMER"), []);
});

test("moduleDirOf covers web modules, shared, app and the root files that are mounted by the whole application", () => {
  assert.equal(moduleDirOf("apps/web/src/modules/contracts/lib/x.ts"), "apps/web/src/modules/contracts");
  assert.equal(moduleDirOf("apps/web/src/shared/hooks/useHasRole.ts"), "apps/web/src/shared/hooks");
  assert.equal(moduleDirOf("apps/web/src/app/providers/TenantContext.tsx"), "apps/web/src/app/providers");
  assert.equal(moduleDirOf("apps/web/src/App.tsx"), "apps/web/src");
});

test("classifyWiring: a failing test in a suite that loaded is a kill (a thrown error counts); load, compile and resolve errors are inconclusive; green is a survivor", () => {
  assert.equal(classifyWiring(0, "Tests: 5 passed"), "pass");
  assert.equal(classifyWiring(1, "Tests:       2 failed, 3 passed, 5 total\nTypeError: Cannot read properties of undefined"), "assertion-failure");
  assert.equal(classifyWiring(1, " Tests  1 failed | 4 passed (5)"), "assertion-failure");
  assert.equal(classifyWiring(1, "Test suite failed to run\n  Cannot find module './x'"), "inconclusive");
  assert.equal(classifyWiring(1, "SyntaxError: Unexpected token"), "inconclusive");
  assert.equal(classifyWiring(1, "error TS2322: Type"), "inconclusive");
  assert.equal(classifyWiring(1, "nothing recognizable"), "inconclusive");
});

test("gated draft migrations are not production consumers; migrations and seeds are judged by the specs beside them", () => {
  assert.equal(isUnwiredDraft("apps/api/src/database/migration-drafts/2026_X.ts"), true);
  assert.equal(isUnwiredDraft("apps/api/src/database/migrations/2026_X.ts"), false);
  assert.equal(moduleDirOf("apps/api/src/database/migrations/2026_X.ts"), "apps/api/src/database");
  assert.equal(moduleDirOf("apps/api/src/database/seeds/index.ts"), "apps/api/src/database");
  const files = new Map([["apps/api/src/database/migration-drafts/d.ts", "import { f } from '../../modules/m/vocab';\nf(x);"], ["apps/api/src/modules/m/vocab.ts", "export const f = (x) => x;"]]);
  assert.deepEqual(wiringSites(files, new Set(["apps/api/src/modules/m/vocab.ts"])), []);
});

test("exemptions: an equivalent mutant needs file, exact text and a substantive reason; one that matches no site any more is stale", () => {
  const site = { file: "apps/api/src/m/v.ts", line: 3, text: "canon(x)" };
  const run = (ex) => unprovenSites([site], [], () => "F", () => "T", ex).length;
  const good = { file: site.file, text: site.text, reason: "second canonicalization after a preprocess step: the value is already canonical for every reachable input" };
  assert.equal(run([good]), 0);
  assert.equal(run([{ ...good, reason: "too short" }]), 1, "a short reason does not exempt");
  assert.equal(run([{ ...good, text: "other(x)" }]), 1, "the exact call text must match");
  assert.equal(run([{ ...good, file: "apps/api/src/m/w.ts" }]), 1);
  assert.deepEqual(staleExemptions([site], [good]), []);
  assert.equal(staleExemptions([], [good]).length, 1);
  assert.equal(staleExemptions([site], [{ ...good, reason: "x" }]).length, 1, "an invalid exemption is reported");
  assert.equal(validExemption(good), true);
});
