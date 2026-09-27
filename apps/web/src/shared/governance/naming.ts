/**
 * shared/governance/naming.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Mandatory Naming Conventions
 *
 * This file is NORMATIVE. Every contribution to the codebase must follow
 * these conventions without exception. They are the project's canonical rules.
 * Language policy (binding): everything technical/internal is ENGLISH; only
 * end-user-visible frontend copy is PT-BR (see docs/NAMING_NORMALIZATION_CANONICAL_MAP.md).
 *
 * Categories:
 *   1. Files and directories
 *   2. React components
 *   3. Hooks
 *   4. Services and utilities
 *   5. Entities and types
 *   6. DTOs
 *   7. Constants and enums
 *   8. Routes and URLs
 *   9. localStorage keys
 *  10. Custom events
 *  11. Test IDs (data-testid)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1. FILES AND DIRECTORIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: kebab-case for every file. PascalCase only for
 *        React components (*.tsx exporting a component by default).
 *
 * Mandatory extensions per type:
 *   .tsx  → React components (JSX)
 *   .ts   → pure logic, types, hooks, services, utilities
 *   .css  → standalone styles (rarely used; prefer Tailwind)
 *   .md   → documentation
 *
 * Naming patterns per layer:
 *   Component        → PascalCase.tsx              e.g. ArtistCard.tsx
 *   Hook             → camelCase.ts (use prefix)   e.g. useArtistForm.ts
 *   Service          → kebab-case.ts (.service suffix) e.g. artist.service.ts
 *   Mapper           → kebab-case.ts (.mapper suffix) e.g. artist.mapper.ts
 *   Types            → kebab-case.ts (.types suffix)  e.g. artist.types.ts
 *   Contract         → kebab-case.ts (.contract suffix) e.g. auth.contract.ts
 *   Adapter          → kebab-case.ts (.adapter suffix) e.g. streaming.adapter.ts
 *   Constants        → kebab-case.ts (-constants suffix) e.g. transaction-constants.ts
 *   Routes           → kebab-case.tsx (.routes suffix) e.g. artist.routes.tsx
 *
 * Internal module structure (mandatory order):
 *   modules/<domain>/
 *     adapters/   → integration adapters (domain → external contract)
 *     application/→ use cases and UI orchestrators
 *     components/ → the module's React components
 *     domain/     → pure business rules (no UI dependency)
 *     hooks/      → the module's React hooks
 *     mappers/    → form ↔ entity mappers (single source of truth)
 *     pages/      → pages (route components)
 *     services/   → data access (localStorage, future API)
 *     types/      → domain interfaces and types
 */
export const FILE_NAMING_RULES = {
  component:  "PascalCase.tsx",
  hook:       "use{Name}.ts",
  service:    "{name}.service.ts",
  mapper:     "{entity}Mappers.ts",
  types:      "{entity}.types.ts",
  contract:   "{concern}.contract.ts",
  adapter:    "{concern}.adapter.ts",
  constants:  "{concern}-constants.ts",
  routes:     "{domain}.routes.tsx",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 2. REACT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: PascalCase. Always one component per file.
 *        Names describe what the component IS, not what it DOES.
 *
 * Mandatory suffixes per role:
 *   Card     → compact list item                    e.g. ArtistCard
 *   Table    → paginated data table                 e.g. TransactionTable
 *   Modal    → dialog/modal (Radix Dialog)          e.g. ContractFormModal
 *   Form     → standalone form                      e.g. ArtistForm
 *   Page     → route component (page)               e.g. ArtistListPage
 *   Badge    → inline status badge                  e.g. ContractStatusBadge
 *   Panel    → collapsible or side panel            e.g. FiltersPanel
 *   Drawer   → side drawer (Radix Sheet)            e.g. ArtistDrawer
 *   Section  → page section                         e.g. FinanceSummarySection
 *   Widget   → dashboard widget                     e.g. RevenueWidget
 *   Chart    → chart (recharts)                     e.g. CashFlowChart
 *   Skeleton → loading state                        e.g. ArtistCardSkeleton
 *   Empty    → empty state                          e.g. CatalogEmpty
 *   Header   → section header                       e.g. PageHeader
 *
 * FORBIDDEN:
 *   - Generic names: Component, Container, Wrapper, Index
 *   - Names with "Manager", "Handler", "Controller" (a service role, not a component)
 *   - Opaque abbreviations: ArtCtrl, TxModal, etc.
 */
export const COMPONENT_NAMING = {
  suffixes: ["Card", "Table", "Modal", "Form", "Page", "Badge",
             "Panel", "Drawer", "Section", "Widget", "Chart",
             "Skeleton", "Empty", "Header"] as const,
  forbidden: ["Component", "Container", "Wrapper", "Index",
              "Manager", "Handler", "Controller"] as const,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 3. HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: the `use` prefix is mandatory. camelCase. A verb or noun after `use`.
 *
 * Categories and patterns:
 *   Data        → use{Entity}List, use{Entity}Detail   e.g. useArtistList
 *   Form        → use{Entity}Form                      e.g. useContractForm
 *   Mutation    → use{Verb}{Entity}                    e.g. useCreateTransaction
 *   Integration → use{ServiceName}                     e.g. useSpotify, useAbramus
 *   UI/State    → use{Concern}                         e.g. useCommandPalette
 *   Context     → use{ContextName}                     e.g. useTenant, useAuth
 *
 * Return rules:
 *   - Data hooks must return the full UseQueryResult object
 *     or explicitly destructure: { data, isLoading, error }
 *   - Mutation hooks must expose { mutate, isPending, error }
 *   - Form hooks must return the form object (react-hook-form)
 *   - Disabled-integration hooks must return IntegrationRuntimeStatus
 *
 * FORBIDDEN:
 *   - Hooks without the `use` prefix
 *   - Business logic inside components (extract to a hook)
 *   - Calling services directly in components (use an intermediate hook)
 */
export const HOOK_NAMING = {
  prefix:     "use",
  categories: {
    data:        "use{Entity}List | use{Entity}Detail",
    form:        "use{Entity}Form",
    mutation:    "use{Verb}{Entity}",
    integration: "use{ServiceName}",
    ui:          "use{Concern}",
    context:     "use{ContextName}",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SERVICES AND UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: camelCase for functions, kebab-case for files.
 *
 * Services (.service.ts suffix):
 *   - Single point of access to localStorage / future API per domain
 *   - Pure functions: getAll, getById, create, update, remove
 *   - No UI logic, no useState, no useEffect
 *   - Explicit return types (never `any`)
 *
 * Mappers (.mapper.ts suffix):
 *   - The ONLY source of truth for form ↔ entity transformations
 *   - Functions: toForm{Entity}, fromForm{Entity}, normalize{Entity}
 *   - Imported only by form hooks and services
 *
 * Utilities (shared/lib/):
 *   - Pure functions with no UI or domain dependency
 *   - Descriptive names: formatCurrency, slugify, truncate
 *   - Exported individually (no namespace objects)
 *
 * Adapters (adapters/):
 *   - Convert local entities ↔ external API formats
 *   - No side effects; data transformations only
 *   - Functions: to{ExternalFormat}, from{ExternalFormat}
 */
export const SERVICE_NAMING = {
  localStorageGet:  "getAll{Entities} | get{Entity}ById",
  localStorageSet:  "create{Entity} | update{Entity} | remove{Entity}",
  mapperToForm:     "toForm{Entity}",
  mapperFromForm:   "fromForm{Entity}",
  adapterToExt:     "to{ExternalFormat}",
  adapterFromExt:   "from{ExternalFormat}",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ENTITIES AND TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: ENGLISH for every technical name — domain entities, fields, enums,
 *        props, UI state and utilities. PT-BR is reserved for end-user-visible copy.
 *
 * Domain entities (canonical English names):
 *   Artist, Work, Phonogram, Release, Contract, Transaction,
 *   Invoice, Client, Lead, Campaign, Event, Project,
 *   Employee, InventoryItem, License, Takedown, Share
 *   Legacy Portuguese identifiers still present in the code (e.g. Artista, Obra,
 *   Fonograma, Contrato, Transacao) are tracked naming debt in
 *   scripts/naming/technical-naming-baseline.json — never introduce new ones.
 *
 * Entity interfaces:
 *   interface {EntityName}          → full entity (e.g. Artist)
 *   type {EntityName}Insert         → creation fields (no id, timestamps)
 *   type {EntityName}Update         → update fields (Partial<Insert>)
 *   interface {EntityName}WithRelations → entity with expanded refs
 *
 * EntityRef (shared/types/refs.ts):
 *   interface {EntityName}Ref → lightweight cross-domain reference
 *   Rule: no index signature; explicit fields only.
 *
 * FORBIDDEN:
 *   - `any` fields — use `unknown` or a specific type
 *   - Index signatures in refs (e.g. [key: string]: unknown) — use explicit fields
 *   - Inline types in components (extract to the module's .types.ts)
 *   - Duplicating types across modules (use a cross-domain EntityRef)
 */
export const ENTITY_NAMING = {
  full:          "interface {NomeEntidade}",
  insert:        "type {NomeEntidade}Insert",
  update:        "type {NomeEntidade}Update",
  withRelations: "interface {NomeEntidade}WithRelations",
  ref:           "interface {EntityName}Ref  // in shared/types/refs.ts",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 6. DTOs (DATA TRANSFER OBJECTS)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: DTOs describe data in transit (API, localStorage, forms).
 *        A mandatory distinction between entity (domain) and DTO (transport).
 *
 * DTO patterns:
 *   {Entity}FormValues    → react-hook-form form values
 *   {Entity}ApiPayload    → request body for the API (future)
 *   {Entity}ApiResponse   → API response (future)
 *   {Entity}LocalPayload  → payload for localStorage (standalone mode)
 *   {Entity}ExportRow     → XLSX/PDF export row
 *
 * Location:
 *   FormValues → in the module that uses the form
 *   ApiPayload/Response → in shared/types/ or in the service module
 *   LocalPayload → in the module's service
 *
 * Validation:
 *   - Every form uses zodResolver + a Zod schema
 *   - Named Zod schemas: {entity}FormSchema
 *   - Insert schemas: {entity}InsertSchema
 */
export const DTO_NAMING = {
  formValues:    "{Entity}FormValues",
  apiPayload:    "{Entity}ApiPayload",
  apiResponse:   "{Entity}ApiResponse",
  localPayload:  "{Entity}LocalPayload",
  exportRow:     "{Entity}ExportRow",
  zodFormSchema: "{entity}FormSchema",
  zodInsert:     "{entity}InsertSchema",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CONSTANTS AND ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: SCREAMING_SNAKE_CASE for fixed-value constants.
 *        Literal union types (not TypeScript enums) for enumerated fields.
 *
 * Location:
 *   Domain enums        → shared/types/enums.ts (single source of truth)
 *   Visual constants    → design tokens in index.css (CSS vars)
 *   Route constants     → in the module's routes file
 *   Form constants      → in the module (e.g. transaction-constants.ts)
 *   Integration constants → shared/integrations/registry.ts
 *
 * FORBIDDEN:
 *   - TypeScript enum (use a literal union type)
 *   - Domain constants defined in components
 *   - Magic strings — extract to a named constant
 */
export const CONSTANTS_NAMING = {
  value:       "SCREAMING_SNAKE_CASE",
  unionType:   "type {Name} = 'value_a' | 'value_b'  // in shared/types/enums.ts",
  noTsEnum:    "FORBIDDEN: TypeScript enum. Use a literal union type.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ROUTES AND URLs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: kebab-case. No trailing slash. New routes use English path segments;
 *        the existing Portuguese segments below are the current published URLs
 *        (legacy, kept for link compatibility until a redirect-backed migration).
 *
 * Current route structure per module:
 *   /artistas                  → artist list
 *   /artistas/:id              → artist detail
 *   /artistas/:id/editar       → artist editing
 *   /catalogo/obras            → works catalog
 *   /catalogo/fonogramas       → phonograms catalog
 *   /accounting/*              → accounting module
 *   /contratos                 → contract list
 *   /crm/clientes              → CRM — clients
 *   /leads                     -> commercial leads
 *   /marketing/campanhas       → marketing — campaigns
 *   /lancamentos               → music releases
 *   /gestao-shares             → shares management
 *   /monitoramento             → monitoring and takedowns
 *   /licencas                  → licensing
 *   /operacoes/eventos         → events
 *   /operacoes/inventario      → inventory
 *   /operacoes/rh              → human resources
 *   /projetos                  → projects
 *   /chat                      → MusicChat
 *   /configuracoes             → settings
 *   /admin/*                   → administrative area (AdminRoute)
 *
 * Query params: snake_case.  e.g. ?page=1&per_page=20&status=ativo
 * Route params: :id, :slug — always snake_case.
 */
export const ROUTE_PATTERNS = {
  list:   "/:dominio",
  detail: "/:dominio/:id",
  edit:   "/:dominio/:id/editar",
  create: "/:dominio/novo",
  sub:    "/:dominio/:submodulo",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 9. LOCALSTORAGE KEYS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: the `musicos360_` prefix is mandatory. snake_case after the prefix.
 *
 * Registered keys:
 *   musicos360_mock_data               → main mock data (MOCK_DATA)
 *   musicos360_rt                      → authentication refresh token
 *   musicos360_tenant                  → active tenant data
 *   musicos360_<id>_credentials        → integration credentials per ID
 *   musicos360_sidebar_collapsed       → sidebar state
 *   musicos360_command_palette_history → command palette history
 *
 * FORBIDDEN:
 *   - Keys without the `musicos360_` prefix
 *   - Keys with the old `lander_` or `lander360_` prefix (obsolete)
 *   - Unencrypted sensitive data in localStorage
 */
export const LOCALSTORAGE_KEYS = {
  mockData:          "musicos360_mock_data",
  refreshToken:      "musicos360_rt",
  tenant:            "musicos360_tenant",
  credentials:       "musicos360_<integration_id>_credentials",
  sidebarCollapsed:  "musicos360_sidebar_collapsed",
  commandHistory:    "musicos360_command_palette_history",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 10. CUSTOM EVENTS (window CustomEvents)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: the `musicos360:` prefix. camelCase after the prefix.
 *
 * Registered events:
 *   musicos360:dataChanged   → MOCK_DATA was changed (refetch trigger)
 *   musicos360:tenantChanged → the active tenant was changed
 *   musicos360:authChanged   → authentication state changed
 *
 * FORBIDDEN:
 *   - Events without the `musicos360:` prefix
 *   - Events without a typed detail type (CustomEvent<T>)
 */
export const CUSTOM_EVENTS = {
  dataChanged:   "musicos360:dataChanged",
  tenantChanged: "musicos360:tenantChanged",
  authChanged:   "musicos360:authChanged",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 11. TEST IDs (data-testid)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RULE: `{type}-{target}` format for interactive elements.
 *        `{type}-{content}-{id}` format for dynamic lists.
 *
 * Prefix types per category:
 *   button-   → buttons              e.g. button-create-artist
 *   input-    → form fields          e.g. input-stage-name
 *   link-     → navigation links     e.g. link-artist-profile
 *   select-   → dropdowns            e.g. select-status
 *   table-    → tables               e.g. table-artists
 *   row-      → table rows           e.g. row-artist-{id}
 *   card-     → cards                e.g. card-artist-{id}
 *   badge-    → status badges        e.g. badge-status-active
 *   modal-    → modals               e.g. modal-contract-form
 *   text-     → dynamic texts        e.g. text-total-balance
 *   img-      → images               e.g. img-artist-avatar
 *   status-   → status messages      e.g. status-payment-pending
 *
 * RULE: stable IDs — do not use array indexes, use entity IDs.
 * MANDATORY: every interactive element and every relevant dynamic datum.
 */
export const TEST_ID_PATTERNS = {
  interactive:   "{type}-{alvo}",
  dynamic:       "{type}-{descricao}-{id}",
  prefixes: ["button", "input", "link", "select", "table",
             "row", "card", "badge", "modal", "text", "img", "status"] as const,
} as const;

