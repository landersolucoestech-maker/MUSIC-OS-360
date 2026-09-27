# MOCK_MODE — Secure Opt-in + Bundle Guard

## What & Why
`MOCK_MODE` is defined as `VITE_USE_MOCK !== "false"` — opt-out logic. If `VITE_USE_MOCK` is not defined in production (oversight or misconfiguration), mock activates automatically, exposing MOCK_DATA and disabling real calls to the backend. This is a critical security and reliability risk in production: fake data would appear in the real SaaS, all mutations would be silent (no persistence) and the integrations would not work.

## Done looks like
- `MOCK_MODE` is only `true` when `VITE_USE_MOCK === "true"` explicitly (opt-in)
- In a production build (`NODE_ENV=production` or `VITE_USE_MOCK` not defined), MOCK_MODE is `false` automatically
- Imports of `mockData.ts` and any mock provider are excluded from the production bundle via tree-shaking or import guards
- A visible console.warn in dev when MOCK_MODE is active, a hard block (throw) if MOCK_MODE is `true` in a prod build
- The variable `VITE_USE_MOCK=false` added to `.env.example` as the production default

## Out of scope
- Removing the mock logic itself (still needed for dev/standalone)
- Changing the mockData data (content)
- Modifying any integration hook (already fixed in Task #655)

## Steps
1. **Invert the logic in `env.ts`** — change to `VITE_USE_MOCK === "true"` (opt-in); add a guard that throws an explicit error with a clear message when `IS_PROD && MOCK_MODE`
2. **Protect the mockData imports** — wrap each import of `mockData.ts` and `mock-rights.provider` in a conditional block on `MOCK_MODE`; use `import.meta.env.VITE_USE_MOCK === "true"` as the condition so Vite eliminates it via tree-shaking in the prod bundle
3. **Update `.env.example`** — document `VITE_USE_MOCK=false` as the production default value; `VITE_USE_MOCK=true` as an explicit instruction for standalone dev
4. **Validate the bundle** — run `vite build` and verify that `mockData` does not appear in the output; grep the dist to confirm its absence
5. **Tsc 0 errors** — ensure that the type change does not break any existing import

## Relevant files
- `client/src/shared/lib/env.ts`
- `client/src/shared/data/mockData.ts`
- `client/src/modules/integrations/providers/mock/mock-rights.provider.ts`
- `.env.example`
