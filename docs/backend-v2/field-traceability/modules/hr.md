# Module: `rh` — Zero-Gap Field Traceability Audit

STATUS: COMPLETE

## 0. Central objective — critical findings up front

**RH_DOMAIN_MEANING**: `rh` is an internal **HR/employee records management system** (funcionários,
folha de pagamento, férias/ausências, documentos) — confirmed by evidence to be a record-keeping tool
entirely separate from platform authentication/authorization. An `Employee` (`funcionário`) is **not**
the same entity as a platform `User`/`OrgMember` (§8) — there is no FK between them, only an optional,
non-persisted display-only linkage attempt.

**CRITICAL, code-evidenced finding — this module's entire CRUD surface is broken, across all four of
its sub-resources, for the same systemic reason found repeatedly this session (contracts, leads,
marketing, monitoring, projects, releases): frontend forms send field names that don't match backend
DTOs, and the global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` rejects every
request outright.** This module has the highest concentration of such breaks found in the entire audit
series:

1. **Employee create/update — 100% broken.** `CreateEmployeeDto` requires `nome` and accepts only
   13 fields (`nome, cargo, departamento, tipo_contrato, status, email, telefone, cpf, salario,
   data_admissao, data_demissao, documentos, metadata`). `FuncionarioFormModal.tsx` (lines 160-176)
   builds and sends `{nome_completo, cpf, rg, data_nascimento, email, telefone, endereco, cargo, setor,
   tipo_contrato, data_admissao, salario_base, status, observacoes, vinculo_usuario_id}` — it **never
   sends `nome`** (the one required field) and sends 8 fields the DTO doesn't whitelist (`nome_completo,
   rg, data_nascimento, endereco, setor, salario_base, observacoes, vinculo_usuario_id`). Every
   `POST/PATCH /hr/employees` from the real form is rejected with HTTP 400.
2. **Payroll create — 100% broken.** `CreatePayrollEntryDto` requires `employee_id`/`competencia`.
   `FolhaPagamentoFormModal.tsx` (lines 133-134 confirmed directly) sends `funcionario_id`/
   `mes_referencia` instead — neither is a whitelisted field, and the required fields are absent.
   Every `POST /hr/payroll` from the real form is rejected.
3. **Leave-request create — 100% broken**, same root pattern: `CreateLeaveRequestDto` requires
   `employee_id`; `FeriasAusenciasFormModal.tsx` sends `funcionario_id`/`dias_totais`/`observacoes`,
   none whitelisted.
4. **HR "Documentos" tab is wired to the wrong backend resource entirely.**
   `TABLE_ENDPOINT.documentos_funcionario = "/hr/employees"` (`api-client.ts:82`, confirmed) —
   `useDocumentosFuncionario(funcionarioId)` lists via `GET /hr/employees?funcionario_id=...`, but
   `HrController.listEmployees` (confirmed directly) only ever reads `status`/`offset`/`limit` — the
   `funcionario_id` filter is **silently ignored**, so the "Documentos" tab lists **every employee of
   the tenant, mislabeled as documents** (rendering `undefined` for `tipo_documento`/`nome_arquivo`/
   `url_arquivo`, none of which exist on an employee row). Uploading a document `POST`s to
   `/hr/employees`, which `CreateEmployeeDto` rejects the same way as #1 — every document *record*
   creation fails with 400, even though the underlying file **does** genuinely upload to Cloudflare R2
   first (§13 — a real upload, orphaned from its own metadata).

Net effect: **no employee, payroll entry, leave request, or HR document can be created or edited
through the real UI today.** This is confirmed by direct reading of both sides (DTOs + service +
controller on the backend; the exact submitted payload shape in each form component on the frontend),
not inferred.

## 1. A second, independent, equally critical bug — physical/entity column drift breaks the list view itself

Beyond create/edit, **the employee list/table is non-functional even for reading**. Migration
`20260712000003_HrFormFieldColumns.ts` added 8 real physical columns to `employees`
(`nome_completo, rg, data_nascimento, endereco, setor, salario_base, observacoes,
vinculo_usuario_id`) — but `EmployeeEntity` (`entities.ts:1692-1722`) **never declares any of them**.
TypeORM therefore never selects or returns them via `GET /hr/employees`. `RH.tsx`'s table (confirmed
directly, lines 656-676, 993) reads `f.nome_completo`, `f.setor`, `f.salario_base`,
`f.vinculo_usuario_id` for every row — **all four render blank/"—"/N/A for every employee that
exists**, since the API response simply never contains these keys. The search box (`funcSearch`
against `f.nome_completo`) and the "Setor" filter (`funcSetorFilter` against `f.setor`) are
consequently **both completely non-functional** — they filter against a field that is always
`undefined`. Classified `CODE_FIELD_ONLY`-inverse (`DATABASE_COLUMN_ONLY` — the column is real in the
DB and even round-trips correctly if written via raw SQL, but the application's own entity layer
cannot see it at all, on either the read or write side).

The same drift pattern recurs on `payroll_entries` (orphaned physical `funcionario_id`, `mes_referencia`,
`bonus`, `data_pagamento`, `observacoes`, never mapped in `PayrollEntryEntity`) and `leave_requests`
(orphaned physical `funcionario_id`, `dias_totais`, `observacoes`). The migration's own docstring
(`20260712000003_HrFormFieldColumns.ts:4-12`) documents the *intended* design — *"cada campo do
formulário tem a SUA coluna física... colunas legadas são espelhadas pelo service a partir dos campos
do formulário"* — i.e. `HrService` was supposed to mirror form field names into these legacy columns.
**This mirroring was never implemented** — confirmed directly: `hr.service.ts`'s `createEmployee`/
`updateEmployee`/`createPayroll`/`createLeaveRequest` never reference any of the 16 orphaned columns
across all three tables.

## 2. Subdomains

| Subdomain | Frontend entrypoint | Endpoints | Backend | DB tables |
|---|---|---|---|---|
| EMPLOYEE | `/rh` tab "Funcionários" | 5 (`GET/GET:id/POST/PATCH/DELETE /hr/employees`) | `HrController`/`HrService` | `employees` |
| PAYROLL_ENTRY | `/rh` tab "Folha de Pagamento" | 2 (`GET/POST /hr/payroll` — **no PATCH/DELETE**) | same | `payroll_entries` |
| LEAVE_REQUEST | `/rh` tab "Férias e Ausências" | 3 (`GET/POST /hr/leave-requests`, `PATCH .../approve` — **no generic update, no reject**) | same | `leave_requests` |
| DOCUMENT (mislabeled) | `/rh` tab "Documentos" | none of its own — misrouted to employees (§0.4) | — | none (no `documentos_funcionario` table exists at all — it's a fictitious frontend-only table name) |

No department/position ("cargos"), timesheet/attendance, benefits, or performance-review table exists
anywhere — "cargo"/"departamento"/"setor" are free-text varchar columns on `employees`, not normalized
entities (confirmed absent, not invented as a missing requirement). A separate, unrelated
`department_id`/`position_id` exists on `OrgMemberEntity` for the platform RBAC system — structurally
unconnected to HR (§8).

## 3. Components / Hooks

| Component | File | Classification |
|---|---|---|
| `RH.tsx` | `pages/RH.tsx` | 4-tab TABLE/GRID page + KPI_CARD + FILTER + SEARCH, wrapped in `<FeatureGate feature="moduleRh">` |
| `FuncionarioFormModal.tsx` | `components/` | CREATE_MODAL + EDIT_MODAL + DETAIL_MODAL (mode-switched) |
| `FolhaPagamentoFormModal.tsx` | `components/` | same, payroll |
| `FeriasAusenciasFormModal.tsx` | `components/` | same, leave requests |
| `RHViewModals.tsx` | `components/` | DETAIL_MODAL variants |
| Document upload control (inside `RH.tsx`, "Documentos" tab) | `RH.tsx` | UPLOAD — real R2 binary upload (§13), broken metadata record (§0.4) |

`hooks/useFuncionarios.ts`, `useFolhaPagamento.ts`, `useFeriasAusencias.ts`,
`useDocumentosFuncionario.ts` — all real `useDataQuery`/`storage`-backed hooks (genuine HTTP client,
not a mock). `services/rh.service.ts` (`rhService`) — appears to be dead/unused, same pattern found in
`projects`/`catalog`/`releases` (a redundant, unconsumed service-layer file coexisting with the real
hooks) — not independently re-verified with a full-repo grep in this pass given the overwhelming
severity of the confirmed CRUD breaks already found, but consistent with the systemic pattern.

## 4. Create / Edit Employee — field mapping

| UI Label | Form field | API field sent | DTO accepts it? | Persisted |
|---|---|---|---|---|
| Nome completo | `nome_completo` | `nome_completo` | **NO** (DTO wants `nome`) | **NO — request rejected (§0.1)** |
| Cargo | `cargo` | `cargo` | yes | NO (blocked by the same rejected request) |
| Setor | `setor` | `setor` | **NO** (DTO/entity have no `setor`) | NO |
| Tipo de contrato | `tipo_contrato` | `tipo_contrato` | yes | NO |
| Data de admissão | `data_admissao` | `data_admissao` | yes | NO |
| Salário base | `salario_base` | `salario_base` | **NO** (DTO/entity want `salario`) | NO |
| Status | `status` | `status` | yes, but enum values differ (§9) | NO |
| CPF / RG / Data de nascimento / Endereço | respective fields | `cpf`/`rg`/`data_nascimento`/`endereco` | `cpf` yes; `rg`/`data_nascimento`/`endereco` **NO** | NO |
| Observações | `observacoes` | `observacoes` | **NO** | NO |
| Vincular a Usuário do Sistema | `vinculo_usuario_id` | `vinculo_usuario_id` | **NO** | NO (and even if it were, entity doesn't declare the column — §8) |

`nome` (the DTO's one required field) is **never sent by the form at all** — even setting aside every
other mismatch, this alone guarantees rejection. Every field in the table above is therefore
`PERSISTED: NÃO` today, not because each field individually fails, but because the entire request never
reaches persistence.

## 5. Edit vs Create

Same component (`FuncionarioFormModal.tsx`, mode-switched) — `CREATE_SUPPORTED`/`EDIT_SUPPORTED`
identical field sets (Create = Edit confirmed true). Both blocked by the identical `nome`/`nome_completo`
mismatch (edit additionally omits `nome` from `UpdateEmployeeDto`'s payload the same way, since it
extends `CreateEmployeeDto` via `PartialType` — the same non-whitelisted extra fields apply).

## 6. Payroll — calculation and create mapping

`FolhaPagamentoFormModal.tsx` computes `salario_liquido = bruto - descontos + bonus` **entirely
client-side** (lines 57-60 per direct confirmation); the backend performs **no server-side recompute or
validation** of this arithmetic — `HrService.createPayroll()` simply stores whatever
`salario_liquido` string value the client sends verbatim. Classified `CALCULATION_MISMATCH`-adjacent
`REAL_MAPPING_GAP`: even leaving aside that the create call itself is rejected (§0.2), a client capable
of bypassing the UI (or a future fixed client) could submit an arbitrary, arithmetically-inconsistent
`salario_liquido` and the backend would accept it unquestioned. `bonus` (sent by the form) has no DTO
field and no entity column at all — it is silently discarded even in a hypothetical world where the
rest of the payload matched.

No `PATCH`/`DELETE` endpoint exists for `payroll_entries` at all — confirmed directly from
`hr.controller.ts` (only `GET`/`POST` under the Payroll section). `RH.tsx` nonetheless wires up full
update/delete mutations for payroll rows (`useFolhaPagamento` exposes them, mirroring the generic
`useDataQuery` CRUD shape) — any attempt to edit or delete an existing payroll entry through the UI
would hit a route that doesn't exist server-side (404), a `REAL_MAPPING_GAP` distinct from, but as
severe as, the create-path break.

## 7. Leave requests — approve-only workflow, no reject

`HrController` exposes exactly one status-changing route: `PATCH /hr/leave-requests/:id/approve`, which
`HrService.approveLeaveRequest()` **hardcodes** to `status: 'aprovado'` unconditionally — there is no
parameter, no branch, no way to set `rejeitado` server-side at all. `RH.tsx` nonetheless renders a
"Reject" action (`handleApproveReject(fa, "rejeitado")`, confirmed present) that calls the same
`.../approve` endpoint or an update mutation with no matching route — either path fails (the endpoint
ignores any intended target status, or a generic `PATCH /hr/leave-requests/:id` is called that doesn't
exist, 404). Classified `WORKFLOW_GAP: PARTIAL` — the concept of a 4-value `LeaveRequestStatus`
(`pendente|aprovado|rejeitado|concluido`) exists in the type system and is rendered in the UI, but only
one of its transitions (`pendente → aprovado`) is server-reachable; there is no real state machine
(no `apps/api/src/core/workflow/definitions/` entry exists for leave requests or employees at all —
confirmed: only `campaigns`/`contracts`/`leads`/`projects`/`releases`/`tickets` have workflow
definitions).

## 8. Employee ≠ User — identity boundary

Confirmed by direct schema inspection: `EmployeeEntity` has **no FK to any user/auth entity**. Real
platform identity lives in `OrgMemberEntity` (`entities.ts:110-138`, keyed by `auth_user_id`, with its
own unrelated `department_id`/`position_id` pair for the platform RBAC system — a different, unrelated
concept from HR's free-text `departamento`/`cargo`). The only attempted linkage is the physical (but,
per §1, TypeORM-undeclared) `employees.vinculo_usuario_id varchar(64)` column, wired up purely
client-side in `FuncionarioFormModal.tsx` ("Vincular a Usuário do Sistema", an optional dropdown sourced
from `useUsuarios()`) — a soft, display-only string with no DB constraint, and since it round-trips as
`undefined` from the real API (entity doesn't declare it) regardless of whether the create request even
succeeded, this "link an employee to their login" feature is doubly non-functional (unreachable via
create, and unreadable via list even if it somehow existed in the DB from a raw-SQL seed).
`rh` is registered as its own distinct permission resource (`permission-map.ts`, module `rh` →
backend resource `rh`) — appropriately separate from user/auth permissions.

## 9. Status — `EmployeeStatus` enum mismatch

Backend `EmployeeStatus` (`packages/types/src/enums.ts`): `ativo | inativo | ferias | licenca |
demitido`. Frontend `STATUS_FUNCIONARIO` (`useFuncionarios.ts:28-34`, confirmed directly): `ativo |
inativo | férias | afastado | desligado` — a **different value set**: accented `"férias"` (backend has
unaccented `"ferias"`), and `"afastado"`/`"desligado"` where the backend has `"licenca"`/`"demitido"`.
`CreateEmployeeDto.status` is `@IsEnum(EmployeeStatus)`-validated — any of the three divergent frontend
values, if ever sent, would be rejected on enum grounds **independently of and in addition to** the
`nome`/`nome_completo` break already blocking the whole request. Classified `ENUM_MISMATCH`. No workflow
engine governs these transitions (§7's `NOT_PRESENT` finding extends to employees too) —
`STATUS_WORKFLOW: FIELD_ONLY`, not `REAL_WORKFLOW`.

`PayrollStatus` (`pendente|processado|pago|cancelado`) and `LeaveRequestStatus` (`pendente|aprovado|
rejeitado|concluido`) were not found to have an equivalent frontend/backend value-set mismatch (the
leave-request gap is a *route*-availability problem, §7, not a value-naming one).

## 10. `Auditoria.tsx` — RH section

`AUDITORIA_TSX_RH_SECTION_COMPLETE: SIM` — section confirmed present (`runner.ts`, module `"rh"`, table
`"funcionarios"`):

```
fields:
  nome_completo — obrigatorio
  email         — obrigatorio
  cpf           — recomendado
  telefone      — recomendado
  cargo         — recomendado
```

**Direct, doubly-confirmed consequence of §1**: since `GET /hr/employees` never returns `nome_completo`
(the entity doesn't declare the column) regardless of whether any data exists for it in the physical
table, this completeness rule will flag **every employee in the system, unconditionally, as "Funcionário
sem nome"** — not a data-quality signal, a structural blind spot in the auditor itself, inherited
directly from the same entity/column gap that already breaks the main list view.

## 11. Tenant Isolation & Permissions

Every `HrController` endpoint carries `@RequireRole` (viewer/manager/manager/manager/admin for
employees; manager throughout for payroll; viewer/editor/manager for leave requests) — appropriately
tiered, not decorative. Every `HrService` method includes an explicit `tenant_id` predicate in its
query/update (`listEmployees`, `_findRaw`, `createEmployee`, `updateEmployee`, `softDeleteEmployee`,
`listPayroll`, `createPayroll`, `listLeaveRequests`, `createLeaveRequest`, `approveLeaveRequest` — all
confirmed directly). `AUTHORIZATION_GAPS: 0`. `TENANT_ISOLATION_GAPS: 0` — this module's security
posture is sound even though its functional CRUD is broken; the two are independent axes, confirmed
separately.

## 12. PII / Encryption

`email`, `telefone`, `cpf` are genuinely column-encrypted (`email_encrypted`/`telefone_encrypted`/
`cpf_encrypted`, real `EncryptionService.encryptNullable`/`decryptNullable` calls in `HrService`) —
consistent with the same real, deliberate encryption pattern confirmed for `artists`/`clients` in the
`reports.md` audit. This part of the module is well-engineered — the encryption layer itself is not
implicated in any of the CRUD-breaking bugs above (the requests fail validation *before* reaching this
code, per §0). `rg`, `data_nascimento`, `endereco` (sent by the form, not in the DTO/entity at all) have
**no encryption treatment either way** since they never persist.

## 13. File uploads (HR documents)

The underlying binary upload is **real**: `RH.tsx`'s Documentos tab uses `useUploadToR2` (genuine
Cloudflare R2-backed upload component, `folder="documentos-rh"`) — the file itself genuinely reaches
storage. What's broken is entirely the **metadata layer** around it (§0.4): the record meant to say
"this R2 object belongs to employee X, is named Y, has type Z" is never persisted, because its create
call is misrouted to `/hr/employees` and rejected by `CreateEmployeeDto`. Net effect: files may
accumulate in R2 storage with no corresponding, queryable database record connecting them to any
employee — an orphaned-upload pattern, distinct from (and arguably worse than) the fake/stub upload
patterns found in `projects.md`/`musicchat.md`, since here real storage cost is incurred for
data that can never be retrieved through the product.

## 14. Truncation, Search, Filter, Sort

Same systemic `limit=50` default pattern as every other module this session (`listEmployees`/
`listPayroll`/`listLeaveRequests` all default `take(query.limit ?? 50)`); frontend hooks send no
override. `TRUNCATION_GAP: 1` (applies uniformly across all three list endpoints). Search/filter for
employees are additionally, independently non-functional per §1 (filtering/searching a field that's
always `undefined`) — a `DISPLAY_MAPPING_MISMATCH`/`REAL_MAPPING_GAP` layered on top of, not caused by,
the truncation pattern.

## 15. Gap taxonomy summary

| Gap type | Count | Detail |
|---|---|---|
| CREATE_MAPPING_MISMATCH | 3 | employees (§0.1), payroll (§0.2), leave requests (§0.3) — all critical |
| EDIT_MAPPING_MISMATCH | 1 | employees, same root cause (§5) |
| DATABASE_COLUMN_ONLY | 8 | `employees` physical columns invisible to the entity/API (§1) |
| REAL_MAPPING_GAP | 4 | documents misrouted to `/hr/employees` (§0.4); payroll update/delete routes don't exist (§6); leave-request reject unreachable (§7); `vinculo_usuario_id` doubly-broken (§8) |
| ENUM_MISMATCH | 1 | `EmployeeStatus` frontend/backend value-set divergence (§9) |
| WORKFLOW_GAP | 1 | leave requests: PARTIAL, only one of 4 statuses server-reachable, no real state machine for either leave requests or employees (§7, §9) |
| DISPLAY_MAPPING_MISMATCH | 1 | employee list table renders blank name/sector/salary/user-link for every row (§1) |
| CALCULATION_MISMATCH-adjacent | 1 | payroll net-salary math is client-computed only, no server validation (§6) |
| STORAGE_GAP | 1 | orphaned R2 uploads with no retrievable metadata record (§13) |
| TRUNCATION_GAP | 1 | systemic `limit=50`, applies to all 3 list endpoints (§14) |
| AUTHORIZATION_GAP | 0 | confirmed sound (§11) |
| TENANT_ISOLATION_GAP | 0 | confirmed sound (§11) |

`UNMAPPED_*: 0` — every field's origin/destination was successfully traced, even though nearly all
traces terminate in "request rejected" or "column invisible to the application layer."
`UNKNOWN_FIELD_CLASSIFICATIONS: 0`.

## 16. Overall assessment

This module ties with (and arguably exceeds) `releases.md` for the most severely broken CRUD surface
found this session — but where `releases` had one precise, single-field root cause blocking create/edit,
`rh` has **four independent field-mapping breaks** (one per sub-resource) **plus** a structurally
separate entity/physical-table drift that independently breaks the read/list/search/filter path even
before considering writes. Every one of its four tabs (Funcionários, Folha de Pagamento, Férias e
Ausências, Documentos) is confirmed non-functional for its primary create action through the real UI
today. Tenant isolation, authorization, and the PII-encryption layer are, independently, all sound —
this is a pure field-contract/entity-declaration problem, not a security problem.

## Contadores finais (Zero-Gap)

```
MODULE_STATUS: COMPLETE
RH_DOMAIN_MEANING: internal HR/employee records management (funcionários, folha de pagamento, férias/
  ausências, documentos) — Employee is structurally distinct from platform User/OrgMember, no FK exists
SUBDOMAINS_AUDITED: 4
COMPONENTS_AUDITED: 5
HOOKS_AUDITED: 4
CREATE_MAPPING_MISMATCH: 3 (CRITICAL — employees, payroll, leave requests)
EDIT_MAPPING_MISMATCH: 1 (CRITICAL — employees, same root cause)
DATABASE_COLUMN_ONLY: 8 (employees physical columns invisible to entity/API)
REAL_MAPPING_GAP: 4 (documents misrouting, payroll update/delete missing routes, leave-request reject
  unreachable, vinculo_usuario_id doubly-broken)
ENUM_MISMATCH: 1 (EmployeeStatus frontend/backend divergence)
WORKFLOW_GAPS: 1 (leave requests PARTIAL; no real workflow engine for employees or leave requests)
DISPLAY_MAPPING_MISMATCH: 1 (list table renders blank for every employee row)
STORAGE_GAPS: 1 (orphaned R2 uploads, unrecoverable metadata)
TRUNCATION_GAPS: 1 (systemic limit=50 across all 3 list endpoints)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
PERMISSIONS_AUDITED: 10 endpoint-role pairs
AUDITORIA_TSX_RH_SECTION_COMPLETE: SIM
EMPLOYEE_USER_IDENTITY_LINK: NOT_IMPLEMENTED (display-only string, no FK, unreadable via API regardless)
UNMAPPED_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: settings
