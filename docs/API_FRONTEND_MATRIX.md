# API Frontend Matrix

| Frontend | Expected endpoint | Current backend | Status | Notes |
|---|---|---|---|---|
| Dashboard | various metrics | partial/mock | incomplete | Consolidate after Phase 1. |
| Artists | `/artists` | `ArtistsModule` | exists | Reusable. |
| Catalog/Works | `/works`, `/phonograms` | `WorksModule`, `PhonogramsModule` | exists | Reusable. |
| Contracts | `/contracts`, `/contract-templates` | exists | exists | Reusable. |
| Finance | `/transactions`, `/invoices` | exists | exists | Reusable. |
| Agenda | `/events` | `EventsModule` | exists | Basis for the operational calendar. |
| Inventory | pending | nonexistent | blocked in production | The frontend exists, but `api-client` now marks `inventario` as pending; in production it fails instead of mocking. |
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
| Marketing tasks | pending | nonexistent | blocked in production | `tarefas_marketing` has no backend controller; explicit dev-only fallback. |
| Monitoring | pending | nonexistent | blocked in production | `monitoramentos` has no backend controller; explicit dev-only fallback. |
| Licenses | pending | nonexistent | blocked in production | Future licensing module; do not use a mock in production. |
| Rules/financial rules | pending | nonexistent | blocked in production | `regras` and `regras_financeiras` have no backend controller. |
| Roles/permissions CRUD | pending | nonexistent | blocked in production | Permissions are computed via the backend/auth context; there is no canonical CRUD yet. |

## Production Rule

`PENDING_TABLES` may fallback to in-memory data only outside production. In production, any pending table throws an integration error so the UI cannot silently operate on mock data.
