# PHASE 6 — Real Operational Dashboard

## What & Why
The current dashboard displays static mock-data metrics with no real operational value. For a multi-tenant enterprise ERP, the dashboard is the critical control panel — it needs to expose operational bottlenecks, real alerts with SLAs, and health indicators for the music business in real time. This phase turns the dashboard into the operational nerve center.

## Done looks like
- Dashboard reorganized into sections: **Critical Alerts** (red, urgent action), **Pending Items** (yellow, action needed), **Operational Health** (green, monitoring), **Trends** (blue, context)
- Real operational indicators computed in the backend via `GET /dashboard/operational-summary`:
  - Releases: late (data_lancamento < today and status != released), no cover, no ISRC, no distributor
  - Contracts: expiring within 30 days, in signature for more than 7 days, no arquivo_url
  - Campaigns: no budget defined, active with spend > 90% of the budget
  - Catalog: works without ISRC, phonograms without isrc, shares that do not add up to 100%
  - Tickets: critical ones open longer than the SLA, no assignee
  - Integrations: with status `error` or `disconnected` with last_sync > 24h
  - Onboarding: artists in `onboarding` status for more than 14 days
  - HR: employees with pending payroll in the current month
- Each alert includes: title, description, count, severity (critical/warning/info), a direct link to the module and a pre-applied filter
- **Operational Timeline** widget: the last 20 critical domain actions (workflow transitions, signed contracts, published releases) in chronological order — fed by the `domain_event_log` from PHASE 3
- **Integration Health** widget: real-time status of the active integrations (ABRAMUS, Spotify, YouTube, etc.) with the last synchronization
- Updated **Business KPIs** (real, not mock): revenue for the month, expenses for the month, margin, number of active artists, releases this month, leads in the pipeline
- The backend computes all indicators in efficient SQL queries with existing indexes; response in < 500ms
- The dashboard supports auto-refresh every 5 minutes via TanStack Query `refetchInterval`

## Out of scope
- User configuration of alerts
- Customizable dashboard (drag-and-drop widgets)
- KPI history with time series (trend charts are simplified)

## Steps
1. **Create the GET /dashboard/operational-summary endpoint** — A service that runs parallel queries (Promise.all) for each alert category. Response typed with `OperationalAlert[]`, `KpiSummary`, `RecentActivity[]`, `IntegrationHealth[]`. 60s cache in the existing `CacheService`.
2. **Create the alert queries** — For each category (releases, contracts, catalog, campaigns, tickets, integrations, HR), implement an efficient TypeORM query with the correct filters scoped by tenant_id. Return the count + the top 5 items with a navigation link.
3. **Refactor the Dashboard component in the frontend** — Replace the mock data with a real call to the endpoint. Create the components: `OperationalAlerts.tsx` (list with colors by severity), `KpiGrid.tsx` (6 main KPIs), `OperationalTimeline.tsx` (latest actions), `IntegrationHealthBar.tsx`.
4. **Implement deep links in the alerts** — Each alert has a `link` and a `filter` — on click, it navigates to the correct module with the filter pre-applied (e.g. Contracts with the filter `vencendo_em_30_dias=true`). Use `useSearchParams` or a Zustand store to receive the filter when the module mounts.
5. **Auto-refresh and loading states** — TanStack Query with `refetchInterval: 5 * 60 * 1000` (5min). Independent skeleton loading per section. A visual "last updated" indicator in the dashboard header.
6. **Integration health metrics** — A separate widget that queries `IntegrationEntity` + `webhook_events` (recent failures) and displays a visual status for each of the tenant's active integrations.

## Relevant files
- `apps/web/src/modules/dashboard/pages/`
- `apps/web/src/modules/dashboard/hooks/`
- `apps/api/src/database/entities.ts`
- `apps/api/src/core/cache/cache.service.ts`
- `apps/web/src/shared/components/`
- `apps/web/src/shared/data/mockData.ts`
