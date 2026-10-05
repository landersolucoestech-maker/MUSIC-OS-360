# API Frontend Matrix

> Source of truth: `TABLE_ENDPOINT` and `PENDING_TABLES` in `apps/web/src/shared/lib/api-client.ts` and the controllers in `apps/api/src/modules`. Naming authority: `docs/naming/canonical-naming-map.json`.

| Frontend | Expected endpoint | Current backend | Status | Notes |
|---|---|---|---|---|
| Dashboard | various metrics | partial/mock | incomplete | Consolidate after Phase 1. |
| Artists | `/artists` | `ArtistsModule` | exists | Reusable. |
| Catalog/Works | `/works`, `/phonograms` | `WorksModule`, `PhonogramsModule` | exists | Reusable. |
| Contracts | `/contracts`, `/contract-templates` | exists | exists | Reusable. |
| Finance | `/transactions`, `/invoices` | exists | exists | Reusable. |
| Agenda | `/events` | `EventsModule` | exists | Basis for the operational calendar. |
| Inventory | `/inventory` | `InventoryModule` | exists | Table key `inventory_items` in `TABLE_ENDPOINT`; RLS in migration `20260613000006`. |
| CRM | `/clients`, `/leads`, `/lead-interactions` | partially exists | incomplete | Must become the canonical CRM in a future phase. |
| Marketing | `/campaigns`, `/briefings` | partially exists | reusable | Basis for music campaigns. |
| Projects/Releases | `/projects`, `/releases` | exists | exists | Reusable. |
| Support | `/support-tickets` | exists | exists | Validate tenant-aware filters. |
| Uploads | `/uploads` | exists | to validate | Confirm ownership by tenant/user. |
| Notifications | `/notifications` | exists | to validate | Confirm ownership by tenant/user. |
| AI | `/ai/*` | exists | reusable | Basis for operational AI. |
| Integrations | `/integrations` | exists | to validate | Separate mocks from real providers. |
| Users/RBAC | `/users` | exists | adjusted | Uses `auth_user_id` and Supabase Auth. |
| HR employees | `/hr/employees` | `HrModule` | exists | Fixed frontend mapping that pointed to `/employees`. |
| HR payroll | `/hr/payroll` | `HrModule` | exists | Fixed frontend mapping that pointed to `/payroll`. |
| HR leave | `/hr/leave-requests` | `HrModule` | exists | Fixed frontend mapping that pointed to `/leave`. |
| Content/detections | `/content-detections` | `ContentDetectionsModule` | exists | Fixed the `conteudos` alias; `deteccoes` was already correct. |
| Marketing tasks | `/marketing/tasks` | `MarketingTasksController` | exists | The marketing service calls the route directly; the storage table key `marketing_tasks` is still listed in `PENDING_TABLES` (no flat table mapping). |
| Monitoring | pending | nonexistent | unavailable | Table key `monitoring` has no backend controller. |
| Licenses | `/licenses` | `LicensingModule` | exists | Table key `licenses` in `TABLE_ENDPOINT`. |
| Rules | pending | nonexistent | unavailable | Table key `rules` has no backend controller. |
| Financial rules | `/financial-rules` | `FinancialRulesModule` | exists | Table key `financial_rules` in `TABLE_ENDPOINT`. |
| Roles/permissions CRUD | pending | nonexistent | unavailable | Permissions are computed via the backend/auth context; there is no canonical CRUD yet. |

## Pending tables

A table key listed in `PENDING_TABLES` has no backend route. The storage layer (`apps/web/src/shared/lib/storage.ts`) resolves it as unavailable and raises an integration error instead of serving in-memory data, in every environment.
