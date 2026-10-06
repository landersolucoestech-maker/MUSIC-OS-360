---
name: bootstrap
description: First-run setup after installing this pack into a target project — verifies the install is healthy, discovers the real stack, and initializes mission state. The "getting started" entry point; run this once per newly-installed project before invoking systemic-audit or any other workflow.
---

# Bootstrap

1. `node .claude/runtime/doctor.mjs` — confirm Node/git are available and every required pack path
   actually landed (a broken/partial install fails here with a specific missing-path list, not a
   confusing downstream error).
2. Delegate first-run discovery to `repository-orchestrator`, which coordinates `repo-inspector` and the relevant repository mappers; discovery populates `.claude/project-manifest.json`
   and any per-project stack rule files (`backend.md`, `database.md`, etc. under `.claude/rules/`).
3. `node .claude/runtime/ops.mjs init --mission "<first mission name>"` only once discovery is
   done — an empty/default mission started before discovery has no grounding.
4. `node .claude/runtime/self-test.mjs` (or `npm run self-test` if the target project's own
   package.json doesn't conflict) to confirm the installed pack's own runtime works in this
   environment before relying on it for a real mission.
