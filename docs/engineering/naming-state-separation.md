# Naming state separation (five states, one measure each)

Technical language is not one mass of "legacy names". Five different states exist in this repository; each is measured by a different
gate, and nothing from one state is allowed to count as another. The single registry for all of them is
`docs/naming/canonical-naming-map.json` (rendered into `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md`).

| State | What it is | Where it lives | Gate (what fails) | Never counted as |
|---|---|---|---|---|
| CURRENT_OPERATIONAL_STATE | code, schema, config and API surfaces that run today | `apps/*`, `packages/*`, `scripts/*`, env templates, workflows | `naming:check` census: any Portuguese technical name without a ledger row fails; a ledger row that suppresses nothing (stale) fails; the debt ratchet only shrinks | historical text |
| HISTORICAL_RECORD | frozen documents kept as recorded (129 files: `docs/backend-v2/**`, `reports/**`, six root audits) | `docs/naming/historical-records.json` (sha256 + line count per file) | `historical-records-audit.mjs --check`: first-line label, frozen body, no executable consumer, no unlabelled citation from an active document | current contract |
| EVIDENCE | outputs of past audits and runs (`.audit-runtime`, `.claude/ops`, generated `docs/naming/audit/*`) | those folders | excluded from the census; generated files are checked against their generator (`render-naming-docs --check`) | product behavior |
| MIGRATION_HISTORY | published migrations (immutable) and guarded drafts | `apps/api/src/database/migrations`, `migration-drafts` | the census skips published migrations; drafts stay unregistered (draft specs) and every destructive package is `READY: NO` in `destructive-approval-dossier.md` | active schema |
| LEGITIMATE_COMPATIBILITY | deliberate aliases, legacy readers, provider-defined names, legal terms | ledger rows of classes `TEMPORARY_MIGRATION_COMPATIBILITY`, `LEGACY_DATABASE_COMPATIBILITY`, `EXTERNAL_CONTRACT`, `PROVIDER_DEFINED`, `PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION`, `UX_TEXT` | `compat-boundary-audit.mjs --check` (inside `naming:check`): semantic category per row, `OBSOLETE_BOUNDARIES`, `MISCLASSIFIED_OPERATIONAL_USAGE`, `LEGACY_FIRST_READS` and `COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF` must all be 0 | operational debt |

## How a compatibility boundary is proven (not asserted)

A row of the proof classes needs behavior evidence bound to the exact bytes of the runtime file, of its covering test and of the test-runner
configuration (`jest.config.ts`/`tsconfig.json` for the API, `vitest.config.mjs`/`src/test/setup.ts` for the web):

1. `compat-mutation-proof.mjs` mutates the runtime file one defect at a time on a sandbox copy (never the working tree): a legacy name is
   renamed (`LEGACY_LITERAL`: every string literal, property key, member read and element access that has the name, at EVERY site),
   `canonical ?? legacy` is swapped (`CANONICAL_FIRST`), or the guard `if (x === undefined) x = legacy` is forced (`ALIAS_OVERRIDE`).
   For a ledger name with no ordinary site two fallback operators exist: `ENUM_MEMBER` (the enum member is renamed) and `PREFIX_LITERAL`
   (a `<name>:` namespace loses its legacy name). A kill is a failing test whose output has assertion evidence (jest/vitest
   `expect(` frames); a compile or load error is inconclusive. Note that an exception thrown by the code under mutation (for example a
   `TypeError` that the assertion framework reports with an `expect(` frame) also counts as a kill: the behavior changed.
2. A row is credited only for ITS OWN name: a sibling name's kill proves nothing for it, and a survivor at any site of the name blocks it.
   A wildcard row (`*`, every legacy word of the file) is a whole-file claim: it needs an exhaustive pair, nothing inconclusive, and the census below.
   The wildcard predicate covers tokens (no whitespace) with a Portuguese word, including route paths (`/contratos-v2/*`), accents and short words
   (`pj`); strings with spaces count only in name position (object key, element access, case label, equality operand, array element); URLs never.
3. CENSUS: for every pair the harness also records what the operators did NOT reach, computed from the same source text: every Portuguese
   string/key/member/template part of a wildcard file that is not a mutation site, and every occurrence of a ledger name in a form the
   operators skip (shorthand property, binding element, JSX attribute, method name, template part), plus `siteCount`. The audit credits a row only
   when the record mutated at least every site the harness sees, and the census is empty, or each remaining site is covered by an exemption in the
   ledger row (`proofExemptions: [{ text, reason }]`, reason of 12+ characters) that still matches a census site (a stale exemption fails the row).
   Exemptions exist for interface prose that is not a name (a user-facing validation sentence, an OpenAPI description), never for a legacy name.
4. `COMPILER_CHECKED` covers names that only appear in declarations (type, interface, property signature, function): there is no runtime value to mutate
   and a rename breaks the typecheck. The proof itself does not run the typecheck; the monorepo `typecheck` is the control that backs it.
5. Any later edit of the runtime file, of the test or of the runner configuration makes the record stale (unproven) until `pnpm naming:compat:prove`
   runs again; it re-runs only the stale pairs (`--census-only` recomputes the census of the records already judged on the same bytes).
6. Reporting keeps two bases apart: `COMPATIBILITY_ROWS_PROVEN_BY_MUTATION` and `COMPATIBILITY_ROWS_PROVEN_BY_BINDING_ONLY`. A row whose path is a test
   (a legacy literal used as a fixture) or a script is credited by binding (the file exists and names the literal): that is not behavioral proof of
   a runtime boundary and is never counted as such. (The binding is the existence of the test/script file; that the file really names the literal is
   enforced only indirectly, by the `OBSOLETE_BOUNDARIES` counter.)

7. WIRING (`node scripts/naming/compat-wiring-proof.mjs --check`, proof file `docs/naming/audit/compat-wiring-proof.json`): the name-level proof cannot see that a
   SERVICE stopped calling the alias helper (the DTO still accepts the legacy field, the table spec passes, and a pre-rename client's value is silently
   dropped). It covers two kinds of production call site: HELPER (every call of `applyDeprecatedFieldAliases`) and CONSUMER (every direct call, by identifier
   or namespace, of a function exported by a credited file, resolving relative, `@/` and barrel imports; draft migrations excluded). Each call is replaced
   by its first argument (or `undefined`) and a spec of the loaded suites must fail: `classifyWiring` credits any failing test in a loaded suite (an
   assertion, but also an error thrown by the mutated code, and it cannot rule out a timing flake; baseline-red pairs are retried and reported apart).
   Records are bound to the consumer file and to the specs of its module, not to the credited target file. Exemptions
   (`docs/naming/audit/compat-wiring-exemptions.json`) match on file plus exact call text (not the line) with a reason of at least 40 characters and are
   reported when stale. Counter `WIRING_SITES_UNPROVEN` must be 0; `naming:check` runs it together with the wiring tool tests.
8. The audit never trusts the stored JSON alone: it recomputes the mutation sites and the census from the current source text and refuses a record that differs
   (forged census, fewer mutations than sites, mutations of sites that do not exist, a ledger name added after the run).

Known limits of the wiring gate (recorded, not hidden): it mutates CALLS only. Non-call uses of a credited export (a table spread or indexed, a function passed as
a reference, a JSX/default-import use, a member read) are not mutated; the independent review r14 counted about 224 such references. They are covered only
by the name-level proof of the credited file and by the behavior tests of their module; imports through workspace packages, method calls and default imports
are not followed. An identical call added later in a file with an exemption is exempt too (exemptions are keyed by text).

Known limits (recorded, not hidden): the other alias helpers (`resolveContractAliases`, `resolvePhonogramAliases`, `canonicalizeDeprecatedColumnId`,
`expandHrPermissionAliases`, `resolveDeprecatedImportHeader`) return structured results and have no wiring operator; legacy-first PRECEDENCE written as a ternary,
a `continue` guard or variadic argument order (`pick(target, canonical, legacy)`) is invisible to the operators and to `LEGACY_FIRST_READS`, which only sees
`??`, `||` and `=== undefined` (the instances found by the independent reviews are pinned by behavior tests: HR feature flags, contacts);  the hashes cover the runtime file, its test and the runner configuration, not transitive helpers (the full API
and web suites run in CI and catch a helper that breaks a test); `COMPILER_CHECKED` relies on the monorepo typecheck and is accepted only for declarations a typed reader depends on (a property signature that readers reach through string indexing is not compiler-checked and was removed instead); `proofExemptions` are a human
judgement that a site is prose, reviewed with the ledger; the proof file is trusted as generated evidence (it is excluded from the technical-naming
census as a single named file, and any other file under `docs/naming/audit` is scanned); the unmutated-form census reports shorthand, binding elements,
JSX attributes, methods and template parts but has no mutation operator for them.

## What is still outside these states

- Destructive drops, the PII backfill/scrub and every product decision are not naming states: see `destructive-approval-dossier.md`,
  `product-decision-packages.md` and `pii-key-custody-request.md`. They need a human approval, a product decision or an external
  dependency and are never executed from this workspace.
