---
title: Fix the AI endpoint URL in the contract analyzer
---
---
title: Fix the AI endpoint URL in the semantic-parser — /api/ai/generate → /api/v1/ai/generate
---
# Fix the AI endpoint URL in the semantic-parser

## What & Why

`apps/web/src/modules/contracts/services/semantic-parser.service.ts` calls
`fetch("/api/ai/generate", ...)` directly. The Vite proxy forwards `/api` to
`127.0.0.1:3001` without a rewrite, so the request reaches NestJS as
`/api/ai/generate` — but NestJS serves the endpoint at `/api/v1/ai/generate`.
Result: 404, and the semantic contract analysis never reaches OpenAI.

`api-client.ts` already uses the correct pattern (`${API_BASE_URL}/api/v1${path}`).
The semantic service simply bypasses that client with a manual fetch and a wrong path.

## Done looks like

- `semantic-parser.service.ts` calls `/api/v1/ai/generate` (or uses the `apiClient`)
- The Contract Intelligence Engine analyzes a contract and returns a result (HTTP 200) without a 404
- Zero TypeScript errors (`EXIT:0`)
- Zero new regressions in other AI services

## Out of scope

- Migrating all AI providers to use `apiClient` (separate work)
- Changing the global API prefix

## Steps

1. **Fix the path in `semantic-parser.service.ts` line 132**: change
   `fetch("/api/ai/generate", ...)` to `fetch("/api/v1/ai/generate", ...)`
2. **TypeCheck**: `cd apps/web && npx tsc --noEmit -p tsconfig.app.json 2>&1; echo "EXIT:$?"`
3. **Manual smoke test**: make a call to `/api/v1/ai/generate` from the browser
   and confirm HTTP 200 in the Contract Intelligence Engine UI

## Relevant files

- `apps/web/src/modules/contracts/services/semantic-parser.service.ts:132`
- `apps/web/src/shared/lib/api-client.ts:119` (correct reference pattern)
- `apps/web/vite.config.ts:165` (proxy: `/api` → `127.0.0.1:3001`, no rewrite)