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

test("the committed dossier states the facts the independent review corrected", () => {
  const text = fs.readFileSync("docs/engineering/destructive-approval-dossier.md", "utf8");
  const block = (name) => text.split(/^## /m).find((b) => b.startsWith(name)) ?? "";
  assert.match(block("package 53"), /ARCHIVE_PLAN: employees_pii_legacy_archive_20260930/);
  assert.match(block("package 46"), /ARCHIVE_PLAN: NO archive table/);
  assert.match(block("package 48"), /ARCHIVE_PLAN: NO archive/);
  assert.match(block("package 49"), /DEPENDENCIES: package 48 applied first/);
  assert.match(block("package 53"), /DIVERGENCES: NO machine check/);
  for (const n of ["PII backfill", "PII scrub"]) { assert.match(block(n), /LOCK_ESTIMATE: no table lock/); assert.doesNotMatch(block(n), /SHARE ROW EXCLUSIVE on artists/); }
  assert.doesNotMatch(block("package 48"), /EXTERNAL_REQUIREMENT: release B0 \(entity\/reader\/writer removal\) and release A deployed and green/);
  assert.match(block("package 48"), /LOCK_ESTIMATE: up\(\): SET LOCAL lock_timeout 15s, then LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE first[\s\S]*ALTER COLUMN legacy_amount DROP NOT NULL/);
  assert.doesNotMatch(block("package 48"), /ACCESS EXCLUSIVE at the final DROP/);
  assert.doesNotMatch(block("package 46"), /ACCESS EXCLUSIVE at the final DROP/);
  assert.match(text, /BACKFILL_PURGE_CONFIRM[\s\S]*LEGACY_ARCHIVE_RETIRE_CONFIRM/);
  assert.match(text, /re-timestamped AFTER 20261002000002 and 20261002000003/);
});

test("the committed dossier covers the 11 required packages and passes", () => {
  const text = fs.readFileSync("docs/engineering/destructive-approval-dossier.md", "utf8");
  const r = checkDossier(text);
  assert.deepEqual(r.problems, []);
  for (const id of ["package 40 ", "package 41 ", "package 42 ", "package 43 ", "package 44 ", "package 45 ", "package 46 ", "package 49 ", "package 53 ", "PII backfill", "PII scrub"]) assert.ok(text.includes(`## ${id}`) || text.includes(`PACKAGE: ${id}`), id);
  assert.ok(!/READY: YES/.test(text));
});
