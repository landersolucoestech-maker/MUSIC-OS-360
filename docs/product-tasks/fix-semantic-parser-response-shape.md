---
title: Fix reading of the API response in the contract analyzer (TransformInterceptor wraps it in data.data)
---
# Fix reading of the AI response in the semantic-parser

## What & Why

The global `TransformInterceptor` (apps/api/src/core/interceptors/transform.interceptor.ts)
wraps ALL NestJS responses:

```
controller devolve:  { content: "..." }
interceptor produz:  { data: { content: "..." }, timestamp: "..." }
```

`semantic-parser.service.ts` does `const data = await response.json()` and then
`data.content` — which is `undefined` because the real value is in `data.data.content`.
Result: the AI responds with 1277 tokens but the frontend shows
"O servidor de IA retornou uma resposta vazia." (The AI server returned an empty response.)

## Done looks like

- `semantic-parser.service.ts` reads the content correctly regardless of whether the
  response is in `data.content` (direct response) or `data.data.content` (wrapped)
- The Contract Intelligence Engine shows the extracted variables after analysis
- TypeScript EXIT:0
- No regressions in other consumers of the AI API

## Steps

1. **Update `semantic-parser.service.ts` lines 151-155** — change:
   ```ts
   const data = await response.json() as { content?: string; error?: string };
   if (!data.content) {
   ```
   to:
   ```ts
   const raw = await response.json() as { content?: string; data?: { content?: string }; error?: string };
   const data = { content: raw.data?.content ?? raw.content, error: raw.error };
   if (!data.content) {
   ```
   This way it accepts both shapes (direct and wrapped).

2. **TypeCheck**: `cd apps/web && npx tsc --noEmit -p tsconfig.app.json 2>&1; echo "EXIT:$?"`

3. **Smoke test**: check in the API logs that `output_tokens > 0` and that
   the UI displays the contract variables.

## Relevant files

- `apps/web/src/modules/contracts/services/semantic-parser.service.ts:151-155`
- `apps/api/src/core/interceptors/transform.interceptor.ts` (read only — do not change)
- `apps/api/src/modules/ai/ai.controller.ts:50` (reference — returns `{ content }`)
