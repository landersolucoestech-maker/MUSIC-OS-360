# MUSIC OS 360 — RLS and Tenant Isolation Matrix

## Tenant Isolation Rule

Operational tables must be protected twice:

- API layer: global `JwtAuthGuard`, `TenantGuard`, and `RolesGuard`.
- Database layer: RLS policies using Supabase JWT claims.

The API must not trust a tenant ID sent by the client as the source of truth.

## Existing RLS Surface

The TypeORM migration `RLSPolicies20260520000020` is the current executable RLS baseline. It covers tenant-scoped operational tables and org-scoped SaaS tables.

| Table | RLS Expected | Notes |
|---|---|---|
| `organizations` | yes | Org-scoped policy compares JWT `org_id` with `organizations.id` |
| `tenants` | yes | Org-scoped policy compares JWT `org_id` with `tenants.org_id` |
| `org_members` | yes | Membership and role lookup |
| `artists` | yes | Music domain |
| `works` | yes | Catalog and rights |
| `phonograms` | yes | Catalog and rights |
| `contracts` | yes | Legal ops |
| `contract_templates` | yes | Legal ops |
| `transactions` | yes | Financial ops |
| `invoices` | yes | Financial ops |
| `clients` | yes | Canonical CRM entity (Contact = Client, see `docs/CRM_CANONICAL_ADR.md`) |
| `leads` | yes | CRM |
| `lead_interactions` | yes | CRM timeline |
| `campaigns` | yes | Campaign ops |
| `events` | yes | Operations/calendar |
| `projects` | yes | Operations |
| `releases` | yes | Release ops |
| `shares` | yes | Rights/revenue split |
| `audit_logs` | yes | Immutable audit surface |
| `inventory_items`, `licenses`, `financial_rules` | yes | Migration `20260613000006_RlsPoliciesInventoryLicensesFinancial` |
| `notifications` | yes | User/tenant ownership |

## Required Next Audit

Confirm RLS coverage for:

- uploads;
- integrations;
- activity logs;
- support tickets;
- billing subscriptions;
- AI jobs;
- content detections;
- ECAD reports;
- HR entities;
- workflow transitions;
- domain event logs;
- future companies, opportunities, messages, workflows, and landing pages (`contacts` is the `clients` table; the generic forms module was dropped by migration `20260822000005_DropGenericFormsModule`).

## Hardening Applied

- In production, `DatabaseModule` now fails startup when `DATABASE_URL` is missing or PostgreSQL cannot be reached.
- In production, `MigrationValidatorService` exits when the database is unavailable, because migration validation cannot be skipped safely.
- In production, `TenantGuard` no longer falls through when repositories are unavailable; it returns a service-unavailable error.
- Frontend storage pending tables (`PENDING_TABLES` in `apps/web/src/shared/lib/api-client.ts`) are unavailable in every environment: they raise an integration error and never fall back to in-memory data.

## Current Gaps To Close Before Production

| Area | Gap | Required Action |
|---|---|---|
| Uploads | Endpoint exists, RLS table coverage not confirmed in matrix | Add/verify upload RLS and ownership tests |
| Integrations | Endpoint exists, provider tables RLS not fully confirmed | Add/verify integration RLS and secret ownership |
| Activity logs | Endpoint exists, RLS coverage pending | Ensure tenant-scoped read and append-only writes |
| Support tickets | Endpoint exists, RLS coverage pending | Add policies and cross-tenant tests |
| Billing subscriptions | Endpoint exists, org-scoped rather than tenant-scoped | Policy compares JWT `org_id` with `billing_subscriptions.org_id`; add billing role tests |
| AI jobs | Endpoint exists, cost/tenant ledger needs policy coverage | Add AI job/cost RLS before production AI ops |
| HR | Endpoint exists, RLS coverage pending | Add policies for employees, payroll, leave requests |
| Inventory | Backend (`/inventory`) and RLS (migration `20260613000006`) exist | Keep cross-tenant tests for `inventory_items` |

## Mandatory Tests

- user from tenant A cannot list tenant B records;
- user from tenant A cannot fetch tenant B record by ID;
- user cannot update/delete tenant B record;
- disabled member cannot access tenant data;
- lower role cannot execute higher privilege mutation;
- missing JWT is rejected;
- invalid JWT is rejected;
- JWT with missing org claim is rejected.

## Latest Hardening

- The org-level RLS migration no longer assumes every org-scoped table has an `org_id` column.
- `organizations` now uses `id` for policy comparison.
- `tenants` and `billing_subscriptions` continue using `org_id`.
- Migration rollback maps org-scoped table descriptors back to plain table names before dropping policies.
