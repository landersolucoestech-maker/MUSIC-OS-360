# Backend — 5 Missing Modules (Inventory, Licensing, Monitoring, Rules, Contents)

## What & Why
The frontend has complete modules for inventory, licensing, monitoring and others, but the backend does not have the corresponding endpoints. Without a real backend, the frontend stays in mock mode for these areas even when `MOCK_MODE=false` — the pages load fictitious data and any mutation (create, edit, delete) does not persist. This prevents any real production use of the physical inventory, work licensing, play monitoring and marketing/briefing content features.

Note: `/contents` in the context of the document refers to contents/monitoring records (content-detections exists, but a REST CRUD endpoint is missing). `/rules` has no controller.

## Done looks like
- `GET/POST/PATCH/DELETE /inventory` — CRUD for equipment/physical items with per-tenant isolation
- `GET/POST/PATCH/DELETE /licensing` — CRUD for work licenses with type, term, amount, status fields
- `GET/POST/PATCH/DELETE /monitoring` — listing and creation of play/stream monitoring records per work/phonogram
- `GET/POST/PATCH/DELETE /rules` — business rules configurable per tenant (alerts, thresholds)
- All endpoints use TenantGuard, return cursor-based pagination, have validated Zod DTOs
- The frontend can turn off the mock for these routes and consume real data

## Out of scope
- Streaming integrations to populate monitoring automatically (separate queue task)
- Advanced reports on these modules
- Migration of existing mock data

## Steps
1. **Drizzle schema** — create the tables `inventory_items`, `licensing_agreements`, `monitoring_records`, `tenant_rules` in `apps/api/src/database/schema.ts`; essential fields with an FK to the tenant; generate and apply the migration
2. **InventoryModule** — controller + service + DTO with basic CRUD; mandatory filter by `tenantId`; support for the fields: name, category, quantity, value, status, location
3. **LicensingModule** — controller + service + DTO; fields: `obra_id`, `tipo_licença`, `licensee`, `valor`, `data_inicio`, `data_fim`, `status`, `territorio`; expiration alerts via a queue
4. **MonitoringModule** — controller + service + DTO; fields: `obra_id`, `fonograma_id`, `plataforma`, `periodo`, `plays`, `receita`, `fonte`; support for manual import and bulk insert
5. **RulesModule** — controller + service + DTO; simple key-value rules with a type (threshold, alert, config) per tenant; a GET /rules/:key endpoint for individual lookup
6. **Register the modules** — add the 4 modules to `app.module.ts`; ensure correct NestJS DI and DrizzleModule imports
7. **Frontend — turn off the mock** — find where each frontend module falls back to mockData and replace it with the correct `api.get/post` calls pointing to the new endpoints

## Relevant files
- `apps/api/src/database/schema.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/artists/artists.module.ts`
- `client/src/modules/inventory/`
- `client/src/modules/licensing/`
- `client/src/modules/monitoring/`
