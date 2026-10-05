/**
 * scripts/naming/canonical-map.mjs — loads and structurally validates the
 * single naming authority, docs/naming/canonical-naming-map.json.
 *
 * Everything else (the markdown map, the status document, the guard's
 * exception allowlist, the coverage summary) is derived from this file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ptWords } from "./pt-lexicon.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../..");
export const AUTHORITY = path.join(ROOT, "docs/naming/canonical-naming-map.json");

export function loadAuthority(file = AUTHORITY) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Concept dispositions that need no owner: the concept is finished. */
export const CLOSED_CONCEPT_DISPOSITIONS = new Set(["DONE", "RESOLVED"]);
/** Every blocker row must say who owns it, why it is blocked (disposition) and whether it is still open. */
export const BLOCKER_REQUIRED_FIELDS = ["id", "item", "blocker", "evidence", "requiredAction", "owner", "disposition", "status"];

/** Structural validation. Returns a list of problems (empty = valid). */
export function validateStructure(map) {
  const p = [];
  const v = map.statusVocabulary ?? {};
  const ids = new Set();
  for (const c of map.concepts ?? []) {
    if (!c.id) p.push(`concept without id: ${c.concept}`);
    if (ids.has(c.id)) p.push(`duplicate concept id ${c.id}`);
    ids.add(c.id);
    if (!c.concept) p.push(`${c.id}: missing concept`);
    if (!v.status?.includes(c.status)) p.push(`${c.id}: status '${c.status}' not in ${v.status}`);
    if (!v.disposition?.includes(c.disposition)) p.push(`${c.id}: disposition '${c.disposition}' not in vocabulary`);
    if (c.databaseClass && !v.databaseClass?.includes(c.databaseClass)) p.push(`${c.id}: databaseClass '${c.databaseClass}' invalid`);
    if (c.disposition === "BUG" && c.status === "done") p.push(`${c.id}: disposition BUG contradicts status done (a fixed bug is RESOLVED)`);
    // an unfinished concept (anything but DONE/RESOLVED) must have somebody accountable for finishing it
    if (!CLOSED_CONCEPT_DISPOSITIONS.has(c.disposition) && !c.owner) p.push(`${c.id}: open concept (disposition ${c.disposition}) needs an owner`);
  }
  const renameIds = new Set();
  for (const r of map.renames ?? []) {
    for (const f of ["id", "oldName", "newName", "type", "paths", "compatibility", "tests", "commit"]) if (r[f] == null || r[f] === "") p.push(`rename ${r.id ?? r.oldName}: missing ${f}`);
    if (renameIds.has(r.id)) p.push(`duplicate rename id ${r.id}`);
    renameIds.add(r.id);
  }
  const exceptionIds = new Set();
  for (const e of map.exceptions ?? []) {
    const label = e.item ?? e.currentName;
    if (e.id != null) {
      if (exceptionIds.has(e.id)) p.push(`exception ${label}: duplicate exception id ${e.id}`);
      exceptionIds.add(e.id);
    }
    if (!v.exceptionClass?.includes(e.exceptionClass)) p.push(`exception ${label}: invalid class '${e.exceptionClass}'`);
    for (const f of ["currentName", "path", "layer", "reason", "removalCondition", "status"]) if (!e[f]) p.push(`exception ${label}: missing ${f}`);
    // A whole-file exception names exact files only: no glob, no "*"; a comma-separated list is allowed
    // (one grouped row for a family of frozen documents) when every entry is an existing repo path.
    if (e.census != null && (e.census !== "baselined" || e.surface !== "doc" || e.currentName !== "*")) {
      p.push(`exception ${label}: census '${e.census}' is only valid as "baselined" on a whole-document (surface doc, currentName "*") row`);
    }
    if (e.currentName === "*") {
      const parts = String(e.path ?? "").split(/\s*,\s*/).filter(Boolean);
      if (!e.path || e.path === "*" || /\*/.test(e.path) || !e.surface || !parts.length) {
        p.push(`exception ${label}: a whole-file exception (currentName "*") needs one exact path and a surface`);
      } else {
        for (const part of parts) if (!fs.existsSync(path.join(ROOT, part))) p.push(`exception ${label}: whole-file path '${part}' does not exist`);
      }
    }
    if (e.surface && !["apiRoute", "comment", "dbColumn", "dataFile", "toolMessage", "directory", "doc", "docCode", "envVar", "eventQueueJob", "filename", "frontendRoute", "identifier", "objectKey", "sqlString", "testTitle", "value", "schema"].includes(e.surface)) {
      p.push(`exception ${label}: unknown surface '${e.surface}'`);
    }
    if (e.coveringTest != null && (typeof e.coveringTest !== "string" || !e.coveringTest || !fs.existsSync(path.join(ROOT, e.coveringTest)))) {
      p.push(`exception ${label}: coveringTest '${e.coveringTest}' is not an existing repo path`);
    }
    if (e.exceptionClass === "TEMPORARY_MIGRATION_COMPATIBILITY" && (!e.owner || !e.targetState || !e.removalCondition || /never|none|permanent/i.test(e.removalCondition))) {
      p.push(`exception ${label}: TEMPORARY_MIGRATION_COMPATIBILITY needs owner, targetState and a real removal condition (it must not become permanent)`);
    }
  }
  const blockerIds = new Set();
  for (const b of map.blockers ?? []) {
    for (const f of BLOCKER_REQUIRED_FIELDS) if (!b[f]) p.push(`blocker ${b.id ?? b.item}: missing ${f}`);
    if (b.id) {
      if (blockerIds.has(b.id)) p.push(`duplicate blocker id ${b.id}`);
      blockerIds.add(b.id);
    }
    if (b.disposition && !v.blockerDisposition?.includes(b.disposition)) p.push(`blocker ${b.id}: disposition '${b.disposition}' not in blockerDisposition vocabulary`);
    if (b.status && !v.blockerStatus?.includes(b.status)) p.push(`blocker ${b.id}: status '${b.status}' not in blockerStatus vocabulary`);
  }
  if ((map.glossary ?? []).length < 25) p.push(`glossary has ${(map.glossary ?? []).length} terms; the naming standard requires at least 25`);
  for (const g of map.glossary ?? []) {
    for (const f of ["term", "definition", "idNamespace"]) if (!g[f]) p.push(`glossary ${g.term}: missing ${f}`);
    if (!Array.isArray(g.disallowedUsages) || !g.disallowedUsages.length) p.push(`glossary ${g.term}: missing disallowedUsages`);
    if (!Array.isArray(g.relatedTerms)) p.push(`glossary ${g.term}: missing relatedTerms`);
  }
  return p;
}

/**
 * Non-failing quality report: ACTIVE TEMPORARY_MIGRATION_COMPATIBILITY rows that name no
 * `coveringTest` (optional field: repo-relative path of the test that proves the alias
 * still works, so its removal is machine-checkable). Returns the rows without one.
 */
export function rowsWithoutCoveringTest(map) {
  return (map.exceptions ?? []).filter((e) => e.status === "ACTIVE" && e.exceptionClass === "TEMPORARY_MIGRATION_COMPATIBILITY" && !e.coveringTest);
}

/**
 * Ratchet for the quality debt reported by rowsWithoutCoveringTest: the number of ACTIVE
 * TEMPORARY_MIGRATION_COMPATIBILITY rows without a coveringTest may only go down.
 * `baseline` is the parsed scripts/naming/covering-test-baseline.json.
 * Returns { count, baseline, grew, shrunk }; `grew` is a failure, `shrunk` a hint to lower the baseline.
 */
export function coveringTestRatchet(map, baseline) {
  const allowed = baseline?.untestedTemporaryRows;
  if (!Number.isInteger(allowed) || allowed < 0) throw new Error("covering-test baseline has no valid untestedTemporaryRows integer");
  const count = rowsWithoutCoveringTest(map).length;
  return { count, baseline: allowed, grew: count > allowed, shrunk: count < allowed };
}

/**
 * Exception lookup used by the guard as the ONLY suppression list (rows with `census: "baselined"` are records of baselined debt and are skipped). An exception
 * applies to one exact name in one exact file (`path`), or to every file only
 * when `path` is "*" (reserved for legal-domain terms such as cpf/cnpj). An optional
 * `surface` limits it to one census surface. `currentName: "*"` exempts every name of
 * one surface in one exact file (a localization resource, a provider payload fixture);
 * validateStructure() rejects it without an exact path and a surface.
 */
export function exceptionIndex(map) {
  const idx = new Map();
  for (const e of map.exceptions ?? []) {
    if (e.status === "REMOVED" || e.census === "baselined") continue; // a baselined row documents ratchet debt; it never suppresses
    const paths = e.path === "*" ? ["*"] : String(e.path).split(/\s*,\s*/);
    for (const p of paths) {
      const k = `${p}::${e.currentName}`;
      idx.set(k, [...(idx.get(k) ?? []), e]);
    }
  }
  const pick = (k, surface) => (idx.get(k) ?? []).find((e) => !e.surface || !surface || e.surface === surface);
  // Single-word legal-domain terms registered for every file ("*") are exempt as WORDS: a name whose
  // only Portuguese words are such terms (tomador_email, NfeConfigDialog, cpfCnpj) is covered.
  const legalWords = new Map((map.exceptions ?? []).filter((e) => e.status !== "REMOVED" && e.path === "*" && /^[a-z]+$/.test(e.currentName))
    .map((e) => [e.currentName, e]));
  const byWords = (name) => {
    if (!legalWords.size || !name) return undefined;
    const words = ptWords(name);
    return words.length && words.every((w) => legalWords.has(w)) ? legalWords.get(words[0]) : undefined;
  };
  /** Every legal-term row that a name is covered by through its words (all of them, not only the first). */
  const wordRows = (name) => (name && legalWords.size && ptWords(name).length && ptWords(name).every((w) => legalWords.has(w)) ? [...new Set(ptWords(name).map((w) => legalWords.get(w)))] : []);
  return {
    wordRows,
    /**
     * Every ACTIVE row that must suppress at least one occurrence: the census reports the ones that suppressed nothing (stale rows).
     * Not candidates: `census: "baselined"` records (they never suppress) and `EXM-*` rows, which are the governance register of a
     * census-internal exemption table (the technical-naming-census test proves each EXM row matches exactly one declared table).
     */
    rows: (map.exceptions ?? []).filter((e) => e.status !== "REMOVED" && e.census !== "baselined" && !String(e.id ?? "").startsWith("EXM-")),
    get: (file, name, surface) => pick(`${file}::${name}`, surface) ?? pick(`*::${name}`, surface)
      ?? (surface ? pick(`${file}::*`, surface) : undefined) ?? byWords(name),
  };
}
