> Historical record. Kept as recorded; not the current contract.

> Current contracts: `docs/engineering/README.md` (per-area engineering conventions) and `docs/naming/canonical-naming-map.json` (canonical names). This document describes an older standalone/mock-data system and is no longer normative.

# MUSIC OS 360 — Official Governance and Operational Documentation

> Version, as recorded, of the platform's architecture, conventions, entities, states, permissions, flows and contracts.
> Historical description of an older system; it makes no normative claim.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Technical Stack](#2-technical-stack)
3. [Directory Structure](#3-directory-structure)
4. [Mandatory Naming Conventions](#4-mandatory-naming-conventions)
5. [System Modules](#5-system-modules)
6. [Domain Entities and Relationships](#6-domain-entities-and-relationships)
7. [State Machines](#7-state-machines)
8. [RBAC Permission System](#8-rbac-permission-system)
9. [Feature Flags and Billing Plans](#9-feature-flags-and-billing-plans)
10. [Operational Flows](#10-operational-flows)
11. [Integrations](#11-integrations)
12. [Integration Contracts](#12-integration-contracts)
13. [Visual Standards](#13-visual-standards)
14. [Component Standards](#14-component-standards)
15. [Form Standards](#15-form-standards)
16. [Data Layer (Standalone)](#16-data-layer-standalone)
17. [Security and Sensitive Data](#17-security-and-sensitive-data)
18. [Scope Limitations](#18-scope-limitations)
19. [Sources of Truth in the Codebase](#19-sources-of-truth-in-the-codebase)

---

## 1. Platform Overview

**MUSIC OS 360** is a multi-tenant music ERP SaaS that centralizes all the operations of a music company — label, publisher or distributor — in a single 360° platform.

### Value proposition

| Area | What the platform solves |
|------|---------------------------|
| Artists | Centralized profile, platform metrics, 360° view |
| Catalog | Works, phonograms, ISRC/ISWC, rights shares |
| Contracts | Templates, digital signature, expiry alerts |
| Accounting | P&L per artist/project, cash flow, invoices (notas fiscais) |
| CRM | Clients, contacts, leads in a Kanban pipeline |
| Marketing | Campaigns, editorial calendar, Creative AI |
| Operations | Events, inventory, HR |
| Monitoring | Takedowns, ECAD reconciliation |
| Licensing | Sync, mechanical, streaming, performance |

### Target audience

- Independent labels
- Music publishers
- Distributors
- Artist management companies (multi-artist)

### Business model

Multi-tenant SaaS with **Starter**, **Professional** and **Enterprise** plans.  
Billing via Stripe (future). Free trial at onboarding.

---

## 2. Technical Stack

| Layer | Technology | Version |
|--------|-----------|--------|
| Frontend | React | 18 |
| Language | TypeScript | strict |
| Build | Vite + SWC | — |
| Routing | React Router | v6 |
| Data (client) | TanStack Query | v5 |
| UI Components | shadcn/ui + Radix | — |
| CSS | Tailwind CSS | — |
| Forms | react-hook-form + Zod | — |
| Charts | Recharts | — |
| Icons | lucide-react + react-icons/si | — |
| Data | MOCK_DATA + localStorage | standalone |
| Fonts | Plus Jakarta Sans + IBM Plex Mono | — |

**Current mode:** standalone (no backend). All data lives in `localStorage` under the key `musicos360_mock_data`.

---

## 3. Directory Structure

```
client/src/
├── app/
│   ├── providers/          # AuthProvider, TenantProvider, TenantContext
│   └── routes/             # Route files per domain (*.routes.tsx)
├── modules/                # Domain modules
│   ├── <domain>/
│   │   ├── adapters/       # Domain ↔ external contract adapters
│   │   ├── application/    # Use cases and UI orchestrators
│   │   ├── components/     # React components of the module
│   │   ├── domain/         # Pure business rules
│   │   ├── hooks/          # React hooks of the module
│   │   ├── mappers/        # SINGLE SOURCE: form ↔ entity
│   │   ├── pages/          # Pages (route components)
│   │   ├── services/       # Data access
│   │   └── types/          # Domain interfaces and types
│   └── integrations/
│       └── hooks/          # Stub hooks for all integrations
└── shared/
    ├── components/         # Genuinely cross-domain components
    ├── config/             # queryClient, CACHE_TIMES
    ├── data/               # mockData.ts (MOCK_DATA)
    ├── design-system/      # Design tokens and standards
    ├── governance/         # THIS LAYER — conventions and documentation
    ├── hooks/              # Cross-domain hooks
    ├── infrastructure/     # ErrorBoundary, AdminRoute, RealtimeLayer
    ├── integrations/       # Integration types, registry and contracts
    ├── layouts/            # MainLayout, PageHeader
    ├── lib/                # Pure cross-domain utilities
    ├── providers/          # Provider and hook barrels
    ├── types/              # Shared types (enums, refs)
    └── ui/                 # shadcn/Radix primitives
```

---

## 4. Mandatory Naming Conventions

> TypeScript source: `shared/governance/naming.ts`

### Files

| Type | Pattern | Example |
|------|--------|---------|
| React component | `PascalCase.tsx` | `ArtistCard.tsx` |
| Hook | `use{Name}.ts` | `useArtistForm.ts` |
| Service | `{name}.service.ts` | `artist.service.ts` |
| Mapper | `{entity}Mappers.ts` | `artistMappers.ts` |
| Types | `{entity}.types.ts` | `artist.types.ts` |
| Contract | `{concern}.contract.ts` | `auth.contract.ts` |
| Adapter | `{concern}.adapter.ts` | `streaming.adapter.ts` |
| Constants | `{concern}-constants.ts` | `transaction-constants.ts` |
| Routes | `{domain}.routes.tsx` | `artist.routes.tsx` |

### Components — mandatory suffixes

`Card` · `Table` · `Modal` · `Form` · `Page` · `Badge` · `Panel` · `Drawer` · `Section` · `Widget` · `Chart` · `Skeleton` · `Empty` · `Header`

**Forbidden:** `Component`, `Container`, `Wrapper`, `Index`, `Manager`, `Handler`, `Controller`

### Hooks — categories

| Category | Pattern | Example |
|-----------|--------|---------|
| Data | `use{Entity}List` / `use{Entity}Detail` | `useArtistList` |
| Form | `use{Entity}Form` | `useContractForm` |
| Mutation | `use{Verb}{Entity}` | `useCreateTransaction` |
| Integration | `use{ServiceName}` | `useSpotify` |
| UI | `use{Concern}` | `useCommandPalette` |
| Context | `use{ContextName}` | `useTenant` |

### Language

- **English** for all technical/internal names: identifiers, types, enums, DB schema (tables/columns), API keys/fields, log messages, event/queue names and scripts.
- **PT-BR only for end-user UI copy** (labels, toasts, error messages), humanized and correctly accented; never a raw enum value or snake_case key.
- **Portuguese vendor/external fields** are allowed only at adapter boundaries (the adapter maps them to canonical English names).
- **Legacy Portuguese aliases** are tolerated only when mapped, deprecated and ledgered in `docs/naming/canonical-naming-map.json`, with an owner, test coverage and an explicit removal condition.

### Enums

**Forbidden:** TypeScript `enum`  
**Correct:** `type Status = 'active' | 'inactive'` in `shared/types/enums.ts`

### localStorage keys

Mandatory prefix: `musicos360_`

| Key | Usage |
|-------|-----|
| `musicos360_mock_data` | Main mock data |
| `musicos360_rt` | Refresh token |
| `musicos360_tenant` | Active tenant data |
| `musicos360_<id>_credentials` | Integration credentials |

**Forbidden:** keys with the `lander_` or `lander360_` prefix (obsolete)

### Window events

Mandatory prefix: `musicos360:`

`musicos360:dataChanged` · `musicos360:tenantChanged` · `musicos360:authChanged` · `musicos360:themeChanged`

---

## 5. System Modules

> TypeScript source: `shared/governance/modules.ts`

| Module | Route | Primary Entities | Status |
|--------|------|---------------------|--------|
| `artists` | `/artistas` | Artista | production |
| `catalog` | `/catalogo` | `Obra`, `Fonograma` | production |
| `releases` | `/lancamentos` | Lancamento, Share | production |
| `contracts` | `/contratos` | Contrato, TemplateContrato | production |
| `accounting` | `/accounting` | Transacao, NotaFiscal | production |
| `crm` | `/crm` | `Cliente`, `Contato` | production |
| `marketing` | `/marketing` | `Campanha`, `Conteudo` | production |
| `events` | `/operacoes/eventos` | Evento | production |
| `inventory` | `/operacoes/inventario` | Inventario | production |
| `rh` | `/operacoes/rh` | Funcionario, FeriasAusencia | production |
| `monitoring` | `/monitoramento` | Takedown | production |
| `licensing` | `/licencas` | Licenca | production |
| `projects` | `/projetos` | Projeto | production |
| `leads` | `/crm/leads` | Lead | production |
| `audit` | `/admin/auditoria` | AuditLog | stub |
| `settings` | `/configuracoes` | Tenant, User, Role | production |

### Rule for the `shared/` layer

**May go in `shared/`:** cross-domain types (2+ modules), UI primitives, genuinely cross-domain components, app infrastructure, providers, config, cross-domain hooks, pure utilities, integration contracts, governance.

**May not go in `shared/`:** single-module logic, single-module components, domain-specific services, entity mappers.

---

## 6. Domain Entities and Relationships

> TypeScript source: `shared/governance/entities.ts`

### Relationship map

```
Artista ──────────────────────────────────────────────────────────────────────┐
  │ 1:N → Contrato (contrato_id)                                              │
  │ N:N → Obra (via Share.artista_id)                                         │
  │ N:N → Lancamento (via artista_ids[])                                      │
  │ 1:N → ArtistaRelacionamento (relacionamentos[])                            │
  └── hub of all operational entities                                         │
                                                                              │
Obra ─────────────────────────────────────────────────────────────────────────┤
  │ ISWC · cod_ecad · cod_ubc                                                 │
  │ 1:N → Fonograma (obra_id)                                                 │
  │ 1:N → Share (composition)                                                 │
  │ 1:N → Licenca (obra_id)                                                   │
  └── basis of ECAD/UBC collection                                           │
                                                                              │
Fonograma ───────────────────────────────────────────────────────────────────┤
  │ ISRC · cod_ecad · UPC                                                     │
  │ N:1 → Obra (obra_id) [required]                                           │
  │ N:N → Lancamento (fonograma_ids[])                                        │
  │ 1:N → Share (master)                                                      │
  └── basis of Content ID and streaming claims                               │
                                                                              │
Share ───────────────────────────────────────────────────────────────────────┤
  │ tipo (type): composição (composition) | master | editorial | performance | sincronia (sync) │
  │ direção (direction): entrada (in) | saída (out)                           │
  │ N:1 → Obra · N:1 → Fonograma · N:1 → Artista                            │
  └── sum of percentages must be 100% per type                               │
                                                                              │
Lancamento ──────────────────────────────────────────────────────────────────┤
  │ UPC · EAN                                                                 │
  │ N:N → Artista · N:N → Fonograma                                           │
  └── commercial distribution product                                        │
                                                                              │
Contrato ────────────────────────────────────────────────────────────────────┤
  │ autentique_document_id                                                    │
  │ N:1 → Artista · N:1 → Cliente                                             │
  └── digital signature support                                              │
                                                                              │
Transacao ───────────────────────────────────────────────────────────────────┤
  │ ofx_id · nota_fiscal_id                                                   │
  │ N:1 → Artista · N:1 → Projeto · N:1 → NotaFiscal                         │
  └── basis of P&L, cash flow, recoupment                                    │
                                                                              │
Lead ─────────────────────────────────────────────────────────────────────────┤
  │ N:1 → Cliente · N:1 → Artista                                             │
  └── Kanban pipeline: novo (new)→fechado (won)/perdido (lost)               │
                                                                              │
Takedown ─────────────────────────────────────────────────────────────────────┤
  │ url_infracao                                                              │
  │ N:1 → Obra · N:1 → Fonograma                                              │
  └── cross-platform rights protection                                       │
                                                                              │
Licenca ──────────────────────────────────────────────────────────────────────┘
  │ N:1 → Obra · N:1 → Cliente · N:1 → Contrato
  └── sync · mechanical · performance · streaming
```

### EntityRef — cross-domain references

Modules never import the full entity of another module.  
They use `{EntityName}Ref` from `shared/types/refs.ts`:

```typescript
// CORRECT
import type { ArtistaRef } from "@/shared/types/refs";

// FORBIDDEN
import type { Artista } from "@/modules/artist/types/artist.types";
// (in modules other than artist)
```

Available refs: `ArtistaRef` · `ClienteRef` · `ObraRef` · `FonogramaRef` · `LancamentoRef` · `ProjetoRef` · `ContratoRef` · `FuncionarioRef`

---

## 7. State Machines

> TypeScript source: `shared/governance/states.ts`

### Semantic color rule (mandatory)

| Color | States |
|-----|---------|
| 🟢 Green | active (`activo`) · in force (`vigente`) · published (`publicado`) · completed (`concluído`) · approved (`aprovado`) · issued (`emitido`) · closed (`fechado`) · registered (`registado`) |
| 🔵 Blue | in progress (`em curso`) · scheduled (`agendado`) · sent (`enviado`) · processing (`processando`) · in contact (`em contacto`) · production (`produção`) · delivered (`entregue`) |
| 🟡 Yellow | pending (`pendente`) · draft (`rascunho`) · under review (`análise`) · planning (`planeamento`) · expiring (`a vencer`) · suspended (`suspenso`) · negotiation (`negociação`) |
| ⚫ Gray | inactive (`inactivo`) · archived (`arquivado`) · closed (`encerrado`) · former artist (`ex-artista`) · settled (`liquidado`) · paused (`pausado`) |
| 🔴 Red | **EXCLUSIVE:** cancelled (`cancelado`) · rejected (`rejeitado`) · expired (`vencido`) · terminated (`desligado`) · failed (`falhou`) · lost (`perdido`) |

**Forbidden:** using red for neutral or progress states.

### Entities with a documented state machine

`Artista` · `Contrato` · `Transacao` · `NotaFiscal` · `Obra` · `Fonograma` · `Lancamento` · `Share` · `Lead` · `Takedown` · `Evento` · `Projeto` · `Campanha` · `Funcionario` · `Licenca`

### Example — Contrato (Contract)

```
rascunho → aguardando_assinatura → vigente → vencendo → vencido → encerrado
                                ↘ cancelado                    ↗ (renovar)
```

---

## 8. RBAC Permission System

> TypeScript source: `shared/governance/permissions.ts`  
> Implementation: `app/providers/TenantContext.tsx`

### Role hierarchy

```
owner > admin > manager > editor > viewer
```

### Permission matrix (read / write / delete / export)

| Module | owner | admin | manager | editor | viewer |
|--------|-------|-------|---------|--------|--------|
| All operational modules | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓✓ | ✓✓✗✓ | ✓✗✗✓ |
| audit | ✓✓✓✓ | ✓✓✓✓ | ✓✗✗✓ | ✗✗✗✗ | ✗✗✗✗ |
| settings | ✓✓✓✓ | ✓✓✓✓ | ✓✗✗✓ | ✗✗✗✗ | ✗✗✗✗ |

### Usage pattern in the UI

```tsx
// Check module access
const { tenant } = useTenant();
if (!tenant.permissions.artists.read) return <NoAccess />;

// Check operation (the button label is PT-BR UI copy: "Create Transaction")
const canWrite = tenant.permissions.accounting.write;
<Button disabled={!canWrite}>Criar Transação</Button>

// Check feature flag
if (!tenant.features.moduleMonitoring) return <UpgradePrompt />;

// Restricted route
<AdminRoute roles={["owner", "admin"]}>
  <AuditPage />
</AdminRoute>
```

**Forbidden:** checking `tenant.role` directly in components.

---

## 9. Feature Flags and Billing Plans

> TypeScript source: `shared/lib/feature-flags.ts`

### Modules per plan

| Module/Feature | Starter | Professional | Enterprise |
|----------------|---------|-------------|------------|
| Core modules | ✓ | ✓ | ✓ |
| monitoring | ✗ | ✓ | ✓ |
| licensing | ✗ | ✓ | ✓ |
| rh | ✗ | ✓ | ✓ |
| auditLog | ✗ | ✓ | ✓ |
| bulkActions | ✗ | ✓ | ✓ |
| analyticsAdvanced | ✗ | ✗ | ✓ |
| whitelabel | ✗ | ✗ | ✓ |
| multiTenantAdmin | ✗ | ✗ | ✓ |

### Active integrations per plan (standalone)

Only **Abramus** is functional in standalone mode.  
All other integrations throw `DisabledIntegrationError` (status 503).

---

## 10. Operational Flows

> TypeScript source: `shared/governance/flows.ts`

| ID | Flow | Modules involved |
|----|-------|-------------------|
| F01 | New Artist Onboarding | crm → artists → contracts → catalog |
| F02 | Music Release | catalog → releases → marketing → monitoring |
| F03 | Contract Cycle | contracts + artists + crm |
| F04 | Financial Cycle | accounting + artists + projects |
| F05 | Lead → Client → Contract | crm → contracts |
| F06 | Marketing Campaign | marketing + releases |
| F07 | Content Takedown | monitoring + catalog |
| F08 | ECAD Reconciliation | monitoring → catalog → accounting |
| F09 | Work Licensing | licensing → catalog → contracts → accounting |
| F10 | New Tenant Onboarding | settings → artists → catalog → contracts |

### Flow F01 — Artist Onboarding (summary)

```
Lead (CRM) → Artista (prospect) → Contrato (draft)
  → Send via Autentique → Artista (signed) → Obras/Fonogramas (catalog)
  → Artista (active)
```

### Flow F02 — Release (summary)

```
Obras+Fonogramas (catalog) → Lançamento (under review)
  → Shares defined → Approved → Delivered (distributor)
  → Marketing campaign → Published → Monitoring active
```

---

## 11. Integrations

> TypeScript source: `shared/integrations/registry.ts`  
> Hooks: `modules/integrations/hooks/`

### Registry of the 19 integrations

| ID | Name | Category | State | Hook |
|----|------|-----------|--------|------|
| `Supabase Auth` | Supabase Auth | auth | stub | `useSupabaseAuth` |
| `r2` | Cloudflare R2 | storage | stub | `useR2` |
| `resend` | Resend | email | stub | `useResend` |
| `stripe` | Stripe | payments | stub | `useStripe` |
| `autentique` | Autentique | signing | stub | `useAutentique` |
| `posthog` | PostHog | monitoring | stub | `usePostHog` |
| `sentry` | Sentry | monitoring | stub | `useSentry` |
| `spotify` | Spotify for Artists | streaming | stub | `useSpotify` |
| `youtube` | YouTube Analytics | streaming | stub | `useYouTube` |
| `tiktok` | TikTok for Business | streaming | stub | `useTikTok` |
| `instagram` | Instagram Insights | streaming | stub | `useInstagram` |
| `google-ads` | Google Ads | ads | stub | `useGoogleAds` |
| `deezer` | Deezer | streaming | stub | `useDeezer` |
| `apple-music` | Apple Music for Artists | streaming | stub | `useAppleMusic` |
| `soundcloud` | SoundCloud | streaming | stub | `useSoundCloud` |
| `ecad` | ECAD | rights | stub | `useEcad` |
| `ubc` | UBC | rights | stub | `useUbc` |
| `abramus` | Abramus | rights | **functional** | `useAbramus` |
| `musicroomchat` | MusicChat | chat | stub | `useChat` |

### Disabled integration pattern

```typescript
// All stub integrations throw DisabledIntegrationError
export function disabledIntegration(name: string): never {
  throw new DisabledIntegrationError(name); // status: 503
}
```

### Integration migration (roadmap)

To activate a stub integration:
1. Install the integration's SDK
2. Configure credentials through environment variables (`VITE_*`)
3. Implement the contract (`shared/integrations/contracts/`)
4. Replace the stub hook with the real implementation
5. Update the registry (status: `active`)

---

## 12. Integration Contracts

> TypeScript source: `shared/integrations/contracts/`

| Contract | File | Providers covered |
|----------|----------|-------------------|
| Auth | `auth.contract.ts` | Supabase Auth |
| Storage | `storage.contract.ts` | Cloudflare R2 |
| Email | `email.contract.ts` | Resend |
| Payments | `payments.contract.ts` | Stripe |
| Signing | `signing.contract.ts` | Autentique |
| Monitoring | `monitoring.contract.ts` | PostHog, Sentry |
| Streaming | `streaming.contract.ts` | Spotify, YouTube, TikTok, Instagram, Google Ads, Deezer, Apple Music, SoundCloud |
| Rights | `rights.contract.ts` | ECAD, UBC, Abramus |
| Chat | `chat.contract.ts` | MusicChat |

### Domain adapters

| Adapter | Location | Purpose |
|-----------|-------------|-----------|
| `streaming.adapter.ts` | `modules/artist/adapters/` | Artista ↔ streaming profiles |
| `rights.adapter.ts` | `modules/monitoring/adapters/` | Takedown ↔ APIs ECAD/UBC/Abramus |

---

## 13. Visual Standards

### Design tokens

```css
/* Primary color */
--primary: hsl(217, 91%, 60%);    /* enterprise blue */
--background: hsl(222, 47%, 4%); /* dark navy */

/* Fonts */
font-family: 'Plus Jakarta Sans', sans-serif;
font-family: 'IBM Plex Mono', monospace; /* numeric data */
```

### Surface hierarchy

1. Page background (`bg-background`)
2. Cards and panels (`bg-card` / `bg-muted/30`)
3. Inputs and fields (`bg-input`)
4. Elevated elements (`shadow-md` + `ring-1 ring-border`)

### Semantic color rules (reinforcement)

- **Green** → active, published, completed, approved, issued
- **Blue** → in progress, scheduled, processing, sent
- **Yellow** → pending, draft, under review, expiring
- **Gray** → inactive, archived, closed
- **Red** → **EXCLUSIVE**: cancelled, rejected, expired, failed, negative values

(The status values themselves are the Portuguese ones listed in section 7.)

### Sidebar

The sidebar header must display (PT-BR UI copy, kept verbatim):
- Name: **MUSIC OS 360**
- Subtitle: **ERP OPERACIONAL MUSICAL** ("musical operational ERP")
- Badge: **SISTEMA MULTI-TENANT** ("multi-tenant system")
- Label **Tenant Atual** ("Current Tenant") + the tenant name

---

## 14. Component Standards

### Mandatory structure of a page component

```tsx
// 1. Import of types and hooks
// 2. Definition of local types (if needed)
// 3. Main component with data-testid on the root element
// 4. Loading states (Skeleton)
// 5. Empty state (Empty)
// 6. Main content
// 7. Modals and drawers at the end of the JSX
```

### Mandatory data-testid

Every interactive element and every relevant piece of dynamic data must have a `data-testid`:

```tsx
<Button data-testid="button-create-artista">Criar Artista</Button>
<input data-testid="input-nome-artistico" />
<div data-testid="card-artista-{artista.id}" />
<span data-testid="text-saldo-total">{saldo}</span>
```

### Skeleton while loading

```tsx
if (isLoading) return <ArtistCardSkeleton />;
if (!data?.length) return <ArtistaEmpty />;
```

### Modals

Always use the Radix `Dialog` via shadcn.  
Naming: `{Entity}FormModal` for creation/editing, `{Entity}ViewModal` for viewing.

---

## 15. Form Standards

### Mandatory stack

```tsx
const form = useForm<ArtistaFormValues>({
  resolver: zodResolver(artistaFormSchema),
  defaultValues: { ... },
});
```

### Zod schema

```typescript
// in a module (not in shared)
const artistaFormSchema = z.object({
  nome_artistico: z.string().min(1, "Obrigatório"),
  // ...
});
type ArtistaFormValues = z.infer<typeof artistaFormSchema>;
```

### Mapper — single source of truth

```typescript
// Never transform data directly in the component
// Always use the module's mapper
import { toFormArtista, fromFormArtista } from "@/modules/artist/mappers/artistMappers";
```

### Validation

- `zodResolver` for declarative validation
- `form.formState.errors` for debugging validation errors
- Error messages in Portuguese (PT-BR end-user copy)
- Fields with explicit `required` in the schema

---

## 16. Data Layer (Standalone)

### MockData

```typescript
// localStorage key
const KEY = "musicos360_mock_data";

// Structure
interface MockData {
  artistas: Artista[];
  obras: Obra[];
  fonogramas: Fonograma[];
  contratos: Contrato[];
  transacoes: Transacao[];
  // ... all entities
}
```

### Service pattern

```typescript
// modules/{domain}/services/{entity}.service.ts
export function getAllArtistas(): Artista[] {
  const data = getMockData();
  return data.artistas;
}

export function createArtista(payload: ArtistaInsert): Artista {
  const data = getMockData();
  const novo = { id: uuid(), ...payload };
  data.artistas.push(novo);
  setMockData(data);
  dispatchDataChanged(); // musicos360:dataChanged
  return novo;
}
```

### TanStack Query

```typescript
// Never define queryFn inline in components
// Use the module's hook
const { data, isLoading } = useArtistList();

// Cache times: CACHE_TIMES from shared/config
// Invalidate after mutations
queryClient.invalidateQueries({ queryKey: ["artistas"] });
```

---

## 17. Security and Sensitive Data

| Field | Visible to | Masked for |
|-------|-------------|----------------|
| CPF/CNPJ | owner, admin, manager | editor, viewer |
| Salaries | owner, admin | manager, editor, viewer |
| Integration credentials | nobody (UI) | everyone |
| Auth tokens | nobody | everyone |

### Rules

- Credentials in localStorage only in standalone mode; backend Vault in the future
- `musicos360_rt` removed on logout
- Never log tokens, keys or passwords in `console.*`
- Sensitive data masked with `***` in lists and exports for roles without access

---

## 18. Scope Limitations

### What the system does NOT do (by design)

| Topic | Clarification |
|------|-------------|
| **External rights receipts as a domain** | "External rights receipts" (`Recebimentos externos de direitos`) is ONLY a transaction category in Accounting. There is no external-rights-receipts module. There is no splits/distribution engine. |
| **Artist accounting** | The Accounting module belongs to the company (label/publisher), not to the individual artist |
| **Individual artist analytics** | Analytics is only for company profiles (YouTube, TikTok, Instagram, Meta Ads, Google Ads). Individual analysis → 360° View modal in the Artists module |
| **AI as a module** | There is no "AI Assistant" module. AI exists only as form buttons in Marketing and Artists (`AIGenerateButton`) |
| **Payments engine** | Stripe is for the tenant's SaaS billing, not for payments to artists |
| **Split calculation** | Shares document percentage participations but do not calculate revenue distribution |

### Exact scope of Accounting

```
Accounting = revenue - expenses = net profit
           + P&L per artist and project
           + recoupment tracking
           + cash flow
           + OFX reconciliation
           + issuance of invoices (notas fiscais)

Does NOT include:
  - Calculation of external rights receipts
  - Splits / distribution engine
  - Payments to artists
  - Integration with distribution systems
```

---

## 19. Sources of Truth in the Codebase

| Subject | Canonical location |
|---------|---------------------|
| Status and type enums | `shared/types/enums.ts` |
| EntityRefs cross-domain | `shared/types/refs.ts` |
| Feature flags | `shared/lib/feature-flags.ts` |
| Integrations registry | `shared/integrations/registry.ts` |
| Integration contracts | `shared/integrations/contracts/` |
| Naming conventions | `shared/governance/naming.ts` |
| Modules registry | `shared/governance/modules.ts` |
| Entities catalog | `shared/governance/entities.ts` |
| State machines + colors | `shared/governance/states.ts` |
| RBAC permissions | `shared/governance/permissions.ts` |
| Operational flows | `shared/governance/flows.ts` |
| Permissions per role (impl.) | `app/providers/TenantContext.tsx` |
| Design tokens | `client/src/index.css` |
| Tailwind config | `tailwind.config.ts` |
| Mock data principal | `shared/data/mockData.ts` |
| Artists mapper | `modules/artist/mappers/artistMappers.ts` |
| Catalog mapper | `modules/catalog/mappers/registroMusicasMappers.ts` |
| Cross-domain normalization | `shared/lib/normalize.ts` |
| Multi-tenant isolation | `shared/lib/tenant-isolation.ts` |
| Disabled integration | `shared/lib/disabled-integration.ts` |

---

*This document was generated from TypeScript sources in `shared/governance/` that are not part of the current repository; it is not normative.*

*Last update synchronized with: STAGE 11 (`ETAPA 11`) — Definitive Governance*
