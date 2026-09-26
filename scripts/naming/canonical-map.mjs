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

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../..");
export const AUTHORITY = path.join(ROOT, "docs/naming/canonical-naming-map.json");

export function loadAuthority(file = AUTHORITY) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

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
  }
  const renameIds = new Set();
  for (const r of map.renames ?? []) {
    for (const f of ["id", "oldName", "newName", "type", "paths", "compatibility", "tests", "commit"]) if (r[f] == null || r[f] === "") p.push(`rename ${r.id ?? r.oldName}: missing ${f}`);
    if (renameIds.has(r.id)) p.push(`duplicate rename id ${r.id}`);
    renameIds.add(r.id);
  }
  for (const e of map.exceptions ?? []) {
    const label = e.item ?? e.currentName;
    if (!v.exceptionClass?.includes(e.exceptionClass)) p.push(`exception ${label}: invalid class '${e.exceptionClass}'`);
    for (const f of ["currentName", "layer", "reason", "removalCondition", "status"]) if (!e[f]) p.push(`exception ${label}: missing ${f}`);
    if (e.exceptionClass === "TEMPORARY_MIGRATION_COMPATIBILITY" && (!e.owner || !e.targetState || !e.removalCondition || /never|none|permanent/i.test(e.removalCondition))) {
      p.push(`exception ${label}: TEMPORARY_MIGRATION_COMPATIBILITY needs owner, targetState and a real removal condition (it must not become permanent)`);
    }
  }
  for (const b of map.blockers ?? []) for (const f of ["id", "item", "blocker", "evidence", "requiredAction"]) if (!b[f]) p.push(`blocker ${b.id ?? b.item}: missing ${f}`);
  if ((map.glossary ?? []).length < 25) p.push(`glossary has ${(map.glossary ?? []).length} terms; the naming standard requires at least 25`);
  for (const g of map.glossary ?? []) {
    for (const f of ["term", "definition", "idNamespace"]) if (!g[f]) p.push(`glossary ${g.term}: missing ${f}`);
    if (!Array.isArray(g.disallowedUsages) || !g.disallowedUsages.length) p.push(`glossary ${g.term}: missing disallowedUsages`);
    if (!Array.isArray(g.relatedTerms)) p.push(`glossary ${g.term}: missing relatedTerms`);
  }
  return p;
}

/** Index of exceptions by exact technical name, used by the guard as the ONLY suppression list. */
export function exceptionIndex(map) {
  const idx = new Map();
  for (const e of map.exceptions ?? []) if (e.status !== "REMOVED") idx.set(e.currentName, e);
  return idx;
}
