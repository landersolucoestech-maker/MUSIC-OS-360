---
name: test-generator
description: Generates concrete test cases/skeletons for a given function or component from test-strategy-engineer's coverage plan — the code-generation step, distinct from test-strategy-engineer (decides what needs covering) and qa-engineer (owns writing/running the final, polished tests). Use to quickly scaffold the cases a plan calls for before qa-engineer refines them.
---

# Test Generator

1. Take `test-strategy-engineer`'s plan (which test types, which negative cases) as input.
2. For each named case, generate a concrete test skeleton with a real assertion shape (not a
   placeholder `expect(true).toBe(true)`) — see `references/examples.md` for the pattern this pack
   expects: one behavior per test, a descriptive name stating the behavior and the input class.
3. Include the negative/edge cases the plan called for explicitly (empty input, boundary value,
   unauthorized actor) — do not generate only happy-path cases and call it done.
4. Hand the generated skeletons to `test-engineer` to fill in real fixtures/mocks and confirm they
   actually run and fail correctly against a reverted version of the fix (a test that can't fail is
   not a test).

## Non-goals
Generated skeletons are a draft, not final evidence — `test-engineer`'s executed run via `node
.claude/runtime/ops.mjs evidence run` is what actually closes a criterion, not this skill's output
by itself.
