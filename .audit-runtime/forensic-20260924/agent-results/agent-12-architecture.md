# AGENT-12 — Architecture Placement and Ownership Audit

subagent_type: architecture-reviewer
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 40
duration_ms: 473062
status: COMPLETED

## Item 1 — 5 orphaned packages (auth/observability/schemas/ui/utils): CONFIRMED independently
Repo-wide grep for @music-os-360/(auth|observability|schemas|ui|utils): 10 hits, all self-reference or docs; the one non-package-json source hit (packages/observability/src/sentry.ts:33) is a JSDoc comment example, not a real import. Neither app's package.json depends on any of the 5. Root package.json build/dev/test scripts only --filter api and web. Zero references in .github/workflows or scripts/.

## Item 2 — server/ai-proxy.ts unreferenced: CONFIRMED independently
All 3 docker-compose files read in full: no reference. Neither Dockerfile references it. No package.json anywhere references "ai-proxy". Real vite config is apps/web/vite.config.mjs (not .ts as assumed in the delegation prompt -- agent caught and corrected this); its real dev-proxy forwards to the real NestJS API on 3001, not ai-proxy. aiApiPlugin does not exist anywhere in source -- the only 2 hits are ai-proxy.ts's own stale comment and a doc entry. Zero frontend callers of /api/ai/generate or /api/acrcloud/*.

## New Finding A — orphaned root-level tsconfig.app.json/tsconfig.node.json + root public/
Root tsconfig.json's "references" array only points at apps/web/tsconfig.app.json and apps/api/tsconfig.json -- NOT the root-level tsconfig.app.json/tsconfig.node.json sitting beside it, which are unreferenced by any real build/typecheck/CI command. Root public/ (placeholder.svg, robots.txt) is a second, unused public folder -- Vite's real root is apps/web (apps/web/scripts/run-vite.mjs), so publicDir resolves to apps/web/public; confirmed dist/ build output contains none of the root public/ files. Leftover pre-monorepo scaffolding. Classification: LEGACY_PROVEN, ORPHAN. Not fixed (read-only).

## New Finding B — real 3-way duplicate currency/date formatting (naming-canonical.md violation)
Three independently-implemented, live, actively-consumed formatters for the same PT-BR currency/date business rule:
- apps/web/src/shared/lib/format-utils.ts: formatCurrency/formatDate/formatDateTime (uses SYSTEM_REGIONAL_SETTINGS.locale)
- apps/web/src/modules/marketing/utils/marketing-format.ts: SAME function names, independently reimplemented with hardcoded Intl.NumberFormat("pt-BR"); confirmed live consumer Campanhas.tsx:65,254,255,499,500
- apps/web/src/modules/licensing/lib/licenca-format.ts: formatMoney + formatLicensingDate, third independent hardcoded implementation
32 files total import from one of the three. No documented architectural reason found for the split. This is exactly naming-canonical.md's "one business rule, one authoritative implementation" finding class. Classification: DUPLICATE_OWNER, NEEDS_PRODUCT_DECISION on which is canonical (or CERTIFICATION that all 3 should consolidate to shared/lib/format-utils.ts). Not fixed (read-only, and consolidating 32 consumer files is a real, scope-expanding change requiring explicit authorization).

## New Finding C — 4 god files (>2000 lines, exact wc -l, not estimated)
apps/api/src/database/entities.ts: 3717
apps/web/src/modules/artist/components/ArtistVision360Modal.tsx: 3076 (note: also one of the 2 known foreign dirty files from this session's chain-of-custody -- currently mid-edit)
apps/web/src/modules/releases/components/LancamentoFormModal.tsx: 2685
apps/web/src/modules/settings/pages/Configuracoes.tsx: 2619
No others exceed 2000 lines (exhaustive find+wc over both src trees, excluding spec/test files).

## New Finding D — zero cross-app/cross-package boundary violations (real negative, proven)
apps/web importing apps/api or vice versa: zero hits both directions. Deep relative escapes (../../../../) in apps/api/src stay within apps/api/src, none cross into apps/web. Inter-package imports among packages/*: zero hits (consistent with Item 1 -- most aren't consumed by anything, including each other, so no cycle exists to find).

## Classification summary
- Item 1: CONFIRMED (matches prior finding)
- Item 2: CONFIRMED (matches prior finding, with a real correction: vite.config.mjs not .ts)
- Finding A: NEW, LEGACY_PROVEN/ORPHAN
- Finding B: NEW, DUPLICATE_OWNER, NEEDS_PRODUCT_DECISION
- Finding C: NEW, informational (decomposition debt, no action forced)
- Finding D: NEW, real negative proof (boundary integrity confirmed, not just assumed)
