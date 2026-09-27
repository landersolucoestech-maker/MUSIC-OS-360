# Frontend Data Layer — Storage → Real API + Query Keys + Cache Contracts

## What & Why
`useDataQuery` (the core of all 47+ hooks) uses `storage.list/create/update/delete`, which points to MOCK_DATA when MOCK_MODE=true. When MOCK_MODE=false, `storage` must call the real backend — but the HTTP storage layer was never fully implemented: paginated endpoints, global error normalization and optimistic updates are missing, and the query keys do not follow a consistent hierarchy (some use arrays, others strings). The transition to the real backend after #662 (MOCK_MODE opt-in) requires this layer to work correctly.

## Done looks like
- `storage.ts` in HTTP mode: `list()` → `GET /api/:table?page=&limit=&cursor=`; `create()` → `POST /api/:table`; `update()` → `PATCH /api/:table/:id`; `delete()` → PATCH (soft delete) `DELETE /api/:table/:id`
- Hierarchical query keys: `QUERY_KEYS.ARTISTAS = ['artistas']`, `QUERY_KEYS.ARTISTA(id) = ['artistas', id]` — every hook uses the correct hierarchy for precise invalidation
- Error normalization: `api-client.ts` converts HTTP errors into `ApiError { code, message, statusCode, requestId }` — every `onError` receives this typed value
- Optimistic updates on CREATE and DELETE: `createMutation` adds a temporary record to the cache before the response; `deleteMutation` removes it immediately; automatic rollback on error
- Loading states: `isLoading`, `isFetching`, `isPending` standardized — a clear distinction between the first load and a refetch
- All queries have `staleTime` and `gcTime` configured via `query-config.ts` (critical data: 30s; catalog: 5min; analytics: 15min)
- `tsc --noEmit` without errors in `client/`

## Out of scope
- Rewriting each individual hook (only the generic `useDataQuery` and `storage.ts`)
- Implementing new backend endpoints (done in #665)
- File upload (separate task)
- React Query DevTools (development only, already exists or trivial)

## Steps
1. **storage.ts HTTP mode** — implement `StorageHTTPAdapter` with the methods `list`, `create`, `update`, `delete` using `api-client.ts`; support for `filters` as query params; support for `cursor` and `limit` for pagination; return a typed array or throw `ApiError`
2. **Error normalization** — create `shared/lib/api-error.ts` with an `ApiError extends Error` class with `code`, `statusCode`, `requestId`, `details`; update `api-client.ts` to convert HTTP error responses into this type; update `useDataQuery` to type `onError` with `ApiError`
3. **Hierarchical query keys** — audit `shared/lib/query-config.ts`; convert all keys into factory functions: `QUERY_KEYS.artista(id)`, `QUERY_KEYS.obra(id)`, etc.; update every hook that uses `invalidateQueries` to use the correct hierarchy (invalidating `['artistas']` invalidates `['artistas', id]`)
4. **Optimistic updates** — add `onMutate` to `createMutation` (adds the item to the cache with `id: crypto.randomUUID()`) and to `deleteMutation` (removes it from the cache); `onError` rolls back via `queryClient.setQueryData`; `onSettled` invalidates to sync with the server
5. **Cache contracts** — update `getCacheConfig()` to have 3 tiers: `CRITICAL` (artists, contracts, finance: staleTime 30s, gcTime 5min), `CATALOG` (works, phonograms: staleTime 5min, gcTime 30min), `ANALYTICS` (metrics, reports: staleTime 15min, gcTime 1h)
6. **Validate with MOCK_MODE=false** — test the layer against the real endpoints of the existing modules (artists, works, contracts, transactions); ensure that list/create/update/delete work end to end

## Relevant files
- `client/src/shared/hooks/useDataQuery.ts`
- `client/src/shared/lib/storage.ts`
- `client/src/shared/lib/api-client.ts`
- `client/src/shared/lib/query-config.ts`
- `client/src/modules/artist/hooks/useArtistas.ts`

## Depends on
- Task #661 (auth chain — the token needs to work)
- Task #662 (MOCK_MODE opt-in — controls which adapter to use)
- Task #665 (backend modules — the endpoints need to exist)
