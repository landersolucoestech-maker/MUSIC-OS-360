# Performance & Infrastructure — Cache + Bundle + Lazy Loading + Docker + Health

## What & Why
The system has no distributed cache (every query goes straight to the Neon database on each request), the frontend bundle has no per-module code splitting (all 15 modules load on the first load), there is no route lazy loading, no standardized Docker setup for deploy, and no CI/CD configured. In production with multiple simultaneous tenants, repeated uncached queries degrade latency and cost Neon credits. A monolithic bundle increases TTI (Time to Interactive) and hurts UX on slow connections.

## Done looks like
- Distributed Redis cache: a global `CacheModule` with `@nestjs/cache-manager` + `cache-manager-redis-yet` (Upstash); automatic caching on `@Get()` via `@UseInterceptors(CacheInterceptor)` for public read endpoints (analytics, public catalog); TTL configurable per route via `@CacheTTL(seconds)`
- Cache invalidation: every mutation (CREATE/UPDATE/DELETE) invalidates the corresponding Redis keys via `CacheService.invalidate(pattern)`
- Bundle splitting: each React module has `React.lazy()` + `Suspense` on its route; `vite.config.ts` with `manualChunks` separating: `vendor` (react, radix), `ui` (shadcn), `charts` (recharts), and one chunk per main module
- Lazy loading: all page routes use `React.lazy(() => import('./pages/X'))` via a `lazyRoute()` helper; `<Suspense fallback={<PageSkeleton />}>` wraps the router
- Bundle analysis: `vite-bundle-visualizer` or `rollup-plugin-visualizer` available via `npm run build:analyze` — generates `dist/report.html`
- Docker: a multi-stage `Dockerfile` for `apps/api`: `builder` (installs deps + builds NestJS) → `runner` (Node alpine, dist/ only); a correct `.dockerignore`; `docker-compose.yml` for local dev with Redis + API
- Improved health checks: `GET /health` returns `{ status, uptime, version, db: { status, latencyMs }, redis: { status, latencyMs }, queues: { active, waiting, failed } }` — used by the Docker healthcheck and the load balancer
- `npm run build` without errors; frontend bundle < 2MB total (gzipped)

## Out of scope
- Autoscaling (Kubernetes / ECS — infrastructure level)
- CDN for assets (DNS/edge configuration)
- Database read replicas
- Profiling of individual queries (indexes covered in the database-governance task)

## Steps
1. **Global Redis cache** — install `@nestjs/cache-manager` and `cache-manager-redis-yet`; configure `CacheModule.registerAsync()` in `AppModule` with `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN`; register `CacheInterceptor` globally; apply `@CacheTTL(300)` to analytics and catalog endpoints; a custom `@CacheKey()` including `tenantId` for per-tenant cache isolation
2. **Cache invalidation** — create `core/cache/cache.service.ts` with `invalidate(pattern: string)`: uses Redis SCAN + DEL to clear keys by pattern; call it on critical mutations: `onSuccess` of create/update/delete in the services
3. **Vite code splitting** — update `vite.config.ts`: `build.rollupOptions.output.manualChunks` separating `react-vendor`, `radix-ui`, `recharts`, `tanstack`; each route module as a separate chunk via dynamic import; `build.chunkSizeWarningLimit: 1000`
4. **Lazy routes** — create a `client/src/app/routes/lazy-route.ts` helper: `const LazyPage = React.lazy(() => import('../pages/X'))`; update all route factories (15 modules) to use lazy + Suspense with `<PageSkeleton />`; keep the existing `*.routes.tsx` structure
5. **Multi-stage Docker** — create `apps/api/Dockerfile` with the stages `deps` (npm ci), `builder` (npm run build), `runner` (node:20-alpine, only `dist/` and `node_modules`); create a root `docker-compose.yml` with the services `api` (port 3001) and `redis` (local upstash mock or real); create `.dockerignore`
6. **Improved health check** — extend `health.controller.ts` (created in the observability task): add DB latency (timed SELECT 1) and Redis latency (timed PING); return status `degraded` if latency > 500ms; configure Docker `HEALTHCHECK CMD curl -f http://localhost:3001/health`

## Relevant files
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `vite.config.ts`
- `client/src/app/routes/`
- `client/src/app/App.tsx`
- `apps/api/Dockerfile` (to be created)
- `docker-compose.yml` (to be created)

## Depends on
- Task #666 (observability — base health controller)
- Task #661 (auth chain — tenantId required for cache key isolation)
