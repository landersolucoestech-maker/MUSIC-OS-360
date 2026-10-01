> Historical record. Kept as recorded; not the current contract.

# Module `inventory` — Zero-Gap Audit (Phase 2, Prompt 107)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

Real scope (smaller than the previous modules — confirmed by complete tracing, not by
assumption): 1 physical table (`inventory_items`, 19 columns), 1 controller/service/DTO in the backend, 1
page + 2 modals + 1 real hook in the frontend. No `stock_movements`, `warehouses`,
`locations`, `reservations`, `loans`, `maintenance_records`, `suppliers` or `barcodes` table exists in the
database (confirmed via `database-backend-column-mapping.json` — a search for `inventor|equipment|
asset|stock|warehouse|movement|loan|maintenance|reservation|supplier|barcode` only returned
`inventory_items` as a table of this module's domain; the other `*_assets` tables belonging to
`audiovisual`/`marketing`/`projects`/`tasks` already belong to other domains, not re-audited here).

---

## 1. Real subdomains identified

| Subdomain | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES |
|---|---|---|---|---|---|
| ITEM | `Inventario.tsx`, `InventarioFormModal.tsx`, `InventarioViewModal.tsx` | `GET/POST/PATCH/DELETE /inventory` | `inventory.controller.ts` | `inventory.service.ts` | `inventory_items` |

**Only 1 real subdomain.** `CATEGORY` (it is not an entity — it is a free string validated only
by a `<Select>` of hardcoded options in the form, with no table of its own), `STOCK`/`MOVEMENT`/
`LOCATION`/`WAREHOUSE`/`RESERVATION`/`LOAN`/`MAINTENANCE`/`SUPPLIER`/`PURCHASE`/`ATTACHMENT` — all
**NOT_IMPLEMENTED** as entities/subdomains of their own (see sections 12-26 for the details of
each one, with specific evidence of absence).

---

## 2. `Auditoria.tsx` — CROSS_MODULE_AUDITORIA_TSX

Real tool (the same one already audited in all the previous modules): entry `module: "inventory"`,
`table: "inventario"` in `apps/web/src/shared/lib/audit/runner.ts:157-170`.

`AUDITORIA_INVENTORY_FIELDS`:

| Field | Severity |
|---|---|
| `nome` | `obrigatorio` |
| `categoria` | `obrigatorio` |
| `status` | `obrigatorio` |
| `valor` | `recomendado` |
| `localizacao` | `recomendado` |

`AUDITORIA_INVENTORY_RULES`: the same generic engine (`hasValue()`) used in all modules already
audited — no additional rule specific to `inventory`. `fixPath`: `editPath("/inventario",
row)` → `/inventario?edit=<id>`.

`AUDITORIA_INVENTORY_DATABASE_SOURCES`: `storage.list("inventario")` → `GET /inventory` (via
`api-client.ts:85`, `inventario: "/inventory"`) — the same real endpoint used by the rest of the module.

`AUDITORIA_INVENTORY_GAPS` (2, confirmed by reading the code):

1. **Recommended field always "missing"**: the Audit checks `row.valor`, but the real column and
   the real DTO/response field is `valor_unitario` (confirmed in `database-backend-column-mapping.
   json` and in `inventory.dto.ts`) — `row.valor` is always `undefined`, so every item with a genuinely
   filled-in unit value still appears with "Valor" (Value) as recommended-missing in the Audit.
2. **Deep link with no handler**: `fixPath` points to `/inventario?edit=<id>`, but `Inventario.tsx`
   does not implement any `useSearchParams`/query-string handling (confirmed by a full reading
   of the file, 256 lines) — the same broken deep-link pattern already confirmed in
   `events.md`/`crm-relationships.md` for other modules.

`AUDITORIA_TSX_INVENTORY_SECTION_COMPLETE: SIM` (yes).

---

## 3. Components (complete classification)

| Component | Classification | Note |
|---|---|---|
| `InventarioFormModal.tsx` | CREATE_MODAL + EDIT_MODAL | 427 lines, the only form; **create** mapping correct and complete; **edit** mapping (prefill) with a real bug — see §8 |
| `InventarioViewModal.tsx` | DETAIL_MODAL | 123 lines, defensive reading (`item.local ?? item.localizacao`, `item.valorUnitario ?? item.valor_unitario ?? item.valorUnit`) — more robust than the main table |
| `Inventario.tsx` | TABLE + FILTER + SEARCH + SORT(client, see §31) + STATIC(metrics) | the only page, 256 lines |
| `hooks/inventory.store.ts` | DEAD | Zustand store, zero consumers outside its own file (the same pattern already seen in `events.md`/`catalog.md`) |
| `services/inventory.service.ts` | DEAD | zero consumers — the real page uses `useInventario()` directly |
| `constants/index.ts`, `forms/index.ts`, `schemas/index.ts`(barrel), `utils/index.ts` | STATIC (stub) | empty folders, the same scaffold pattern already seen in all the previous modules |
| `store/index.ts`, `store/inventory.store.ts` | DEAD | a re-export/duplicate of `hooks/inventory.store.ts`, also zero consumers |

There is no `RELATION_SELECTOR`/`CATEGORY_SELECTOR`(structured)/`LOCATION_SELECTOR`(structured)/
`SUPPLIER_SELECTOR`/`QUANTITY_CONTROL`(dedicated, beyond the `<Input type="number">`)/`STOCK_BADGE`/
`MOVEMENT_UI`/`RESERVATION_UI`/`LOAN_UI`/`MAINTENANCE_UI`/`UPLOAD`/`IMPORT`/`EXPORT`(page
level)/`BARCODE_UI`/`QR_UI`/`REALTIME_CONSUMER` — none of these components exists in this module
(confirmed by a full reading of all the files in the directory).

---

## 4. Hooks

| HOOK | FILE | SUBDOMAIN | ENDPOINTS | READ/WRITE | REALTIME | TENANT_DEP |
|---|---|---|---|---|---|---|
| `useInventario` | `hooks/useInventario.ts` | ITEM | `GET/POST/PATCH/DELETE /inventory` (via `useDataQuery`/`storage`, `table: "inventario"`) | full list read + create/update/delete | no | implicit (`CurrentTenant()` in the backend) |

**1 active hook, fully classified.** No dedicated `QUANTITY_FIELDS` (quantity is just another
field of the object, not a sub-hook of its own), no `MOVEMENT_USAGE` (there is no concept of a
movement), no `STORAGE_USAGE`.

---

## 5. CREATE ITEM — field-by-field mapping

`InventarioFormModal.tsx::onSubmit` builds the payload explicitly (lines 146-159), CORRECTLY mapping
the form's internal names (camelCase, used only inside `react-hook-form`) to
the real API/DB names (snake_case):

| FORM_FIELD (internal) | LABEL | TYPE | REQUIRED | API_REQUEST_FIELD | DATABASE_COLUMN | PERSISTED |
|---|---|---|---|---|---|---|
| `nome` | "Nome do Item" (Item name) | string | yes (zod `.min(1)`) | `nome` | `inventory_items.nome` | yes |
| `categoria` | "Categoria" (Category) | select (9 fixed options) | no | `categoria` | `.categoria` | yes |
| `quantidade` | "Quantidade" (Quantity) | number | yes in the UI (zod `.min(1)`; the backend accepts `.min(0)` — see Gap #6) | `quantidade` | `.quantidade` | yes |
| `localizacao` | "Localização" (Location) | free string | no | `localizacao` | `.localizacao` | yes |
| `responsavel` | "Responsável" (Responsible person) | free string | no | `responsavel` | `.responsavel` | yes |
| `status` | "Status" | select (6 options in the form — see Gap #5, ENUM_MISMATCH) | yes (zod enum) | `status` | `.status` | yes |
| `setor` | "Setor" (Sector) | select (16 fixed options) | no | `setor` | `.setor` | yes |
| `localCompra` | "Local de Compra" (Place of purchase) | free string | no | `local_compra` | `.local_compra` | yes |
| `numeroNotaFiscal` | "Número da Nota Fiscal" (Invoice number) | free string | no | `numero_nota_fiscal` | `.numero_nota_fiscal` | yes |
| `dataEntrada` | "Data de Entrada" (Entry date) | date picker | no (default: today) | `data_entrada` | `.data_entrada` | yes |
| `valor_unitario` | "Valor Unitário (R$)" (Unit value) | number | no | `valor_unitario` | `.valor_unitario` | yes |
| `observacoes` | "Observações" (Notes) | textarea | no | `observacoes` | `.observacoes` | yes |
| "Valor Total" (Total value) | "Valor Total (Calculado)" (Total value, calculated) | derived (`quantidade × valor_unitario`, `useMemo`) | — | **never sent** | no column of its own | **UI_ONLY/DERIVED** — computed only for display, not persisted (there is no `valor_total`/`current_value` column in the database) |

**All 12 real fields of the create form are correctly mapped and persisted** — the
`onSubmit` already converts to the correct snake_case names. `CREATE_FIELDS: 12` (11 domain
fields + status).

---

## 6. EDIT ITEM — Create ≠ Edit (real bug confirmed)

The same component (`mode: "create"|"edit"|"view"`), but the form's **prefill** in edit
mode (the `useEffect` that calls `reset({...})` when `item` is passed, lines 108-121) reads the fields
of the `item` object (the real API response) using the SAME internal camelCase NAMES that the form
uses for itself, instead of the real names returned by the API:

```js
reset({
  ...,
  localCompra:       item.localCompra || "",        // real API returns item.local_compra
  numeroNotaFiscal:  item.numeroNotaFiscal || "",    // real API returns item.numero_nota_fiscal
  dataEntrada:       item.dataEntrada || <today>,    // real API returns item.data_entrada
});
```

**EDIT_MAPPING_MISMATCH confirmed**: `item.localCompra`, `item.numeroNotaFiscal` and `item.dataEntrada`
are always `undefined` in the real response of `GET /inventory/:id` (which returns `local_compra`/
`numero_nota_fiscal`/`data_entrada`) — when an existing item is opened for editing, these 3 fields
**always appear empty/with the default value**, even if the item has this data genuinely
persisted in the database. If the user saves the edit without noticing and without filling them in again, the
`onSubmit` sends `undefined` for these 3 fields (which the `PATCH` would treat as "do not change", since
`UpdateInventoryItemDto extends PartialType(...)` and the backend only updates what comes in the DTO) — in
practice the data is NOT erased in the database (a partial PATCH preserves the old value), but the UI shows the
user an incorrect/incomplete edit form, which may lead them to retype a value
different from the original without realizing one already existed.

The other 9 fields (`nome`, `categoria`, `quantidade`, `localizacao`, `status`, `responsavel`,
`setor`, `valor_unitario`, `observacoes`) use the SAME name in the form and in the API — correct prefill
for those.

`EDIT_FIELDS: 12` (the same 12 as create). `IMMUTABLE_AFTER_CREATE: no field` (all editable).
`DATABASE_MAPPING`: identical to create for the 12 fields (the divergence is only in the READ used to
populate the form, not in the write).

---

## 7. Item identification

| FIELD | DATABASE_COLUMN | UNIQUE | GENERATED_OR_MANUAL | VALIDATION | NORMALIZATION | SEARCH_USAGE |
|---|---|---|---|---|---|---|
| `id` | `id` (uuid) | yes (PK) | GENERATED (`gen_random_uuid()`) | — | — | no (not searchable by the user) |
| `nome` | `nome` | **NO** (no UNIQUE constraint in the database, confirmed in Phase 1) | MANUAL | `@IsString @MaxLength(255)` (backend), `.min(1).max(150)` (frontend — **DEFAULT_MISMATCH**: a limit of 150 in the frontend vs. 255 in the backend; the frontend is more restrictive, it is not a functional bug but it is a real rule divergence) | `.trim()` only in the frontend (zod) | yes — search by name (`ILIKE`, backend; `.includes()`, frontend) |

**No SKU, internal code, barcode, QR code, serial number, model or brand exists** in
any layer (schema, DTO, form) — `nome` is the item's only human identifier, with no
normalization/automatic generation, with no guaranteed uniqueness (two items can have exactly the
same `nome`, without warning).

---

## 8. Categories

There is no categories entity/table — `categoria` is a free `character varying` column in
`inventory_items`, validated in the form only by a `<Select>` with 9 options hardcoded in the
component (`categoriasOptions`, lines 43-53 of `InventarioFormModal.tsx`): "Áudio", "Computador",
"Escritório", "Estrutura", "Iluminação", "Mobília", "Software", "Vídeo", "Outros" (Audio, Computer,
Office, Structure, Lighting, Furniture, Software, Video, Other). No hierarchy (no
`parent_id`), no `CATEGORY_ID` of its own, no description, no status.

```text
CREATE:   via a <Select> of the 9 fixed options (does not allow typing a free category — the backend would accept
          any string, but the only real UI restricts it to the 9)
EDIT:     the same <Select>
DISPLAY:  simple Badge (`item.categoria`)
FILTER:   dropdown on the main page with 5 options (áudio/vídeo/computador/iluminação/estrutura —
          a SUBSET of the form's 9; "Escritório"/"Mobília"/"Software"/"Outros" never
          appear as a filter option, even though they are selectable at creation — a minor
          REAL_MAPPING_GAP, an item created with these 4 categories can never be isolated via the
          category filter, only via text search)
RELATION: none (free string, no FK)
DATABASE_MAPPING: `inventory_items.categoria` (DIRECT)
```

`CATEGORY_FIELDS: 1` (the `categoria` column itself).

---

## 9. Quantity / Stock

| FIELD | DATABASE_COLUMN | TYPE | DEFAULT | DERIVED_OR_PERSISTED | UPDATE_SOURCE |
|---|---|---|---|---|---|
| `quantidade` | `quantidade` (integer) | integer | `0` (database) / `1` (frontend, in the form) | PERSISTED | directly overwritten by the absolute value typed in the form on every create/update |

`available_quantity`, `reserved_quantity`, `minimum_quantity`, `maximum_quantity`,
`damaged_quantity`, `in_use_quantity` **do not exist** — only the single `quantidade` column, a simple counter,
with no subdivision at all. `QUANTITY_FIELDS: 1`.

---

## 10. Stock rule

```text
STOCK_MODEL: QUANTITY_SNAPSHOT

The balance (`quantidade`) is an absolute value stored directly on the item's row, overwritten on
every PATCH with the value the user types in the form — there is NO ledger of movements
(entries/exits) from which the balance would be derived by summation. There is no calculation formula
(INITIAL + ENTRIES - EXITS ...) because there is no history of stock transactions — only the current
state, decided by the user on each edit.
```

---

## 11. Movements

**Not implemented.** No `inventory_movements`/`stock_movements` table exists in the database
(confirmed in Phase 1), no movement endpoint exists in `InventoryController`
(`GET/POST/PATCH/DELETE /inventory` are the only 4 routes), no UI component for
entry/exit/transfer/adjustment was found. `status: "em_uso"`/`"manutencao"`/etc. is merely
a label field on the item's own row — it does not generate any associated movement record.
`MOVEMENT_FIELDS: 0`. `MOVEMENT_TYPES: 0`.

---

## 12. Stock transaction / Concurrency

```text
MOVEMENT_CREATED: NOT_APPLICABLE (movements do not exist)
QUANTITY_UPDATED: YES — via a single-row UPDATE (`inventory.service.ts::update()`,
       `this.repository.update({id, tenant_id}, {...dto, updated_at, updated_by})`)
SAME_TRANSACTION: NOT_APPLICABLE (there is no second write — "movement" and "new balance" are the
       same single UPDATE)
STOCK_CONSISTENCY_GAP: not applicable in the sense of "balance diverging from history" (there is no
       history to diverge from) — but see INVENTORY_HISTORY_GAP below (§18) for the
       corresponding auditability finding.

CONCURRENCY_CONTROL: NONE — `update()` writes the value of `quantidade` (and the other fields) as
       it came in the `dto`, with no version check (no optimistic `updated_at`/`version`) and no explicit
       row lock. If two users open the same item simultaneously with different
       `quantidade` values in mind and both save, the last `PATCH` to arrive silently
       wins (last-write-wins) — a real STOCK_CONCURRENCY_GAP, but of the same generic risk class
       as any simple CRUD form without optimistic locking (it is not a failure
       specific to a "high-frequency mutable balance" as in a real stock system with
       continuous movement, given that here the change is always manual, via a form).
```

---

## 13. Negative balance

```text
NEGATIVE_STOCK_ALLOWED: NO
BACKEND_ENFORCEMENT: YES — `@Min(0)` on `CreateInventoryItemDto.quantidade` (class-validator)
DATABASE_ENFORCEMENT: NO — the `quantidade` (integer) column has no CHECK constraint (confirmed in
       Phase 1, `check_constraint: []`) — the protection exists only in the HTTP validation layer, not in the
       schema
FRONTEND_ENFORCEMENT: YES, but more restrictive — zod requires `.min(1)` (does not even allow 0), while the
       backend allows 0 — a real DEFAULT_MISMATCH (it does not prevent the user from operating, only the
       frontend is stricter than the back end on this specific point; not classified as a functional
       bug, since no real path tries to send 0 today)
```

---

## 14. Reservations, Loans, Maintenance

**All NOT_IMPLEMENTED as an entity/flow of their own** — confirmed by the absence of any table
(`reservations`/`loans`/`maintenance_records`) and of any dedicated endpoint/component.

```text
RESERVATION_FIELDS: 0 (the value "reservado" exists in the BACKEND status enum — see §16 — but there
       are no reservation FIELDS (who reserved, quantity reserved, period) beyond the status label
       itself; and that "reservado" value is not even offered by the real UI, see the enum Gap below)
LOAN_FIELDS: 0 (the value "emprestado" exists only in the FRONTEND — zod schema and shared type — but,
       for the same reason, there are no loan fields (borrower, checkout_at, expected_return_at,
       returned_at) — it is only a status label, and the backend does not even accept that value, see Gap #5)
MAINTENANCE_FIELDS: 0 (the same reasoning for "manutencao" — present in all 3 enum layers, but with
       no maintenance field (type, description, scheduled date, cost, supplier) beyond the
       status label)
```

`STATUS` works, in practice, as a free "current item situation" label without any of the
business flows (create reservation, create loan, schedule maintenance) that the value names
suggest — changing an item's status to "manutencao" triggers no side effect, creates
no record, blocks no action.

---

## 15. Status / Condition — ENUM_MISMATCH confirmed (3 divergent vocabularies)

| Layer | Source | Values |
|---|---|---|
| Backend DTO (`@IsIn`, validates the real write) | `apps/api/src/modules/inventory/dto/inventory.dto.ts:6` | `disponivel`, `em_uso`, `manutencao`, `descartado`, **`reservado`** |
| Frontend Zod (`inventarioSchema`, validates the form) | `apps/web/src/modules/inventory/schemas/inventario-schema.ts:21` | `disponivel`, `em_uso`, **`emprestado`**, `manutencao`, **`danificado`**, `descartado` |
| Shared type (`InventarioStatus`) | `apps/web/src/shared/types/enums.ts:281` | `disponivel`, `em_uso`, `manutencao`, `descartado`, **`emprestado`** |

None of the 3 lists is identical to the other two. Confirmed practical effect: `InventarioFormModal.tsx`
offers 6 options in the UI (`statusOptions`, lines 55-62) — the same 6 as the Zod schema — including
**`emprestado`** and **`danificado`**, neither of which the backend's `@IsIn(STATUSES)` accepts.
**Selecting "Emprestado" (On loan) or "Danificado" (Damaged) in the form and saving results in HTTP 400** (a
NestJS `ValidationPipe` validation rejection) — a real bug that the user can trigger through the normal UI
flow. Conversely, `reservado` (accepted by the backend) is never offered on any screen — an item
cannot be put into that status through the real UI.

```text
FRONTEND_LABEL → FRONTEND_VALUE → BACKEND_ACCEPTS?
Disponível      → disponivel      → YES
Em Uso          → em_uso          → YES
Emprestado      → emprestado      → NO (400)
Em Manutenção   → manutencao      → YES
Danificado      → danificado      → NO (400)
Descartado      → descartado      → YES
(no label)      → reservado       → N/A (never offered by the UI)
```

`FILTER_USAGE`: the status filter on the main page (`statusFilter`) only offers 3 of the form's 6 options
(`em-uso`/`disponivel`/`manutencao` — neither "emprestado"/"danificado"/"descartado" are
filterable via the dropdown, only via indirect text search, which does not cover status either).

`TRANSITIONS`: no state transition rule — any status can be chosen at any
time (the same absence of a workflow already confirmed in other simple modules of this series).

---

## 16. Location / Warehouse

`localizacao` is a single free-text `character varying` column — **it is not a structured
entity**. `warehouse`/`room`/`shelf`/`bin`/`address` do not exist as fields or tables
of their own. The only "structured location" artifact is illusory: the `localFilter` filter on the
main page (`Inventario.tsx:61-65`) compares `item.localizacao` against 4 hardcoded EXACT
strings ("Estúdio 1", "Estúdio 2", "Escritório", "Estoque"), while the form field is a
free-text `<Input>` with an example placeholder ("Ex: Estúdio A, Sala 201, Depósito") — that is,
the filter assumes a fixed taxonomy that the creation UI does not impose. An item registered with
`localizacao: "Estúdio A"` (exactly the placeholder's own example) **never appears** when
filtering by "Estúdio 1" or by any of the 4 options — REAL_MAPPING_GAP confirmed; the location
filter is structurally almost dead for real, freely typed data.

```text
FRONTEND_FIELD: localizacao (free text)
API_FIELD: localizacao
DATABASE_RELATION: none (a simple column, no FK)
CARDINALITY: N/A
TENANT_SCOPE: inherited from the item's row (tenant_id of the inventory_items table)
```

`LOCATION_FIELDS: 1`.

---

## 17. Transfers

**NOT_IMPLEMENTED.** No field, endpoint or component for transferring an item between locations was
found — changing an item's "location" is just editing the free-text field via the same
generic edit form, with no concept of a "transfer" (origin/destination/approval)
distinct from an ordinary edit.

---

## 18. Costs

| FIELD | DATABASE_TYPE | PRECISION/SCALE | CURRENCY | SOURCE | ACCOUNTING_RELATION |
|---|---|---|---|---|---|
| `valor_unitario` | `numeric` (no precision/scale fixed in the schema, confirmed in Phase 1) | generic (unrestricted Postgres `numeric`) | implicit — BRL (`pt-BR` formatting/`formatCurrency`), no currency column | manual, typed in the form | none (see §19) |

`current_value`/`replacement_value`/`maintenance_cost`/`purchase_cost` (as fields distinct from
`valor_unitario`) **do not exist** — the "Valor Total" (Total value) displayed in the UI (form and page) is always a
client-side calculation (`quantidade × valor_unitario`), never a persisted column. `FINANCIAL_FIELDS: 1`
(`valor_unitario`).

---

## 19. Inventory ↔ Accounting

**NOT_IMPLEMENTED.** No automatic or manual propagation was found between `inventory_items`
and `transactions`/`invoices` (the `accounting` module, already audited, not reopened here) — even though the
fields `valor_unitario`, `local_compra` and `numero_nota_fiscal` strongly suggest a purchase
record, there is no "Lançar como despesa" (Record as expense) button/no `@OnEvent`/no service call
crossing the two modules (confirmed by a full reading of `inventory.service.ts`, which emits
no domain event, and by a search for consumers of `InventoryItemEntity`/`inventory_items`
outside the module itself — no result in `apps/api/src` beyond the expected ones: entities.ts,
migrations, and the generic reports/RLS modules).

```text
INVENTORY_ACTION: create/edit an item with valor_unitario filled in
FINANCIAL_RESOURCE: none
DATABASE_RELATION: none
CLASSIFICATION: NOT_IMPLEMENTED (neither MANUAL_ONLY nor UI_ONLY — there is not even a manual path to
       record the purchase as a transaction from the inventory item; the user would need to
       create the transaction completely independently in the `accounting` module)
```

---

## 20. Suppliers

**There is no real relation with the CRM/suppliers.** `local_compra` is a free-text `character varying`
column (e.g. "Loja de Música ABC", per the form's own placeholder) — there is no
`supplier_id`, there is no supplier `<Select>`, there is no link to the `clients` table (already audited
in `crm-relationships.md`, not reopened here). Consistent with the prompt's instruction not to invent
a nonexistent relation — confirmed that it genuinely does not exist.

---

## 21. Projects / Audiovisual / Events

**No relation found.** An exhaustive search for `InventoryItemEntity`/`inventory_items` outside the
`inventory` module itself (backend) and for `useInventario`/`modules/inventory` outside the
module itself (frontend) found no consumer in `projects`, `audiovisual` or `events` — inventory
items cannot be allocated/reserved for a project, audiovisual production or event in
any layer of the system today.

---

## 22. Ownership / Assignment

`responsavel` is a free-text `character varying` column (a typed name, not an FK to
`users`/`employees`) — it is not a structured assignment with cardinality/start/end, it is just a
text label. No other assignment field (to an artist, team, project, event, structured
location) exists.

---

## 23. Tables/Grids — column traceability

| SCREEN | COLUMN_LABEL | COLUMN_KEY | API_FIELD | DATABASE_COLUMN | DERIVED | SORTABLE | FILTERABLE | SEARCHABLE |
|---|---|---|---|---|---|---|---|---|
| Inventario.tsx | (checkbox) | — | — | — | UI_ONLY | no | no | no |
| Inventario.tsx | "Nome" (Name) | `nome` | `nome` | `inventory_items.nome` | no | no (see §31) | no | yes |
| Inventario.tsx | "Categoria" (Category) | `categoria` | `categoria` | `.categoria` | no | no | yes | yes |
| Inventario.tsx | "Setor" (Sector) | `setor` | `setor` | `.setor` | no | no | no | no |
| Inventario.tsx | "Localização" (Location) | `localizacao` | `localizacao` | `.localizacao` | no | no | yes (see Gap §16) | yes |
| Inventario.tsx | "Responsável" (Responsible person) | `responsavel` | `responsavel` | `.responsavel` | no | no | no | no |
| Inventario.tsx | "Status" | `status` | `status` | `.status` | no | no | yes | no |
| Inventario.tsx | "Qtd." (Qty.) | `quantidade` | `quantidade` | `.quantidade` | no | no | no | no |
| Inventario.tsx | "Valor Unit." (Unit value) | `valor_unitario` | `valor_unitario` | `.valor_unitario` | no | no | no | no |
| Inventario.tsx | "Valor Total" (Total value) | (derived) | — | — | **DERIVED** (`valor_unitario × quantidade`, client-side) | no | no | no |
| Inventario.tsx | "Entrada" (Entry) | `dataEntrada` | **`data_entrada`** (real) | `.data_entrada` | no | no | no | no | **DISPLAY_MAPPING_MISMATCH confirmed**: the column reads `item.dataEntrada` (camelCase), which is always `undefined` in the real API response — the "Entrada" column **always displays "—"**, even for items with a genuinely filled-in `data_entrada` |

No visible column was left without a source — 10 of 11 data columns map correctly; 1
("Entrada") has a real source (`data_entrada`) but the code reads the wrong name.

---

## 24. Details (InventarioViewModal.tsx)

| DISPLAY_LABEL | DISPLAY_FIELD (read) | Real API_FIELD | Status |
|---|---|---|---|
| "Nome"/"Categoria" (Name/Category) (header) | `item.nome`/`item.categoria` | `nome`/`categoria` | correct |
| "Status" | `item.status` | `status` | correct |
| "Quantidade" (Quantity) | `item.quantidade ?? item.qtd` | `quantidade` | correct (the `qtd` fallback is never used, but harmless) |
| "Localização" (Location) | `item.local ?? item.localizacao` | `localizacao` | correct (falls through to the second fallback) |
| "Valor Unitário" (Unit value) | `item.valor_unitario ?? item.valorUnitario ?? item.valorUnit` | `valor_unitario` | correct (the first fallback already matches) |
| "Valor Total" (Total value) | derived (`valorUnitario × quantidade`) | — | DERIVED, client-side |
| "Setor" (Sector) | `item.setor` | `setor` | correct |
| "Responsável" (Responsible person) | `item.responsavel` | `responsavel` | correct |

**Unlike the main table and the edit form**, `InventarioViewModal` uses defensive fallback
chains in almost every field — which is why it does not suffer from the `dataEntrada`/`localCompra`/
`numeroNotaFiscal` bug (these 3 fields, incidentally, **are not even displayed** in this modal — `local_compra`,
`numero_nota_fiscal` and `data_entrada` do not appear anywhere in the detail view, even though they exist
in the database and are collected in the form — a DISPLAY_MAPPING_GAP by omission, not by a wrong name:
the user cannot see these 3 fields on any read screen, only in the freshly opened edit
form, and even there, incorrectly empty, see §6).

`EMPTY_STATE`: "—" for absent/null fields, consistent with the pattern of the other modules.

---

## 25. Filters, Search, Sort, Pagination, Limits

**FILTERS** (`Inventario.tsx`): 3 — `categoryFilter` (5 of 9 real options, see §8), `statusFilter`
(3 of 6 real options, see §15), `localFilter` (4 fixed strings against a free-text field, see
§16). All 100% client-side, over the already-loaded array — none becomes a real HTTP query param,
even though `QueryInventoryDto` accepts `status`/`categoria`/`search` in the backend (the same pattern of
"backend filter ready, never called by the frontend" already confirmed in previous modules of this
series).

**SEARCH**: `searchTerm` compares `item.nome`/`item.categoria`/`item.localizacao` via
`.toLowerCase().includes()` — 100% client-side, the 3 compared fields are named correctly.

**SORT**: no interactive sorting control in the table (no `SortableTableHead` or
equivalent) — the order is the API's arrival order (`ORDER BY i.created_at DESC`, hardcoded in the backend,
`inventory.service.ts:31`), with no way for the user to reorder by name/quantity/value.
`SORT_FIELDS: 0` (interactive).

**PAGINATION**: `usePagination(filteredEquipamentos, 10)` — 100% client-side pagination over the
already-filtered array, which in turn already arrived truncated from the backend (see Limits below). `TOTAL_COUNT_SOURCE`:
`filteredEquipamentos.length` (the count of the already-truncated array, not of the tenant's real total).

**LIMITS**:

| ENDPOINT_OR_COMPONENT | LIMIT | SERVER_OR_CLIENT | INTENTIONAL | AFFECTS_TOTAL |
|---|---|---|---|---|
| `GET /inventory` (via `useInventario()`, no override) | 50 (`PaginationDto.limit` default, `inventory.service.ts:33` `query.limit ?? 50`) | SERVER (silent) | NO | **YES** — the same silent truncation pattern already confirmed in practically all the previous modules of this series (`works`, `phonograms`, `contracts`, `clients`, `events`, the `dashboard` hooks) — here it affects the main list, the metrics at the top of the page (`metricas.total`/`.emUso`/`.disponiveis`/`.emManutencao`/`.valorTotal`, all computed over the same truncated array) and the client-side pagination (which paginates a subset, not the real total) |

`TRUNCATION_GAP` confirmed — the same structural root cause already documented in all the previous
modules.

---

## 26. Import / Export / XLSX

**Import (page level): NOT_IMPLEMENTED.** No import button/flow was found in
`Inventario.tsx` or in any other file of the module (unlike `events`/`catalog`, which have their own
client-side XLSX import, even if broken) — the `inventory` module simply does not
offer this functionality in any form, neither functional nor broken.

**Export (page level): NOT_IMPLEMENTED** by the same absence — no export button on the
module's page.

**Export via the Reports Center (a generic mechanism, already structurally audited in previous
modules)**: `inventory_items` **is registered and correctly mapped**
(`report-form-contracts.ts:586-595`, `INVENTORY_ITEMS_CONTRACT`) — the 12 real fields
(`nome`, `categoria`, `quantidade`, `valor_unitario`, `localizacao`, `status`, `responsavel`,
`setor`, `data_entrada`, `local_compra`, `numero_nota_fiscal`, `observacoes`) use the correct REAL
snake_case NAMES — **this export path does not suffer from the `dataEntrada`/`localCompra`/
`numeroNotaFiscal` bug of the module's own UI**, because the generic reports engine reads directly
from the real schema, not from the code of `Inventario.tsx`. `WORKSHEET_COUNT`: inherited from the generic engine
(already confirmed in previous modules as respecting `XLSX_MAX_SHEETS: 2`, not re-audited
individually here since it is not a mechanism specific to this module). `XLSX_RULE_VIOLATION: NÃO` (no).

`IMPORT_FIELDS: 0`. `EXPORT_FIELDS: 12` (via the Reports Center). `XLSX_EXPORTS: 0` (no
XLSX export specific to the `inventory` module — only the shared one).

---

## 27. Duplicates

No deduplication rule exists for `nome` (neither `DATABASE_UNIQUE`, nor `BACKEND_CHECK`, nor
`FRONTEND_CHECK`) — since there is no SKU/barcode/serial, there is no candidate field for a
duplicate key besides `nome` itself, and even that one is not checked. `DUPLICATE_HANDLING_GAP`
confirmed: two quick clicks on the "Cadastrar Item" (Register Item) button (with no visible debounce/disable beyond the
button's own `disabled={isSubmitting}`, which covers the most obvious double-click case but not a
deliberate second attempt) can create 2 identical items without any warning.

---

## 28. Barcode / QR Code

**NOT_IMPLEMENTED.** No field, library, or component for generating or reading barcodes
or QR codes was found in any layer. `BARCODE_QR_FIELDS: 0`.

---

## 29. Storage (photos, invoices, manuals, warranties)

**NOT_IMPLEMENTED.** Even though the form collects `numero_nota_fiscal` (a reference number in
text), there is no file upload field (item photo, invoice PDF, manual,
warranty document) in any layer — no storage reference column in `inventory_items`
(confirmed in Phase 1: no `*_url`/`*_key`/`attachment*` column), no dedicated
presign/upload endpoint, no upload component in the form. `STORAGE_FIELDS: 0`.

---

## 30. Audit / History

There is neither a movement ledger nor a dedicated audit table for the module — the only
change trail is the generic one: `@Audit('inventory.created'|'inventory.updated'|'inventory.deleted')`
in the controller, which writes to `activity_logs` (the same `AuditInterceptor` already confirmed in all the
previous modules — it records the ACTION and the actor, not necessarily a field-by-field old_value/new_value
diff). There is no UI that displays this history inside the `inventory` module (the
Dashboard's Activity Feed, already audited in `dashboard.md`, is the only cross-domain consumer of this log, subject to the
same realtime gap already documented there).

```text
INVENTORY_HISTORY_GAP confirmed: changing an item's `quantidade` (the most sensitive operation in this
module) leaves no specific record of the old vs. new value beyond the generic activity
log (action "inventory.updated", with no guaranteed structured diff payload) — there is no way,
from the UI or from a simple database query, to reconstruct "how much was in stock on a past
date" — the quantity history, if it exists in the activity log's JSON, is not exposed on any
screen.
```

---

## 31. Realtime

**NOT_IMPLEMENTED.** No `useWsEvent()` was found in any file of the `inventory` module
(confirmed by a full reading of `Inventario.tsx`/`InventarioFormModal.tsx`/
`InventarioViewModal.tsx`/`useInventario.ts`) — consistent with the already closed canonical realtime
contract (doc37, 22 cataloged events), which does not include any inventory-related event.
`REALTIME_EVENTS: 0`.

---

## 32. Permissions and Tenant Isolation

| PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|
| `inventory:read` | reading not explicitly gated (access to the page is assumed to be already gated by the route) | `@RequireRole('viewer') @RequirePermission('inventory:read')` |
| `inventory:create` | "Novo Item" (New Item) button via `<RequirePermission module="inventory" action="write">` | `@RequireRole('editor') @RequirePermission('inventory:create')` |
| `inventory:update` | no visible gate on the "Editar" (Edit) menu item | `@RequireRole('editor') @RequirePermission('inventory:update')` |
| `inventory:delete` | no visible gate on the "Excluir" (Delete) menu item or on the bulk delete button | `@RequireRole('manager') @RequirePermission('inventory:delete')` |

`AUTHORIZATION_GAPS: 0` — all real routes are protected in the backend; the absence of an early
visual gate on edit/delete is the same non-blocking observation already recorded in previous
modules (the backend would refuse the operation anyway). Note that the "Excluir em
massa" (Bulk delete) button (`handleBulkDelete`) fires multiple `deleteInventario.mutate(id)` calls in a loop — each
one goes through the same protected endpoint, with no dedicated "batch delete" endpoint (functional,
just N requests instead of 1, not classified as a gap).

`TENANT_ISOLATION_GAPS: 0`. `InventoryService` filters `tenant_id = :tenantId` in
`list`/`findById`/`update`/`softDelete`, and `create` writes `tenant_id: tenantId` explicitly
from `@CurrentTenant()` — consistent with the pattern already audited in `auth.md`. There are no
`movements`/`locations`/`reservations`/`loans`/`maintenance`/`attachments` for which to assess
additional isolation, since none of these entities exists (§11-14, §29).

---

## 33. Delete / Archive

| UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | RELATION_IMPACT | SOFT_OR_HARD |
|---|---|---|---|---|
| Delete item (`DeleteConfirmModal`, individually or via bulk selection) | `DELETE /inventory/:id` | `UPDATE inventory_items SET deleted_at = now()` | none (no child tables, §11-14) | SOFT |

There is no `ARCHIVE`/`RESTORE`/`DEACTIVATE` distinct from the standard soft delete. `HAS_MOVEMENTS`: always
`false` (the concept does not exist) — `DELETE_ALLOWED`: always yes, with no FK restriction
(`foreign_key: false` on all `inventory_items` columns, confirmed in Phase 1) —
`HISTORY_PRESERVED`: N/A (there is no movement history to preserve/lose; the soft-deleted item itself
preserves its data on the row, only hidden from `list`/`findById`).

---

## 34. Idempotency

No `idempotencyKey` on any `inventory` endpoint — `create` has no protection against
double-submit at the server level (only the button's `disabled={isSubmitting}` in the frontend). Since there is
no import/sync/transfer in this module (§26, §17), the only relevant case is `create` — recorded
as a low-severity `IDEMPOTENCY_GAP` (the same class as any simple CRUD form without
server-side protection against resubmission).

---

## Consolidated gaps (evidenced, not fixed)

1. **EDIT_MAPPING_MISMATCH** — `InventarioFormModal.tsx` prefills `localCompra`/
   `numeroNotaFiscal`/`dataEntrada` from camelCase fields that do not exist in the real API response
   (which uses `local_compra`/`numero_nota_fiscal`/`data_entrada`) — these 3 fields always
   appear empty when editing an existing item, even with real persisted data.
2. **DISPLAY_MAPPING_MISMATCH** — the main table's "Entrada" (Entry) column reads `item.dataEntrada`
   (always `undefined`), always displaying "—" even when `data_entrada` is filled in.
3. **DISPLAY_MAPPING_GAP** (omission) — `local_compra`/`numero_nota_fiscal`/`data_entrada` are never
   displayed in the details modal (`InventarioViewModal.tsx`), even though they exist and are
   collected in the form.
4. **ENUM_MISMATCH** (critical) — 3 divergent status vocabularies between the backend DTO, the frontend's Zod
   schema and the shared type; the real UI offers "Emprestado"/"Danificado" (On loan/Damaged), which the backend
   rejects with HTTP 400; "Reservado" (Reserved) (accepted by the backend) is never offered by the UI.
5. **REAL_MAPPING_GAP** — the location filter (`localFilter`) compares against 4 fixed exact strings,
   incompatible with the real free-text field (`localizacao`) that the form's own placeholder
   encourages filling in differently.
6. **REAL_MAPPING_GAP** — the category filter offers only 5 of the 9 real categories selectable at
   creation.
7. **DEFAULT_MISMATCH** — minimum quantity: the frontend requires `≥1` (zod), the backend accepts `≥0`
   (class-validator); `nome` length limit: frontend `≤150`, backend `≤255`.
8. **TRUNCATION_GAP** — `GET /inventory` uses `PaginationDto.limit=50` and `useInventario()` never
   overrides it — the list, metrics and client-side pagination operate on a truncated subset for
   tenants with more than 50 items.
9. **DUPLICATE_HANDLING_GAP** — no duplicate check of `nome` (or any other
   field) in any layer.
10. **STOCK_CONCURRENCY_GAP** — updating `quantidade` (and the other fields) is last-write-wins,
    with no optimistic lock or version check.
11. **INVENTORY_HISTORY_GAP** — no movement ledger; changes to `quantidade` leave no
    structured trail beyond the generic activity log.
12. **IDEMPOTENCY_GAP** — `create` has no server-side protection against duplicate resubmission.
13. **FINANCIAL_INTEGRATION_GAP** — no propagation (automatic or manual) between an inventory
    item and the `accounting` module, even though the purchase fields suggest that need.
14. **MOVEMENT_GAP / RESERVATION_GAP / LOAN_GAP / MAINTENANCE_GAP** — the 4 concepts exist only
    as `status` labels (partially, given Gap #4), with no field, table or business flow
    of their own behind them.
15. **STORAGE_GAP** — no attachment (photo/invoice/manual/warranty) implemented, not even in
    a partial/fake form.
16. **AUDITORIA_TSX gap** — the `valor` field checked by the Audit does not correspond to the real field
    `valor_unitario`; the `/inventario?edit=` deep link has no handler in the page (§2).
17. **DEAD CODE** (not counted as a formal gap) — `hooks/inventory.store.ts`/`store/*`
    (Zustand, zero consumers), `services/inventory.service.ts` (zero consumers).

Total: 17 findings (3 DISPLAY/EDIT-mapping family, 1 ENUM_MISMATCH, 2 filter REAL_MAPPING_GAP, 1
DEFAULT_MISMATCH, 1 TRUNCATION_GAP, 1 DUPLICATE_HANDLING_GAP, 1 STOCK_CONCURRENCY_GAP, 1
INVENTORY_HISTORY_GAP, 1 IDEMPOTENCY_GAP, 1 FINANCIAL_INTEGRATION_GAP, 1 finding aggregating
MOVEMENT/RESERVATION/LOAN/MAINTENANCE_GAP, 1 STORAGE_GAP, 1 Auditoria.tsx finding).

---

## Final counters (Zero-Gap)

```text
SUBDOMAINS_AUDITED: 1
COMPONENTS_AUDITED: 7
HOOKS_AUDITED: 1
CREATE_FORMS: 1
CREATE_FIELDS: 12
EDIT_FORMS: 1
EDIT_FIELDS: 12
MODALS_DRAWERS_WIZARDS: 2 (InventarioFormModal, InventarioViewModal)
TABLE_GRID_FIELDS: 11
DETAIL_DISPLAY_FIELDS: 8
IDENTIFIER_FIELDS: 1 (nome — the only real identifier, no SKU/barcode/serial)
CATEGORY_FIELDS: 1
QUANTITY_FIELDS: 1
MOVEMENT_FIELDS: 0
MOVEMENT_TYPES: 0
RESERVATION_FIELDS: 0
LOAN_FIELDS: 0
MAINTENANCE_FIELDS: 0
LOCATION_FIELDS: 1
FINANCIAL_FIELDS: 1
RELATION_FIELDS: 0
FILTERS: 3
SEARCH_FIELDS: 3
SORT_FIELDS: 0
IMPORT_FIELDS: 0
EXPORT_FIELDS: 12 (via the generic Reports Center)
XLSX_EXPORTS: 0 (module-specific — the real export is the shared mechanism, not re-audited
    at worksheet level here)
XLSX_RULE_VIOLATIONS: 0
BARCODE_QR_FIELDS: 0
STORAGE_FIELDS: 0
REALTIME_EVENTS: 0
PERMISSIONS_AUDITED: 4 (inventory:read/create/update/delete)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 1 (minimum quantity + name limit — counted as 1 categorized finding,
    affecting 2 fields)
ENUM_MISMATCH: 1 (3 divergent status vocabularies)
RELATION_MISMATCH: 0
CREATE_MAPPING_MISMATCH: 0 (create is correct)
EDIT_MAPPING_MISMATCH: 1 (localCompra/numeroNotaFiscal/dataEntrada in the prefill)
DISPLAY_MAPPING_MISMATCH: 2 (the table's "Entrada" column + omission of 3 fields in the view modal —
    counted as 2 distinct findings: 1 wrong name, 1 omission)
STOCK_CONSISTENCY_GAPS: 0 (not applicable — snapshot model, no ledger to diverge from)
STOCK_CONCURRENCY_GAPS: 1
NEGATIVE_STOCK_GAPS: 0 (negative values correctly prevented in the layers that exist)
MOVEMENT_GAPS: 1
RESERVATION_GAPS: 1
LOAN_GAPS: 1
MAINTENANCE_GAPS: 1
FINANCIAL_INTEGRATION_GAPS: 1
DUPLICATE_HANDLING_GAPS: 1
IMPORT_MAPPING_GAPS: 0 (there is no import to have a mapping — NOT_IMPLEMENTED, not a
    mapping gap)
STORAGE_GAPS: 1
PAGINATION_GAPS: 0 (client-side pagination works correctly over the received array — the
    problem is that the array already arrives truncated, counted in TRUNCATION_GAPS)
TRUNCATION_GAPS: 1
INVENTORY_HISTORY_GAPS: 1
IDEMPOTENCY_GAPS: 1
REAL_MAPPING_GAPS: 2 (location filter + category filter)

ACCOUNTING_INVENTORY_TRACEABILITY_COMPLETE: YES
CRM_INVENTORY_TRACEABILITY_COMPLETE: YES
EVENTS_INVENTORY_TRACEABILITY_COMPLETE: YES
AUDIOVISUAL_INVENTORY_TRACEABILITY_COMPLETE: YES
AUDITORIA_TSX_INVENTORY_SECTION_COMPLETE: YES

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_QUANTITY_FIELDS: 0
UNMAPPED_MOVEMENT_FIELDS: 0
UNMAPPED_FINANCIAL_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `leads`
