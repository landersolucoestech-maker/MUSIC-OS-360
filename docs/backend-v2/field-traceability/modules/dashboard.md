> Historical record. Kept as recorded; not the current contract.

# Module `dashboard` — Zero-Gap Audit (Phase 2, Prompt 104)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_DASHBOARD_CLASSIFICATIONS: 0.

Real scope (cross-domain aggregator — traced to its sources, already completed modules not
re-audited internally):
- Frontend: `apps/web/src/modules/dashboard/**` (`components/`, `constants/`, `forms/`, `schemas/`,
  `services/`, `types/`, `utils/` are all empty stubs — `export {}`; all the real logic lives in
  `pages/Dashboard.tsx` + 3 hooks in `hooks/`). Route: `/dashboard` (`<ProtectedRoute>`, registered in
  `apps/web/src/App.tsx:171` — **outside** the per-module route system in `app/routes/*.tsx` used
  by the other modules).
- Backend: **no dedicated `dashboard` module** — `apps/api/src/modules/analytics/**` (real,
  `AnalyticsController`/`AnalyticsService`, 3 endpoints) + direct reuse of 7 already-audited domain
  endpoints (`/artists`, `/contracts`, `/transactions`, `/events`, `/clients`, `/releases`,
  `/projects`) + `/audit-logs`.
- The Dashboard has no tables of its own — all sources are tables of domains already mapped in
  Phase 1 (`artists`, `contracts`, `transactions`, `events`/`eventos`, `clients`, `releases`,
  `projects`, `invoices`, `support_tickets`, `campaigns`, `operational_tasks` if it exists,
  `audit_logs`, `ai_usage_logs`).

---

## 1. Widgets identified (§3 of the prompt)

| # | COMPONENT | LABEL | DISPLAY_TYPE | HOOK | SOURCE_DOMAIN |
|---|---|---|---|---|---|
| 1 | `StatCard` | "Artistas Cadastrados" (Registered Artists) | KPI_CARD | `useMetrics()` → `dashboardMetrics.totalArtistas` + `artistasMetrics.comContrato` | `artist` |
| 2 | `StatCard` | "Contratos Vigentes" (Contracts in Force) | KPI_CARD | `useMetrics()` → `dashboardMetrics.contratosAtivos`/`.contratosVencendo` | `contracts` |
| 3 | `StatCard` | "Receita Total" (Total Revenue) (misleading label — see Gap #1) | KPI_CARD | `useMetrics()` → `dashboardMetrics.receitaMensal` | `accounting` |
| 4 | `StatCard` | "Eventos do Mês" (Events This Month) | KPI_CARD | `useMetrics()` → `dashboardMetrics.eventosMes` | `events` (not audited, only what was necessary was traced) |
| 5 | `OperationalAlerts` | "Atenção Operacional" (Operational Attention) (up to 8 alert types) | ALERT | `useOperationalDashboard()` → `GET /analytics/dashboard` | `artist`, `contracts`, `accounting`, `crm-relationships` (`leads`, not audited), operational |
| 6 | "Atividades Recentes" (Recent Activity) card | — | ACTIVITY_FEED | `useActivityHistory()` (real) + `useWsEvent()` ×12 (inert, see Gap #7) + CustomEvents ×11 (dead, see Gap #8) | cross-domain (`audit_logs`) |
| 7 | "Próximos Compromissos" (Upcoming Appointments) card | — | LIST (agenda) | `useEventos()` (`events` module, not audited — only traced) | `events` |
| 8 | "Artistas em Destaque" (Featured Artists) grid | — | RANKING | `useMetrics()` → `dashboardMetrics.artistasDestaque` | `artist`, `releases`, `projects` |

8 functional widgets. `ArtistaVisao360Modal` (triggered by widget 8's "Ver perfil 360°" (View 360° profile) button) was already
audited in `artist.md` — not reopened here, only recorded as a deep link (§9).

---

## 2. Components (complete classification — §4 of the prompt)

| Component | Classification |
|---|---|
| `StatCard` (×4 instances) | KPI_CARD |
| `OperationalAlerts`/`AlertItem` | ALERT |
| "Atividades Recentes" card | ACTIVITY_FEED + REALTIME_CONSUMER (inert, see Gap #7) |
| "Próximos Compromissos" card | LIST + OTHER_DATA_CONSUMER |
| "Artistas em Destaque" grid | RANKING |
| `SectionHeader` | STATIC (label/description/link, no data of its own) |
| "Mock mode: window CustomEvents" block (`Dashboard.tsx:449-515`) | DEAD — no matching `dispatchEvent` found in `apps/web/src` (confirmed by exhaustive grep); the only `musicos360:*` CustomEvent actually fired in the app is `musicos360:auth:tokenRefreshed` (`AuthContext.tsx`), unrelated |
| `computeFromMockStorage()` (`useOperationalDashboard.ts:70-220`) | DEAD — a complete function (~150 lines), never called; `useOperationalDashboard()` always uses `api.get("/analytics/dashboard")` |
| `crmMetrics`/`financeiroMetrics` (returned by `useMetrics()`) | DEAD (active code, but the result is never rendered — see Gap #4) |

No functional component was left unclassified.

---

## 3. Hooks (§5 of the prompt)

| HOOK | FILE | ENDPOINTS | READ_FIELDS (source) | QUERY_PARAMS | REALTIME | CACHE | TENANT_DEP |
|---|---|---|---|---|---|---|---|
| `useMetrics` | `hooks/useMetrics.ts` | none of its own — aggregates `useArtistas()`, `useContratos()`, `useTransacoes()`, `useEventos()`, `useClientes()`, `useLancamentos()`, `useProjetos()` (7 domain hooks) | all the fields already listed in the completed `artist`/`contracts`/`accounting`/`crm-relationships` modules + `events`/`releases`/`projects` (not audited, only what was necessary) | none (each internal hook calls without a filter) | no | inherited from each domain hook (React Query, their own keys) | implicit, inherited |
| `useOperationalDashboard` | `hooks/useOperationalDashboard.ts` | `GET /analytics/dashboard` | see §5 below | none | no | `staleTime: 30_000`, `refetchInterval: 60_000` (real polling) | implicit (`@CurrentTenant()`) |
| `useActivityHistory` | `hooks/useActivityHistory.ts` | `GET /audit-logs?limit=N` (N=30, hardcoded in `Dashboard.tsx`) | `id, action, entity, entity_id, before, after, created_at` | `limit` | no (no internal `useWsEvent` — the "real-time update" is done by `Dashboard.tsx` via `useWsEvent`, not by this hook) | `staleTime: 30_000`, `refetchOnWindowFocus: false`, no `refetchInterval` (**there is no polling** — see Gap #7) | implicit |

No active hook was left unclassified.

---

## 4. Dashboard endpoints (§6 of the prompt)

| METHOD | PATH | CONTROLLER | SERVICE | TYPE |
|---|---|---|---|---|
| `GET` | `/analytics/dashboard` | `AnalyticsController` | `AnalyticsService.getDashboard()` — 21 real SQL queries (`COUNT`/`SUM`/`GROUP BY`), `Promise.all`, all `WHERE tenant_id = $1` | **DEDICATED_DASHBOARD_ENDPOINT** |
| `GET` | `/analytics/revenue` | `AnalyticsController` | `AnalyticsService.getRevenueOverview()` — real monthly series (`DATE_TRUNC('month', data)`) | **DEDICATED_DASHBOARD_ENDPOINT — no frontend consumer** (see Gap #9) |
| `GET` | `/analytics/ai-usage` | `AnalyticsController` | `AnalyticsService.getAiUsageSummary()` — AI cost per model/feature | **DEDICATED_DASHBOARD_ENDPOINT — no frontend consumer** (outside the functional scope of this operational dashboard; it is not a widget of the audited module) |
| `GET` | `/audit-logs?limit=30` | (audit module, not re-audited) | — | **REUSED_DOMAIN_ENDPOINT** |
| `GET` | `/artists`, `/contracts`, `/transactions`, `/events`, `/clients`, `/releases`, `/projects` | (modules already audited/traced) | — | **REUSED_DOMAIN_ENDPOINT** (consumed raw, with no Dashboard-specific parameter) |

`CLIENT_SIDE_AGGREGATION`: the entire content of `useMetrics()` (widgets 1, 2, 3, 4, 8) — no
sum/count for these 4 KPIs and the artist ranking is done in the backend; it is all `Array.filter/reduce`
over the 7 complete arrays brought in by the domain hooks. `STATIC/MOCK`: no active widget uses
static/mock data (the only mock block, `computeFromMockStorage()`, is dead — see §2).

---

## 5. KPI — Mandatory traceability (§7 of the prompt)

### KPI 1 — "Artistas Cadastrados" (Registered Artists)

```
FRONTEND_FIELD:     dashboardMetrics.totalArtistas
ENDPOINT:           GET /artists (via useArtistas(), useDataQuery/storage.list — no limit of its own)
BACKEND_FIELD:      artists.length (count of the returned array)
SOURCE_TABLES:      artists
SOURCE_COLUMNS:     no specific column — it is a COUNT of the already-loaded array
CALCULATION:        artistas.length
FILTER_CONDITIONS:  none (all artists returned by the backend, deleted_at IS NULL implicit
                     in the artists service — not re-audited, inherited from artist.md)
STATUS_CONDITIONS:  none
DATE_CONDITIONS:    none
TENANT_CONDITION:   implicit (inherited from the /artists endpoint)
```
"With an active contract" sub-metric: `artistasMetrics.comContrato` = `artistas.filter(a =>
a.contrato_id).length` — counts artists with a truthy `contrato_id` (set only when a contract
reaches `assinado`, see `contracts.md` §15/Gap #7 — subject to the gap already documented there, not reopened).

### KPI 2 — "Contratos Vigentes" (Contracts in Force)

```
FRONTEND_FIELD:     dashboardMetrics.contratosAtivos
ENDPOINT:           GET /contracts (via useContratos())
BACKEND_FIELD:      contratos[].status, .data_inicio, .data_fim
SOURCE_TABLES:      contracts
SOURCE_COLUMNS:     status, data_inicio, data_fim
CALCULATION:        contratos.filter(c => c.status === "ativo" && !!c.data_inicio && !!c.data_fim
                     && hoje >= data_inicio && hoje <= data_fim).length
FILTER_CONDITIONS:  data_inicio AND data_fim must be filled in (see Gap #2 — excludes active
                     contracts without data_fim, an optional field in contracts.md)
STATUS_CONDITIONS:  status === "ativo" (exact string, case-sensitive)
DATE_CONDITIONS:    today between data_inicio and data_fim (inclusive at both ends)
TENANT_CONDITION:   implicit (inherited from the /contracts endpoint)
```
"Expiring soon" sub-metric: `dashboardMetrics.contratosVencendo` = the same `status ===
"ativo"` base, `data_fim` between today and today+30 days (`differenceInDays(data_fim, hoje)` between 0 and 30).

### KPI 3 — "Receita Total" (Total Revenue) (label) / actual value = `receitaMensal`

```
FRONTEND_FIELD:     dashboardMetrics.receitaMensal (labeled on screen as "Receita Total")
ENDPOINT:           GET /transactions (via useTransacoes())
BACKEND_FIELD:      transacoes[].tipo, .status, .data, .valor
SOURCE_TABLES:      transactions
SOURCE_COLUMNS:     tipo, status, data, valor
CALCULATION:        transacoes.filter(t => t.tipo === "receita" && t.status === "pago" &&
                     data(t) >= hoje-30dias && data(t) <= hoje).reduce((acc,t) => acc + t.valor, 0)
FILTER_CONDITIONS:  rolling window of 30 calendar days (it is NOT the calendar month — see Gap #1)
STATUS_CONDITIONS:  tipo === "receita" AND status === "pago" (excludes pendente/agendado/cancelado)
DATE_CONDITIONS:    subDays(hoje, 30) <= t.data <= hoje
TENANT_CONDITION:   implicit (inherited from the /transactions endpoint)
CURRENCY:           implicit BRL (formatCurrency, no currency field)
NULL_BEHAVIOR:      a transaction without t.data is excluded (parseISO would throw, caught by try/catch)
ROUNDING:            no rounding — a direct sum of floats, decimal_precision inherited from
                     `transactions.valor` (not audited here)
```

### KPI 4 — "Eventos do Mês" (Events This Month)

```
FRONTEND_FIELD:     dashboardMetrics.eventosMes
ENDPOINT:           GET /events (via useEventos())
BACKEND_FIELD:      eventos[].data_inicio (or .data — dual-read, see the comment in the code itself)
SOURCE_TABLES:      events (table `eventos`/`events`, not audited — only traced)
CALCULATION:        eventos.filter(e => data(e) within [startOfMonth(hoje), endOfMonth(hoje)]).length
DATE_CONDITIONS:    current calendar month (unlike KPI 3, which uses a rolling 30-day window —
                     an inconsistent "period" convention between KPIs of the same card grid)
TENANT_CONDITION:   implicit
```
`dashboardMetrics.eventosHoje` is computed by the hook but **never read/displayed** in `Dashboard.tsx`
(the page's destructuring of `dashboardMetrics` does not include `eventosHoje`) — a computed but dead field.

---

## 6. OperationalAlerts — real sources (dedicated backend)

`GET /analytics/dashboard` (`AnalyticsService.getDashboard`) — all 21 queries run
in `Promise.all`, each one `WHERE tenant_id = $1`, directly against the physical tables (not via each
domain's paginated REST endpoints) — **it does not suffer the 50-row truncation** that affects
`useMetrics()` (see §8/Gap #3).

| Alert (label in the UI) | SQL_SOURCE | STATUS_CONDITIONS |
|---|---|---|
| "Tarefas atrasadas" (Overdue tasks) | `operational_tasks` (only if the table exists — `to_regclass` feature-detect) | `status != 'done' AND due_date < NOW()` |
| "Invoices vencidas" (Overdue invoices) | `invoices` | `status IN ('vencida','overdue')` |
| "Sincronizações com falha" (Failed syncs) | `artists`/`releases`/`works`/`phonograms`.`metadata->'external_data_exchange'` (jsonb, via `jsonb_each`) | `item->>'status' IN ('failed','rejected')` |
| "Contratos vencendo em 30 dias" (Contracts expiring in 30 days) | `contracts` | `data_fim BETWEEN NOW() AND NOW()+30d`, no explicit `status` filter in this query (unlike the frontend's KPI 2, which requires `status='ativo'` — **CROSS_DOMAIN_CONSISTENCY_GAP**, see Gap #10) |
| "Tarefas pendentes" (Pending tasks) | `operational_tasks` (same feature-detect) | `status = 'pending'` |
| "Onboardings em andamento" (Onboardings in progress) | `artists` | `status = 'contratado'` — labeled "Onboarding" in the UI, but the real condition is "contratado" (signed) (the backend's own comment acknowledges this conflation) |
| "Setups de distribuição pendentes" (Pending distribution setups) | `artists.metadata` (jsonb) | `distribution_setup_requested_at IS NOT NULL AND distribution_setup_completed_at IS NULL` — depends on these two metadata fields actually being written by some `artist` flow (not re-verified, outside the scope of this audit) |
| "Sincronizações externas pendentes" (Pending external syncs) | the same external_data_exchange CTE | `item->>'status' IN ('pending','processing')` |

`open_tickets`, `campaigns`, `leads`, `pending_receivables`, `active_contracts_count`,
`overdue_followups_count` and the `*_by_status` (buckets) are returned by the API but **are not read
by any component** (`OperationalAlerts` only destructures the 8 fields in the table above) —
confirmed by a full reading of `Dashboard.tsx`.

---

## 7. Financial — integration with `accounting` (§9 of the prompt, not re-audited)

| KPI | SOURCE_ENDPOINT | SOURCE_TABLE | INCOME_RULE | STATUS_RULE | DATE_FIELD | CALCULATION |
|---|---|---|---|---|---|---|
| "Receita Total" (labeled; in practice `receitaMensal`) | `GET /transactions` (client-side) | `transactions` | `tipo='receita'` | `status='pago'` | `data` (rolling 30-day window) | sum of `valor` |
| `revenue_current_month` (backend, not displayed) | `GET /analytics/dashboard` | `transactions` | `tipo='receita'` | `status NOT IN ('cancelado','cancelled')` (accepts paid AND pending) | `data >= start of the calendar month` | sum of `valor` |
| `financeiroMetrics.*` (computed, never displayed) | client-side | `transactions` | `tipo='receita'`/`'despesa'` | `status='pago'`/`'pendente'` | no date filter (the entire history) | receitasPagas−despesasPagas=lucroLiquido; margem=round(lucro/receitasPagas×100) |

Three different formulations of "revenue" coexist on the same page (one displayed, two dead), each
with a distinct status rule and date window — none of them re-audits `accounting`
internally; they all inherit the column names already confirmed by that module (`tipo`, `status`,
`data`, `valor`). `ACCOUNTING_DASHBOARD_TRACEABILITY_COMPLETE: SIM` (yes) (the origin is deterministic in all
three formulations, even though they diverge from each other).

---

## 8. Artists, Catalog, Contracts, CRM — sources (§10-§13 of the prompt)

**Artists** ("Artistas em Destaque" widget): `WIDGET=RANKING`,
`ARTIST_FIELDS=nome_artistico, genero_musical, foto_url` (directly from `artists`) +
`lancamentos`/`projetos` (client-side counts
via `lancamentosData.filter(l => l.artista_id === artista.id).length` /
`projetos.filter(p => p.artista_id === artista.id).length`) + `streams` (a real external metric —
`artista.spotify_ouvintes` or `integrations_data.spotify.monthly_listeners/.listeners`, already
documented as a real integration in `artist.md`; correctly `null` when absent, not a false
`0`). `SOURCE_ENDPOINT=GET /artists`. `ORDER`: `lancamentos` desc, then `projetos` desc.
`LIMIT`: 4 (client-side `.slice(0,4)`). Confirmed: **there is no mixing of a manual source vs. an external
metric in the same field** — `streams` is 100% from a real integration; `lancamentos`/`projetos` are 100%
counts of real records — no field mixes the two origins.

**Catalog**: **there is no catalog widget (works/phonograms) in the current Dashboard** —
confirmed by a full reading of `Dashboard.tsx` and `useMetrics.ts` (no reference to `useObras`/
`useFonogramas`/`works`/`phonograms`). The `DASHBOARD_AGGREGATION_GAP` of prompt §11 therefore **does not
apply** — there is no dependency on `GET /works`/`GET /phonograms` in this module today.

**Contracts**: already covered in KPI 2 (§5) and in the "Contratos vencendo em 30 dias" alert (§6) — `SOURCE_
FIELDS=status,data_inicio,data_fim`, `LIMIT`: no contract widget uses `take N` — they are counts
over the complete array (subject to the 50 truncation, see Gap #3, except for the alert, which uses real SQL).

**CRM**: confirmed — no invented `contacts` table; `crmMetrics` (the only CRM read point
in `useMetrics.ts`) reads `useClientes()` → `GET /clients` (the real physical source, `Contato=Cliente`,
already established in `crm-relationships.md`) — but `crmMetrics` is dead (never displayed, see §2).
`OperationalAlerts`/`analytics.service.ts` uses `leads` (a real table of the `leads` module, not
`crm-relationships`, a correct distinction) for `leadCount`, also not displayed.

---

## 9. Charts / Time Series / Date Range (§15-§17 of the prompt)

`CHARTS: 0` — no graph/chart exists in the Dashboard today (no charting library
imported in `Dashboard.tsx`, no `<Chart>`/`<Recharts>`/similar component found). This is
despite the existence of a real backend endpoint ready to serve a time series
(`GET /analytics/revenue`, `DATE_TRUNC('month', data)`, parameterizable by `months`) — **with
no frontend consumer** (see Gap #9). `TIME SERIES: 0` active time-series widgets.
`DATE RANGE: 0` period selectors exist in the UI — all time windows (30 calendar days in
KPI 3, calendar month in KPI 4 and in the backend's `revenue_current_month`, "today" in the expiry alert)
are **hardcoded**, not configurable by the user.

---

## 10. Filters, Search, Sort/Ranking (§18-§20 of the prompt)

`FILTERS: 0` — there is no interactive filter in the Dashboard (not by artist, period, status, etc.
— all widgets always show the same fixed slice). `SEARCH: 0` — there is no search field.
`SORT/RANKING`: 1 — "Artistas em Destaque" (`UI_SORT`: implicit, with no user control;
`API_SORT`: none, 100% client-side sorting; `DATABASE_EXPRESSION`: N/A;
`DIRECTION`: desc by `lancamentos`, desc by `projetos` as a tiebreaker; `LIMIT`: 4;
`TIE_BEHAVIOR`: if `lancamentos` AND `projetos` tie, it keeps the original order of the array
returned by `GET /artists` — with no additional tiebreak criterion, e.g. alphabetical name).

---

## 11. Limits and Truncation (§21/§22 of the prompt) — CRITICAL CROSS-CUTTING GAP

| WIDGET | LIMIT | SERVER_OR_CLIENT | INTENTIONAL | AFFECTS_AGGREGATE |
|---|---|---|---|---|
| KPI "Artistas Cadastrados" | 50 (default `PaginationDto.limit` in `GET /artists`, no override in `useArtistas()`) | SERVER (silent) | NO | **YES — the displayed total is `artistas.length` over an array already truncated to 50 by the backend** |
| KPI "Contratos Vigentes"/"vencendo" (expiring) | 50 (default of `GET /contracts`, already confirmed in `contracts.md`) | SERVER | NO | **YES** |
| KPI "Receita Total" (`receitaMensal`) | 50 (default of `GET /transactions`, `useTransacoes()` with no override) | SERVER | NO | **YES — the sum is computed over at most 50 transactions, not the real total** |
| KPI "Eventos do Mês" | 50 (default of `GET /events`, `useEventos()` with no override) | SERVER | NO | **YES** |
| "Artistas em Destaque" (ranking) | 50 in `artists`/`lancamentos`/`projetos` (3 sources, each truncated independently) | SERVER | NO | **YES — the ranking can omit the truly most relevant artist if they are beyond the 50th position in any of the 3 lists** |
| "Próximos Compromissos" | 50 (default of `GET /events`) SERVER + 5 (client, `.slice(0,5)`, intentional) | BOTH | the `.slice(0,5)` is intentional (preview); the upstream 50 limit is not | preview, does not affect a displayed "total" |
| "Atividades Recentes" | 30 (`GET /audit-logs?limit=30`, an explicit parameter, not the silent default of 50) | SERVER, **intentional** (parameter passed deliberately) | YES | preview, does not affect a displayed "total" |
| `OperationalAlerts` (all 8 values) | none — `AnalyticsService.getDashboard()` uses a direct SQL `COUNT(*)` against the physical table, with no pagination | N/A | — | **NO — these are the only Dashboard KPIs free of the 50 truncation** |

**Critical gap confirmed (§21/§22 of the prompt)**: the 4 `StatCard`s at the top of the Dashboard and the
"Artistas em Destaque" ranking are **all** "Total X" values derived from arrays already limited to 50 records by the
backend — they are not `TOTAL_REAL`, they are counts/sums over an unintentional `PREVIEW_LIST_LIMIT`.
No visual indication tells the user that the number may be incomplete. This is a
structural inference (the same `PaginationDto.limit=50` pattern already verified and confirmed
byte by byte in `works`/`phonograms`/`contracts`/`contract_templates`/`clients` in the previous
audits, and replicated identically by `useArtistas`/`useTransacoes`/`useEventos`/
`useLancamentos`/`useProjetos` via the same `useDataQuery`/`storage.list()` with no `limit` override
— each domain controller was not reopened byte by byte, per the prompt's instruction not to
re-audit completed modules and not to fully audit external modules).

---

## 12. Pagination, Status, Empty/error states (§23-§25 of the prompt)

No Dashboard widget implements its own pagination — they are all "preview" (top N) or "total"
(section §11). `LOADING_STATE`: the whole page uses `DashboardSkeleton` while `useMetrics().
isLoading` is `true` (aggregated over the 7 domain hooks) — `useOperationalDashboard`/
`useActivityHistory` have their own loading states and do not block the page's initial rendering
(`OperationalAlerts` returns `null` while `dashboard` is `undefined`, with no skeleton of its own).
`EMPTY_STATE`: implemented explicitly for "Atividades Recentes", "Próximos Compromissos" and
"Artistas em Destaque" (messages + CTA). `ERROR_STATE`: **no visible error handling** — if
`useOperationalDashboard()`/`useActivityHistory()` fail, the React Query `error` is returned by the
hook but **never read** in `Dashboard.tsx` (neither `OperationalAlerts` nor the Activity Feed check
`.error`) — a network failure on these two endpoints silently results in "no alerts"/
"no activity" (empty state), **indistinguishable from a tenant that genuinely has no data** — `FAKE_
ZERO` confirmed for these two widgets specifically (not for the 4 `StatCard`s from `useMetrics`,
which would be stuck on `DashboardSkeleton` if any of the 7 hooks errored, since
the combined `isLoading` never becomes `false` if a query hangs, but which also do not display a dedicated
error message — the same practical effect of masking the failure, with a different symptom: infinite loading
instead of zero).

---

## 13. Fallbacks / Mocks (§26 of the prompt)

| Item | Classification |
|---|---|
| `computeFromMockStorage()` (`useOperationalDashboard.ts`) | DEAD — never called |
| Block of 11 `window.addEventListener("musicos360:...")` (`Dashboard.tsx`) | DEAD — no matching `dispatchEvent` in `apps/web/src` |
| `crmMetrics`/`financeiroMetrics` | ACTIVE_RUNTIME (the code runs on every render) but the result is **DEAD** (never rendered) |

No **active and visible** fake data was found — the only fallback/mock mechanisms
present in the code are all dead (they never fire), which is positive, but the very fact that
~220 lines of dead code (mock function + 11 listeners) remain in the module is recorded as a
maintainability finding (`MOCK_DATA_GAP`, with no active functional risk).

---

## 14. Realtime (§27 of the prompt) — GAP CONFIRMED

`useWsEvent()` is a real mechanism (Supabase Realtime broadcast, tenant/user channel, already validated in
`auth.md`) — `Dashboard.tsx` subscribes to 12 typed events (`artist.created`, `artist.updated`,
`artist.deleted`, `catalog.music.registered`, `catalog.phonogram.registered`, `contract.created`,
`contract.updated`, `contract.signed`, `crm.lead.captured`, `crm.lead.converted`,
`finance.transaction.created`, `finance.transaction.updated`, `finance.calculated`,
`audit.entry.created` — 14 in total).

**An exhaustive search in the backend (`apps/api/src`) found no call site that publishes
any of these 14 event names via Supabase Realtime broadcast.** The backend's domain event system
(`EventsService.emitTyped()`) uses exclusively `EventEmitter2` (`this.emitter.emit(...)`,
confirmed by reading the source code of `events.service.ts`) — an **internal** bus of the
NestJS process, which triggers handlers such as `ContractEventsHandler`/`ContractWorkflowHandler` (they write
`activity_logs`, create tasks, etc. — already documented in `contracts.md`), but **has no bridge
to Supabase Realtime**. No service/gateway was found that translates `DOMAIN_EVENTS`
into `artist.created`/`contract.signed`/etc. broadcasts.

`REALTIME_GAP` confirmed: the Dashboard's 12-14 `useWsEvent()` subscriptions are **structurally
correct** (real typing, real channel, real hook) but **never receive any event** because nothing in the
backend publishes them. `WIDGET_UPDATED`: never, via this path — the only real way for the Activity Feed to
grow is via a new load of `useActivityHistory()` (React Query, `staleTime: 30_000`, **no
`refetchInterval`** — there is no automatic polling; it only re-runs on a new mount or a manual invalidation,
neither of which occurs in this module) — in practice, the feed is effectively static after the
page's initial load, except for a navigation/remount of the component.

---

## 15. Cache (§28 of the prompt)

| SOURCE | CACHE_KEY | TENANT_IN_KEY | FILTERS_IN_KEY | INVALIDATION |
|---|---|---|---|---|
| `useOperationalDashboard` | `["operational-dashboard"]` | **NO** — fixed key, no tenant | N/A (no filters) | no explicit invalidation found; only `refetchInterval: 60_000` |
| `useActivityHistory` | `["activity-history", limit]` | **NO** — fixed key + limit | `limit` (the only parameter) | no explicit invalidation; `staleTime: 30_000` |
| Domain hooks (`useArtistas` etc.) | their own keys, already documented in the corresponding modules | inherited | inherited | inherited |

`CACHE_GAP` — theoretical risk recorded, not confirmed as a real exploit: since React Query
keeps its cache in memory per browser session (not persisted across users/devices) and the
backend always filters by `tenant_id` on the server, **there is no real cross-tenant leak** even with
the cache key not including the tenant — the risk would only exist in exotic scenarios (e.g. two
different tenants authenticated in the same tab without a full reload between switches), which was not
verified and is not the application's usage pattern (switching tenants typically implies a reload). Recorded
as a missing best practice, not as a confirmed vulnerability.

---

## 16. Refresh / Polling (§29 of the prompt)

| MECHANISM | INTERVAL | ENDPOINT | WIDGET |
|---|---|---|---|
| `refetchInterval` (React Query) | 60,000 ms | `GET /analytics/dashboard` | OperationalAlerts |
| none | — | `GET /audit-logs` | "Atividades Recentes" (on mount only, no polling) |
| none | — | 7 domain hooks (`useMetrics`) | 4 StatCards + Ranking (on mount only) |

Not changed (forbidden by the prompt) — only recorded that only `OperationalAlerts` updates
automatically; the other widgets require a manual reload/remount of the page to reflect new data.

---

## 17. Permissions (§30 of the prompt)

| WIDGET | PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|---|
| The entire `/dashboard` page | none beyond authentication | `<ProtectedRoute>` (login required, no specific role/permission check) | — |
| `OperationalAlerts` (includes `revenue_current_month`/`expenses_current_month`/`net_result_current_month`/`pending_receivables` in the response, even though they are not displayed) | none in the frontend | no visible `RequirePermission` | `GET /analytics/dashboard` requires only `@RequireRole('viewer')` — the lowest role in the hierarchy |
| KPI "Receita Total" / other StatCards | none in the frontend | none | inherited from `GET /transactions` etc. (not re-audited; presumably also `viewer` for reading, consistent with the pattern observed in all modules already audited) |

`AUTHORIZATION_GAP` (informational, not critical): `GET /analytics/dashboard` exposes financial
aggregates (month revenue/expense/balance, pending receivables) to any user with the tenant's
minimum `viewer` role, with no additional gate — even though these specific values are not
rendered today by `OperationalAlerts` (§6), the API already delivers them to any caller authorized to
see the operational dashboard. If the product intent is to restrict aggregated financial data to
higher roles (not verifiable without reopening `accounting.md`), this is the point where that should be
enforced; recorded as an observation, not as a confirmed failure, since there is no evidence that the
intended permission model is more restrictive than "viewer" for financial aggregates.

---

## 18. Tenant Isolation (§31 of the prompt)

`TENANT_SOURCE`: in every case, the backend resolves the tenant via `@CurrentTenant()` (JWT-derived,
the same `TenantGuard` pattern already audited in `auth.md`) — the frontend never sends an explicit tenant
to any of the endpoints used by the Dashboard. `DATABASE_FILTER`: `WHERE tenant_id = $1` confirmed
in all 21 queries of `AnalyticsService.getDashboard()` + `getRevenueOverview()` +
`getAiUsageSummary()`, and inherited from the 7 domain hooks (already audited/traced individually).
`TENANT_ISOLATION_GAPS: 0`.

---

## 19. Deep Links (§32 of the prompt)

| SOURCE_WIDGET | TARGET_ROUTE | ROUTE_EXISTS | Note |
|---|---|---|---|
| StatCard "Contratos Vigentes" (indirect, not a link) | — | N/A | StatCards are not clickable |
| "Tarefas atrasadas"/"Tarefas pendentes" alerts | `/crm` | **YES**, but it redirects to `/leads` (`crm.routes.tsx`) — it works, it is an indirection, not a broken link | |
| "Invoices vencidas" alert | `/accounting/nota-fiscal` | YES (`accounting.routes.tsx`) | |
| "Sincronizações com falha"/"Sincronizações externas pendentes" alerts | `/configuracoes` | YES, but the route is wrapped in `<AdminRoute>` (`settings.routes.tsx:19`) — a `viewer` user who sees the alert (the endpoint's minimum permission, §17) may be blocked on click if not an admin | possible permission friction, not a broken link |
| "Contratos vencendo em 30 dias" alert | `/contratos` | YES (`contracts.routes.tsx`) | |
| "Onboardings em andamento" alert | `/artistas` | YES (`artist.routes.tsx`) | |
| "Setups de distribuição pendentes" alert | `/lancamentos` | YES (`releases.routes.tsx`) | |
| "Ver Agenda Completa" (View Full Agenda) ("Próximos Compromissos") | `/agenda` | YES (`operations.routes.tsx`) | |
| "Ver todos" (View all) ("Artistas em Destaque") | `/artistas` | YES | |
| "Ver perfil 360°" (View 360° profile) button | opens `ArtistaVisao360Modal` (already audited in `artist.md`) | N/A (modal, not a route) | |

`DEEP_LINK_GAPS: 0` — no broken route found; 1 observation of possible permission
friction (not counted as a formal gap, since the route exists and works for those who have access).

---

## 20. Export / XLSX (§33/§34 of the prompt)

No export functionality was found in the Dashboard (no button, no call to
`reports-api`/the Reports Center from this module). `XLSX_EXPORTS: 0`,
`XLSX_RULE_VIOLATIONS: 0` (does not apply — there is no XLSX in this module).

---

## 21. Cross-Domain Consistency (§35 of the prompt)

| Comparison | DASHBOARD_FORMULA | DOMAIN_FORMULA (source) | CONSISTENT |
|---|---|---|---|
| "Contratos Vigentes" (StatCard) vs. `active_contracts_count` (`/analytics/dashboard`, not displayed) | `status='ativo'` + both `data_inicio`/`data_fim` present + today within the interval | `status IN ('vigente','ativo','assinado')`, without requiring dates | **NO** — the same Dashboard, two divergent formulas for "active contract" (one displayed, one not) |
| "Contratos vencendo em 30 dias" alert vs. `dashboardMetrics.contratosVencendo` (not displayed directly, but computed) | backend: `data_fim BETWEEN NOW() AND NOW()+30d`, no status filter | client: requires `status='ativo'` AND `data_fim` within the 30-day window | **NO** — the alert (displayed, real SQL source) can count contracts in any status whose `data_fim` falls within the window, while the equivalent `useMetrics()` (not displayed) restricts to `status='ativo'` |
| "Receita Total" (StatCard, `receitaMensal`) vs. `revenue_current_month` (`/analytics/dashboard`, not displayed) | rolling window of 30 calendar days, only `status='pago'` | current calendar month, `status NOT IN ('cancelado','cancelled')` (includes pending) | **NO** — different period AND status rule |
| "Artistas Cadastrados" vs. the count in `artists.md`/Artists screen | `artistas.length` over an array truncated to 50 (Gap #3) | the Artists screen uses the same source (`useArtistas()`), so it **suffers the same truncation** — the two numbers should match each other (both wrong in the same way), but neither reflects the tenant's real total if there are >50 artists | **CONSISTENT with each other, both incorrect vs. reality** |

`CROSS_DOMAIN_CONSISTENCY_GAP` confirmed (3 divergent pairs out of 4 compared) — it is important to note
that in all 3 divergent cases, the formula **actually displayed** to the user is the one from
`useMetrics()` (client-side, truncated to 50, subject to the documented gaps), while the
`/analytics/dashboard` formula (real SQL, no truncation) is computed but **not displayed** — that is, the
Dashboard has access to more correct numbers and does not use them for the headline KPIs.

---

## 22. Consolidated gaps

1. **DISPLAY_MAPPING_MISMATCH** — the StatCard labeled **"Receita Total"** actually displays
   `dashboardMetrics.receitaMensal`, a rolling 30-day window (`status='pago'` only), not the
   historical revenue total nor even the calendar month — a misleading label.
2. **CALCULATION_MISMATCH** — "Contratos Vigentes" excludes contracts with `status='ativo'` but without
   `data_fim` filled in (an optional field in `contracts.md`), underestimating the real count.
3. **TRUNCATION_GAP** (critical severity, cross-cutting) — the 4 KPI StatCards and the
   "Artistas em Destaque" ranking are computed over client-side arrays limited to 50 records by the
   default `PaginationDto.limit=50` of each domain endpoint (`/artists`, `/contracts`,
   `/transactions`, `/events`, plus `/releases`/`/projects` for the ranking) — none of these "Total X"
   values is a `TOTAL_REAL` for tenants with more than 50 records in any of those entities.
4. **CODE_FIELD_ONLY** (maintainability finding) — `crmMetrics` and `financeiroMetrics` (the complete
   return of `useMetrics()`, including a real P&L calculation: revenue/expenses/net
   profit/margin/accounts receivable/accounts payable) are computed on every render but **never
   rendered** anywhere in the Dashboard.
5. **STATUS_MISMATCH** — inside the dead `financeiroMetrics` (Gap #4), and potentially also
   at other non-displayed points, the checked statuses (`"pago"`, `"pendente"`) are consistent with
   `accounting`, but this was not cross-checked because the block itself is never displayed — recorded as a
   note, not as an active gap visible to the user.
6. **MOCK_DATA_GAP** — `computeFromMockStorage()` (~150 lines) and the block of 11
   `window.addEventListener("musicos360:...")` (~70 lines) are dead code (never executed/
   never fired) that remains in the module.
7. **REALTIME_GAP** (high severity) — the Activity Feed's 14 `useWsEvent()` subscriptions never
   receive events: no call site in the backend publishes Supabase Realtime broadcasts for
   `artist.created`/`contract.signed`/`finance.transaction.created`/etc. — confirmed by reading
   `EventsService.emitTyped()` (uses only the internal `EventEmitter2`, with no bridge to realtime). The Activity
   Feed only updates via `useActivityHistory()`, which in turn has no `refetchInterval` — the feed is
   effectively static between page remounts.
8. **FALLBACK_GAP** — both `OperationalAlerts` and the Activity Feed treat a network failure (React Query's
   `error`, never read) the same way as "no data" — an API error silently becomes an
   empty/missing section, with no warning to the user (`FAKE_ZERO`/`FAKE_EMPTY` confirmed).
9. **REAL_MAPPING_GAP** — `GET /analytics/revenue` (a real monthly revenue/expense series,
   ready to feed a chart) and `GET /analytics/ai-usage` have **no frontend
   consumer** — real, complete endpoints, never called; the Dashboard has no chart even though
   it has a data source ready for one.
10. **CROSS_DOMAIN_CONSISTENCY_GAP** — 3 pairs of conceptually equivalent formulas (active
    contract, expiring contract, period revenue) diverge between the displayed client-side version
    (`useMetrics()`, truncated, with more restrictive status/date rules) and the backend's real SQL version
    (`/analytics/dashboard`, no truncation, computed but not displayed) — see §21.
11. **AUTHORIZATION_GAP** (informational) — `GET /analytics/dashboard` exposes financial aggregates to
    any `viewer` of the tenant, with no additional gate — see §17.

Total: 1 DISPLAY_MAPPING_MISMATCH, 1 CALCULATION_MISMATCH, 1 TRUNCATION_GAP, 1 MOCK_DATA_GAP,
1 REALTIME_GAP, 1 FALLBACK_GAP, 1 REAL_MAPPING_GAP, 1 CROSS_DOMAIN_CONSISTENCY_GAP,
1 AUTHORIZATION_GAP (informational) = **9 gaps** (plus 2 maintainability notes — the dead code
`crmMetrics`/`financeiroMetrics` and the status inconsistency within it — recorded but not
counted separately since they do not affect anything visible to the user).

---

## Final counters (Zero-Gap)

```
COMPONENTS_AUDITED: 9 (4 StatCard instances treated as 1 reusable component + 8 widgets)
HOOKS_AUDITED: 3
ENDPOINTS_AUDITED: 11 (3 dedicated analytics + 8 reused domain endpoints: artists, contracts,
                       transactions, events, clients, releases, projects, audit-logs)
WIDGETS_AUDITED: 8
KPI_WIDGETS: 4
CHARTS: 0
TABLE_LIST_WIDGETS: 1 (Próximos Compromissos)
RANKING_WIDGETS: 1 (Artistas em Destaque)
ACTIVITY_WIDGETS: 1 (Atividades Recentes) + 1 (Atenção Operacional / Alerts)
FILTERS: 0
DATE_RANGE_CONTROLS: 0
SEARCH_FIELDS: 0
SORT_FIELDS: 1 (artist ranking, not user-controllable)
CROSS_DOMAIN_SOURCES: 8 (artist, contracts, accounting, events, crm-relationships/clients,
                          releases, projects, audit-logs/system)
CALCULATIONS_AUDITED: 12 (4 top KPIs + 8 operational alert conditions)
LIMITS_AUDITED: 8 (7 sources with a silent limit of 50 + 1 source with an intentional limit of 30)
REALTIME_EVENTS: 14 (subscribed, 0 actually published by the backend)
CACHE_KEYS_AUDITED: 2 dedicated (`operational-dashboard`, `activity-history`) + inherited from the domain
                     hooks
EXPORT_FIELDS: 0
XLSX_EXPORTS: 0
XLSX_RULE_VIOLATIONS: 0
PERMISSIONS_AUDITED: 1 (GET /analytics/dashboard — @RequireRole('viewer'))
AUTHORIZATION_GAPS: 1 (informational)
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 1 (crmMetrics/financeiroMetrics)
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
ENUM_MISMATCH: 0
DISPLAY_MAPPING_MISMATCH: 1
FILTER_MAPPING_MISMATCH: 0
DATE_RANGE_MISMATCH: 0
AGGREGATION_MISMATCH: 0
CALCULATION_MISMATCH: 1
STATUS_MISMATCH: 0 (note recorded in dead code, not counted as an active gap)
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 1 (cross-cutting, affects 5 widgets — counted once as a pattern gap)
MOCK_DATA_GAPS: 1
FALLBACK_GAPS: 1
CACHE_GAPS: 0 (theoretical risk recorded in §15, not confirmed as a gap)
REALTIME_GAPS: 1
DEEP_LINK_GAPS: 0
CROSS_DOMAIN_CONSISTENCY_GAPS: 1
REAL_MAPPING_GAPS: 1

ACCOUNTING_DASHBOARD_TRACEABILITY_COMPLETE: YES
ARTIST_DASHBOARD_TRACEABILITY_COMPLETE: YES
CATALOG_DASHBOARD_TRACEABILITY_COMPLETE: YES (does not apply — no catalog widget exists)
CONTRACTS_DASHBOARD_TRACEABILITY_COMPLETE: YES
CRM_DASHBOARD_TRACEABILITY_COMPLETE: YES

UNMAPPED_WIDGETS: 0
UNMAPPED_KPIS: 0
UNMAPPED_CHART_FIELDS: 0 (there are no charts)
UNMAPPED_TABLE_LIST_FIELDS: 0
UNMAPPED_FILTERS: 0 (there are no filters)
UNMAPPED_DATE_RANGES: 0 (there is no date selector)
UNMAPPED_SOURCE_TABLES: 0
UNMAPPED_CALCULATIONS: 0
UNKNOWN_DASHBOARD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `events`
