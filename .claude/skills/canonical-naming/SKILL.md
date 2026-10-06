---
name: canonical-naming
description: Establishes or updates docs/NAMING_NORMALIZATION_CANONICAL_MAP.md — the single registry mapping one concept to its database column, application identifier, API field, event/queue name, and humanized display label, plus legacy aliases. Use whenever a naming inconsistency or duplicate-source-of-truth finding needs a decision, before any rename touches code.
---

# Canonical Naming

Implements `.claude/rules/naming-canonical.md`. Schema:
`.claude/contracts/canonical-map-entry.schema.json`.

## Method

1. For the concept in question, collect every name currently in use for it across layers (grep the
   actual codebase — do not guess): database column(s), application field(s), API field(s),
   event/queue name(s), and however it's currently displayed to the user.
2. Determine which name is the strongest existing convention (most consumers, least legacy
   baggage) — prefer stabilizing on it over inventing a brand-new name, unless every existing
   option is actually wrong (e.g. misspelled, non-English internal identifier).
3. Write one row to `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md` (create the file with a table header if it doesn't
   exist) per the schema: concept, database, application, api, eventOrQueue, displayPtBr (or the
   project's real user-facing language), legacyAliases, status.
4. If two agents propose conflicting canonical names for the same concept, this is a conflict per
   `.claude/rules/agent-orchestration.md` — `music-os-360-orchestrator` decides, and the map is updated
   once, not twice.
5. Hand the map entry to `cross-layer-impact` to drive the actual rename across producers and
   consumers. Do not rename code directly from this skill.

## Non-goals

Do not delete a legacy alias from the map the moment you add the canonical entry — mark it in
`legacyAliases` and give it a migration/removal plan; the map should make the transition
traceable, not erase history mid-migration.
