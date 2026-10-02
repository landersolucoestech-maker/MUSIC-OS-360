# Documentation lives at the repository root `docs/`, not here

This directory exists so the path `.claude/docs/` resolves to something real rather than a
404/missing-directory surprise, but it deliberately does **not** duplicate content — one concept,
one location, per `.claude/rules/naming-canonical.md`'s "one data field, one source of truth"
principle applied to documentation itself.

The pack's actual documentation — architecture, operations, the naming-normalization doc trio, and
the full mission specification — lives at the repository root: `../../docs/` relative to this file
(i.e. `docs/` at the repo root, alongside `README.md` and `CLAUDE.md`).

If a future need genuinely requires pack-internal documentation that shouldn't live at the product
root (rare — most projects want one `docs/` location), add it here explicitly and update this file
to explain why it's split, rather than letting content silently drift into two places.

## Pack maps

`.claude/docs/pack/` holds the maps generated from the pack registries (agents, skills, capabilities, routing, workflows, ownership, contracts, policies, gates). They live here, with the pack, because they list every pack item by name; the hand-written concept documents are in `docs/engineering/pack/`. Regenerate with `node .claude/runtime/build-pack-docs.mjs`.
