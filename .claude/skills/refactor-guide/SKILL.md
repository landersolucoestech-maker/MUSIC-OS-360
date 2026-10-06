---
name: refactor-guide
description: Guides a behavior-preserving refactor safely — characterization tests first, small verified steps, no behavior change. Use whenever the ask is "clean this up" / "simplify this" rather than "change what it does" — the discipline that keeps a refactor from silently becoming a rewrite with regressions.
---

# Refactor Guide

1. If the code being refactored has no test covering its current behavior, write a characterization
   test FIRST (`test-engineer`/`test-generator`) that pins down what it does today — even if that
   behavior looks wrong, capture it before touching anything so any change is visible.
2. Refactor in the smallest steps that each keep the characterization test green — never a big-bang
   rewrite where "it works" can only be checked at the very end.
3. After each step: `node .claude/runtime/ops.mjs evidence run --cmd "<the characterization +
   existing test command>"`. A red test means stop and understand why before continuing, not push
   through.
4. See `references/anti-patterns.md` for refactor-specific failure modes and
   `references/examples.md` for the small-step pattern illustrated.

## Non-goals
Not for changing behavior — if the "refactor" actually needs to change what the code does, that's
`feature-planner`/`execute`, not this skill; don't let scope quietly drift from "same behavior,
better structure" to "different behavior."
