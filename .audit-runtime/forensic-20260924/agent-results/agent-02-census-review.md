# AGENT-02 — Independent Review of Forensic Census Scripts

subagent_type: general-purpose
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 29
duration_ms: 609506
status: COMPLETED

## Verdict
Byte/line/classification counting mechanics: CORRECT, independently reproduced exactly (head_tree_total_bytes 30,750,175 via fresh `git ls-tree -r -l HEAD`; discovered_bytes 30,914,239 via fresh `stat` over every `git ls-files` path). Two real bugs found in the AST census's token_count. One significant false claim found in this run's own chain-of-custody documentation (not the census scripts themselves).

## Bug 1 (FIXED this turn): wrong ts.createScanner parameter
census-ast.ts:55 (v1) passed `scriptKind` into createScanner's 3rd positional arg, which is actually `languageVariant`. Verified against typescript.js v5.9.3 source (line ~13085): the scan loop's JSX-close-tag branch checks `languageVariant === LanguageVariant.JSX`, never true with the bug. Grepped 374 tracked .tsx files, ~13,629 `</Identifier` occurrences -- each mis-tokenized as 2 tokens instead of 1.

## Bug 2 (FIXED this turn): missing reScanSlashToken(), regex literals fragmented
census-ast.ts:54-59 (v1) ran a bare scan loop with no `reScanSlashToken()` call. Verified in typescript.js: the base scanner always returns SlashToken for `/`; only becomes RegularExpressionLiteral via reScanSlashToken(), invoked exclusively by parser-context code, never a standalone scan loop. Confirmed real regex literals in the repo (password-policy.ts, contract-legacy-alias.util.ts, ~13+ more) were affected.

Both bugs affect ONLY discovered_tokens. ast_node_count (1,592,761) and symbol_count (38,104) come from ts.createSourceFile's real parser (separate correct code path) -- confirmed unaffected, unchanged before/after the fix.

FIX APPLIED: replaced the standalone re-lex scanner with leaf-node counting of the full-fidelity concrete syntax tree (node.getChildren(sourceFile) recursion), reusing the already-correct parser instead of a second context-free pass. Re-ran: discovered_tokens 2,031,259 -> 1,968,599 (-62,660, -3.08%), matching the agent's own prediction of "low single-digit percent" overstatement.

## Finding 3 (CORRECTED this turn): false "content-identical by definition" claim
This run's chain-of-custody.jsonl claimed worktree-vs-HEAD_TREE census values are interchangeable for any file with zero `git status --short` divergence. FALSE under this repo's core.autocrlf=true (no .gitattributes override) -- git excludes CRLF/LF normalization from status/diff comparison. Proven via a real join of the two file censuses (cross-census-reconciliation.ts, run this turn): 864/3880 files (22%) differ in byte_length between worktree and HEAD_TREE despite only 3 being git-dirty. Of the 861 non-git-dirty diffs, ALL 861 have identical physical_line_count, proving the deltas are pure CRLF-insertion noise, not content drift -- but the byte-level "identical by definition" claim was genuinely false and has been corrected in chain-of-custody.jsonl with a dedicated correction record.

## Things independently verified as correct (tried to break, could not)
- countPhysicalLines: LF, CRLF-as-single-terminator, lone CR, empty file, unterminated-final-line all verified against real files (package.json, .config/turborepo/telemetry.json) with exact wc -l/-c matches.
- git cat-file --batch framing: proven safe against newline bytes inside blob content (offset advance is purely size-field-driven, never content-scanned).
- NUL-sample classification (8000-byte window): a genuine latent design gap (a binary file with NUL only after byte 8000 would misclassify) that does NOT manifest for any of this repo's 3,880 tracked files today (spot-checked all 17 real binaries, NUL always well within the first few hundred bytes; policy.mjs's 2 NULs at offsets 3438/3485, both within 8000).
- Symlink/gitlink handling: correct by inspection but untested against real data (this repo has zero symlinks/submodules -- git ls-tree -r HEAD shows all 3,880 entries are type blob).

## Minor, non-blocking hardening gap noted (not fixed)
census-files-head-tree.ts's batch-parsing loop has no post-loop assertion that rows.length === blobEntries.length (unlike census-files.ts, which tracks a read_errors counter). Did not manifest this run (counts reconcile exactly) but is a verification gap worth hardening in a future pass.

## Classification summary
- Byte/line/classification counting: VERIFIED CORRECT (independently reproduced)
- AST node / symbol counting: VERIFIED CORRECT, never affected by the token bugs
- Token counting: BUG CONFIRMED AND FIXED this turn (2 real bugs, -3.08% correction)
- "Content-identical by definition" claim: DISPROVEN AND CORRECTED this turn (real 22% CRLF divergence proven, zero real content drift beyond the 3 known dirty files)
