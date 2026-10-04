import test from "node:test";
import assert from "node:assert/strict";
import { wiringSites, unprovenSites, siteKey, moduleDirOf, HELPERS } from "./compat-wiring-proof.mjs";

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
