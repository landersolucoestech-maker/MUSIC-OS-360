import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkDossier, render, MIN_FIELDS } from "./destructive-dossier.mjs";

const pkg = (over = {}) => ({ id: "40", short: "package 40 works", migration: "m", destructive: true, tables: ["works"], columns: "works.{a}", disposableCensus: "works=0/0", divergences: "ZERO", archive: "a", restore: "r", rehearsal: "disposable COPY PASS", pii: false, missing: [], ...over });

test("a rendered package carries every mandatory field, READY: NO and typed missing items", () => {
  const md = render([pkg()], { sizes: { works: 8192 }, generatedFrom: "test" });
  const r = checkDossier(md);
  assert.equal(r.blocks, 1);
  assert.deepEqual(r.problems, []);
  for (const f of MIN_FIELDS) assert.match(md, new RegExp(`^${f}:`, "m"));
  assert.match(md, /EXTERNAL_REQUIREMENT/);
  assert.match(md, /HUMAN_APPROVAL/);
});

test("the checker rejects READY: YES, a missing field and an untyped missing item", () => {
  const md = render([pkg()], { sizes: null, generatedFrom: "t" });
  assert.ok(checkDossier(md.replace(/^READY: NO$/m, "READY: YES")).problems.some((p) => /READY/.test(p)));
  assert.ok(checkDossier(md.replace(/^LOCK_ESTIMATE:.*$/m, "")).problems.some((p) => /LOCK_ESTIMATE/.test(p)));
  assert.ok(checkDossier(md.replace("- HUMAN_APPROVAL:", "- SOMETHING:")).problems.some((p) => /untyped/.test(p)));
});

test("PII packages mark key custody as a human decision and other packages as not applicable", () => {
  const pii = render([pkg({ id: "PII-SCRUB", short: "PII scrub", pii: true })], { sizes: null, generatedFrom: "t" });
  assert.match(pii, /KEY_CUSTODY: HUMAN_DECISION/);
  assert.match(render([pkg()], { sizes: null, generatedFrom: "t" }), /KEY_CUSTODY: NOT_APPLICABLE/);
});

test("the committed dossier covers the 11 required packages and passes", () => {
  const text = fs.readFileSync("docs/engineering/destructive-approval-dossier.md", "utf8");
  const r = checkDossier(text);
  assert.deepEqual(r.problems, []);
  for (const id of ["package 40 ", "package 41 ", "package 42 ", "package 43 ", "package 44 ", "package 45 ", "package 46 ", "package 49 ", "package 53 ", "PII backfill", "PII scrub"]) assert.ok(text.includes(`## ${id}`) || text.includes(`PACKAGE: ${id}`), id);
  assert.ok(!/READY: YES/.test(text));
});
