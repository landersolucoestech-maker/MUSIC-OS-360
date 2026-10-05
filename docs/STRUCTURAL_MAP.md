> Historical record. Kept as recorded; not the current contract.

> Current contracts: `docs/engineering/README.md` and `docs/naming/canonical-naming-map.json`. This May 2026 map describes an older standalone/mock-data layout (`client/src`) that no longer matches the repository.

# COMPLETE STRUCTURAL MAP — MUSIC OS 360
*Audit generated in May 2026. Source: direct reading of all the project files.*

---

## 1. ARCHITECTURE OVERVIEW

| Layer | Technology | Location |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | `client/src/` |
| Routing | React Router v6 | `client/src/app/routes/` |
| State / Cache | TanStack Query v5 | `shared/lib/query-config.ts` |
| UI Primitives | shadcn/Radix UI + Tailwind CSS | `shared/ui/` |
| Data Layer | localStorage + MOCK_DATA (standalone) | `shared/lib/storage.ts` |
| Auth | Mock mode (dev) / JWT httpOnly (prod) | `app/providers/AuthContext.tsx` |
| Multi-tenant | TenantContext + RBAC | `app/providers/TenantContext.tsx` |
| Domain Events | Custom window events `musicos360:*` | `shared/domain-events/consistency.ts` |
| Audit | Append-only log in `_audit_log` | `shared/lib/storage.ts` |

**Current mode**: Standalone — MOCK_DATA + localStorage (`musicos360_mock_data`). No active backend.

---

## 2. COMPLETE ROUTE MAP

### Public (no authentication)
| Path | Component | Module |
|---|---|---|
| `/auth` | Auth | auth |
| `/register` | Register | auth |
| `/captar` | LeadCapture | crm |
| `/cadastro` | ArtistaSignupPublic | auth |
| `/cadastro/:orgSlug` | ArtistaSignupPublic | auth |
| `/signup/artista` | ArtistaSignupPublic | auth |
| `/signup/artista/:orgSlug` | ArtistaSignupPublic | auth |
| `*` | NotFound | shared |

### Protected (ProtectedRoute = authenticated)
| Path | Component | Module |
|---|---|---|
| `/` | Dashboard | shared |
| `/dashboard` | Dashboard | shared |
| `/artistas` | Artistas | artist |
| `/artistas/novo` | ArtistaCadastro | artist |
| `/artistas/:id/editar` | ArtistaCadastro | artist |
| `/registro-musicas` | RegistroMusicas | catalog |
| `/rights-monitoring` | RightsMonitoring | rights-monitoring |
| `/rights-monitoring/execucao/:id` | ExecucaoDetail | rights-monitoring |
| `/takedowns` | Takedowns | monitoring |
| `/licenciamento` | Licenciamento | licensing |
| `/accounting` | Financeiro (Transactions) | accounting |
| `/accounting/contabilidade` | Contabilidade (Accounting, P&L) | accounting |
| `/accounting/nota-fiscal` | NotaFiscal | accounting |
| `/lancamentos` | Lancamentos | releases |
| `/gestao-shares` | GestaoShares | releases |
| `/crm` | CRM (clients + leads) | crm |
| `/marketing/visao-geral` | VisaoGeral | marketing |
| `/marketing/campanhas` | Campanhas | marketing |
| `/marketing/calendario` | Calendario | marketing |
| `/marketing/metricas` | Metricas | marketing |
| `/marketing/briefing` | Briefing | marketing |
| `/marketing/ia-criativa` | IACriativa | marketing |
| `/marketing/tarefas` | Tarefas | marketing |
| `/contratos` | Contratos | contracts |
| `/contratos/templates` | TemplatesContratos | contracts |
| `/projetos` | Projetos | projects |
| `/agenda` | Agenda | events |
| `/inventario` | Inventario | inventory |
| `/rh` | RH | rh |
| `/chat` | MusicChat | shared |
| `/relatorios` | Relatorios | reports |
| `/configuracoes` | Configuracoes | settings |
| `/aparencia` | Aparencia | settings |
| `/perfil` | Perfil | settings |
| `/usuarios` | Usuarios | settings |
| `/auditoria` | Auditoria (AdminRoute) | settings |
| `/support` | SupportDashboard | support |
| `/support/tickets` | SupportTickets | support |
| `/support/tickets/:id` | SupportTicketDetail | support |
| `/support/knowledge` | SupportKnowledge | support |
| `/support/chat` | SupportChat | support |
| `/support/status` | SupportStatus | support |
| `/support/requests` | SupportRequests | support |

### Super-Admin (role = super_admin)
| Path | Component |
|---|---|
| `/landing` | Landing |
| `/admin/dashboard` | AdminDashboard |
| `/admin/clients` | AdminClients |
| `/admin/plans` | AdminPlans |
| `/admin/audit` | AdminAudit |
| `/admin/support` | AdminSupport |
| `/admin/configuracoes` | AdminSettings |

### Redirects
| From | To |
|---|---|
| `/monitoramento` | `/rights-monitoring` |
| `/leads` | `/crm` |
| `/analytics` | `/relatorios` |
| `/admin` | `/admin/dashboard` |
| `/admin/settings` | `/admin/configuracoes` |
| `/admin/security` | `/admin/configuracoes` |
| `/admin/integrations` | `/admin/configuracoes` |
| `/admin/users` | `/admin/configuracoes` |

---

## 3. MODULES — DIRECTORY AND FILES

### `modules/accounting` — Finance/Accounting
```
pages/     Financeiro.tsx (Transactions), Contabilidade.tsx (Accounting, P&L), NotaFiscal.tsx (Invoice)
components/ TransacaoFormModal, TransacaoViewModal, NotaFiscalFormModal, NotaFiscalViewModal
hooks/     useTransacoes.ts, useNotasFiscais.ts
mappers/   entity-to-form.mapper.ts, form-to-payload.mapper.ts
lib/       nota-fiscal-tipo.ts, transacao-constants.ts
types/     index.ts → re-exports from hooks
```

### `modules/admin` — Super Admin Panel
```
pages/     AdminDashboard, AdminClients, AdminPlans, AdminAudit, AdminSupport, AdminSettings
layouts/   AdminLayout.tsx
data/      mockAdmin.ts
types/     index.ts
```

### `modules/analytics` — REMOVED
> Analytics = Reports page (`/relatorios`). The `/analytics → /relatorios` redirect is intentional.
> `mockAnalytics.ts` moved to `modules/marketing/data/mockAnalytics.ts` (used by Metricas.tsx).

### `modules/artist` — Artists
```
pages/     Artistas.tsx, ArtistaCadastro.tsx
components/ ArtistaFormModal, ArtistaVisao360Modal, ArtistaEvolucaoSection,
            ArtistaEvolutionCard, ArtistaPlatformMetrics, PlatformMiniTrend
hooks/     useArtistas.ts, useArtistasAssinados.ts
mappers/   artista.mapper.ts
services/  artista.service.ts
application/ createArtist.usecase.ts
domain/    artista.entity.ts
types/     index.ts
```

### `modules/auth` — Authentication
```
pages/     Auth.tsx (login), Register.tsx, ArtistaSignupPublic.tsx (8-step form)
index.ts
```

### `modules/catalog` — Music Catalog
```
pages/     RegistroMusicas.tsx (Obras + Fonogramas in tabs)
components/ ObraFormModal, ObraViewModal, ObraTipoSelectorModal,
            FonogramaFormModal, FonogramaViewModal,
            AbramusSearchRow, ParticipanteViewModal
hooks/     useObras.ts, useFonogramas.ts
adapters/  abramus.adapter.ts (FUNCTIONAL in mock)
mappers/   registro-musicas.mapper.ts
```

### `modules/contracts` — Contracts
```
pages/     Contratos.tsx, TemplatesContratos.tsx
components/ ContratoFormModal, ContratoViewModal,
            TemplateContratoFormModal, TemplateContratoViewModal
hooks/     useContratos.ts, useTemplatesContratos.ts
adapters/  autentique.adapter.ts (STUB — DisabledIntegrationError)
lib/       template-contrato-types.ts
types/     index.ts
```

### `modules/crm` — CRM (Clients + Leads)
```
pages/     CRM.tsx (clients + leads in tabs + kanban), LeadCapture.tsx (public)
components/ CRMFormModal, CRMViewModal, LeadFormModal, LeadViewModal,
            LeadIntegrationsDialog
hooks/     useClientes.ts, useLeads.ts, useLeadInteractions.ts
services/  crm.service.ts
application/ captureLead.usecase.ts
domain/    lead.entity.ts, lead.rules.ts
lib/       lead-schema.ts, contato-types.ts
types/     index.ts
```

### `modules/events` — Agenda/Events
```
pages/     Agenda.tsx
```

### `modules/integrations` — (no routes)
```
(shared integration utilities)
```

### `modules/inventory` — Inventory
```
pages/     Inventario.tsx
```

### `modules/licensing` — Licensing
```
pages/     Licenciamento.tsx
```

### `modules/marketing` — Marketing
```
pages/     VisaoGeral, Campanhas, Calendario, Metricas, Briefing, IACriativa, Tarefas
```

### `modules/monitoring` — Takedowns
```
pages/     Takedowns.tsx
```
> Note: performance monitoring (`monitoramento de execuções`) lives in `rights-monitoring`, not here.

### `modules/projects` — Projects
```
pages/     Projetos.tsx
```

### `modules/releases` — Releases + Shares
```
pages/     Lancamentos.tsx, GestaoShares.tsx
components/ LancamentoFormModal, LancamentoViewModal,
            SharePendenteFormModal, ShareViewModal
hooks/     useLancamentos.ts, useShares.ts
mappers/   dto-to-entity.mapper.ts, entity-to-form.mapper.ts, form-to-payload.mapper.ts
types/     index.ts (Lancamento, Share, ShareWithRelations, LancamentoWithRelations)
```

### `modules/reports` — Reports
```
pages/     Relatorios.tsx
```

### `modules/rh` — Human Resources
```
pages/     RH.tsx
```

### `modules/rights-monitoring` — Performance Monitoring (ECAD)
```
pages/     RightsMonitoring.tsx, ExecucaoDetail.tsx
```

### `modules/settings` — Settings
```
pages/     Configuracoes.tsx, Aparencia.tsx, Perfil.tsx, Usuarios.tsx
components/ IntegrationStatusBadges.tsx
```

### `modules/support` — Support
```
pages/     SupportDashboard, SupportTickets, SupportTicketDetail,
           SupportKnowledge, SupportChat, SupportStatus, SupportRequests
```

---

## 4. CANONICAL ENTITIES AND TYPES

### Artista
```typescript
id, nome_artistico, nome_civil, tipo (solo|banda), status, status_cadastro
genero_musical, email, telefone, cpf_cnpj, foto_url, observacoes
especialidades[]          // interprete (performer), compositor_autor (composer/author), produtor (producer), dj_produtor (DJ/producer), etc.
fase_carreira, slug_artistico, tags_musicais[]
contrato_id → contratos
// Streaming
spotify_url, spotify_ouvintes
youtube_url, youtube_inscritos
deezer_url, deezer_fas
apple_music_url, soundcloud_url, soundcloud_seguidores
// Social networks
instagram, instagram_seguidores, tiktok, tiktok_seguidores
facebook, twitter, website
// Personal data
data_nascimento, rg, cpf_cnpj, endereco
// Banking
banco, agencia, conta, chave_pix, titular_conta
// Perfil 360
galeria_urls[]
manager_nome, manager_contato, produtor_executivo, agencia_booking, label_parceira
// Commercial relationships (NEW MODEL)
relacionamentos[]: { tipo, nome, telefone, email, escritorio, crc, responsaveis[], distribuidoras[] }
// LEGACY (keep compatibility)
empresario_id, empresario_nome, empresario_email
gravadora_id, gravadora_nome, gravadora_responsavel_nome
distribuidoras_selecionadas{}, distribuidoras_emails{}
org_slug    // filled in by the public form
```

> ⚠️ **Double coupling**: the `empresario_*` (manager) and `gravadora_*` (label) fields are legacy and coexist with the `relacionamentos[]` array. Source of structural inconsistency.

### Transacao (Transaction — Accounting)
```typescript
id, descricao, tipo (receita|despesa), categoria, valor, data
status, artista_id → artistas, cliente_id → clientes
proposal_id -> proposals, origem, observacoes
conciliado, anexo_url, forma_pagamento
```
Categories (revenue, `receita`): `recebimentos externos de direitos` (external rights receipts), `cachê` (performance fee), `licenciamento` (licensing), `distribuicao` (distribution), `patrocinio` (sponsorship)
Categories (expense, `despesa`): adiantamento_artista (artist advance), producao_musical (music production), marketing_digital, marketing_offline, juridico, administrativo, folha_pagamento, producao_audiovisual, infraestrutura, software, seguros, distribuicao_digital

### Obra (Work — Catalog)
```typescript
id, titulo, compositor, compositores[], letristas[], co_compositores, detentores
editora, isrc, iswc, cod_abramus, cod_ecad
tipo (musica|composicao), genero, status (registrado|pendente|analise)
duracao, artista_id → artistas, projeto_id → projetos
origem_externa (abramus), origem_externa_id, origem_externa_sincronizado_em
```

### Fonograma
```typescript
id, titulo, obra_id → obras, artista_id → artistas
isrc (+ isrc_pais, isrc_registrante, isrc_ano, isrc_designacao)
duracao, tipo (original|ao_vivo|cover|remix), status
compositores, interpretes, produtores
gravadora, agregadora, cod_abramus, cod_ecad
criada_por_ia, instrumental, genero_musical
data_lancamento, data_registro, pais_origem
arquivo_audio (JSON), participacao
origem_externa, origem_externa_id, origem_externa_sincronizado_em
```

### Lancamento (Release)
```typescript
id, titulo, tipo (album|single|ep|compilacao), status, artista_id → artistas
data_lancamento, distribuidora, plataformas[]
fonograma_ids[]    // FK to fonogramas
isrc_global, upc
assets: { audio_master_url, capa_url, video_clipe_url, letra, ficha_tecnica, press_release, epk_url }
cronograma: { data_gravacao, data_mix_master, data_entrega_distribuidora }
```

### Share (Share Management)
```typescript
id, obra_id → obras, artista_id → artistas (LEGACY — field in transition)
percentual, tipo, direcao (a_receber|a_enviar)
status (pendente|parcial|recebido|enviado|cancelado)
valor_total, valor_liquidado, detentor (texto livre)
acordo_notas, acordo_url, versao, historico[]
```
> ⚠️ `detentor` (holder) is free text; `obra_id` can be null in the public form (the `nome_musica` field was replaced by free text).

### Contrato
```typescript
id, titulo, tipo (exclusividade|gravacao|distribuicao|gestao|licenciamento|producao|patrocinio)
status (assinado|vigente|em_analise|aguardando_assinatura|expirado|cancelado)
artista_id → artistas (nullable), cliente_id → clientes (nullable)
lancamento_id → lancamentos (nullable)
data_inicio, data_fim, valor, exclusivo
template_id → templates_contratos, assinado_em
arquivo_url, autentique_doc_id
versoes[]: { versao, url, criado_em, notas, autor }
```
> ⚠️ **A Contrato (contract) belongs to an artista OR a cliente, never both** — there is no structural validation of this.

### Cliente (Client — CRM)
```typescript
id, nome, tipo, segmento (contratante|parceiro|fornecedor|contato)
email, telefone, cnpj/cpf, endereco, cidade, estado, cep
status (ativo|inativo|prospect|lead), temperatura, responsavel, empresa
```

### Lead (CRM)
```typescript
id, nome, email, telefone, empresa, cargo
status (novo|contactado|qualificado|proposta|fechado|perdido)
origem, score, notas, responsavel_id
```

### Funcionario (Employee — HR)
```typescript
id, nome, cargo, departamento, email, telefone, cpf, salario
data_admissao, status
```

### Evento (Event — Agenda)
```typescript
id, titulo, tipo, data, hora, local, artista_id → artistas
cliente_id → clientes, status, observacoes
```

### Projeto (Project)
```typescript
id, titulo, descricao, tipo, status, data_inicio, data_fim
artista_id → artistas, responsavel_id
```

### Licenca (License — Licensing)
```typescript
id, titulo, tipo, status, artista_id → artistas, cliente_id → clientes
obra_id → obras, valor, data_inicio, data_fim, plataformas[]
```

### NotaFiscal (Invoice)
```typescript
id, numero, tipo, status, valor, data_emissao, data_vencimento
prestador, tomador, descricao, transacao_id → transacoes
```

### Share — complete mockData fields
```
id, lancamento_id→, nome_musica, detentor, funcao, percentual
status, direcao, valor_total, valor_liquidado
```

---

## 5. RELATIONSHIPS BETWEEN ENTITIES

```
Artista ←─── Contrato (artista_id, nullable)
Artista ←─── Lancamento (artista_id)
Artista ←─── Obra (artista_id, nullable)
Artista ←─── Fonograma (artista_id, nullable)
Artista ←─── Share (artista_id, nullable)
Artista ←─── Transacao (artista_id, nullable)
Artista ←─── Evento (artista_id, nullable)
Artista ←─── Projeto (artista_id, nullable)
Artista ←─── Licenca (artista_id, nullable)

Cliente ←─── Contrato (cliente_id, nullable)
Cliente ←─── Transacao (cliente_id, nullable)
Cliente ←─── Evento (cliente_id, nullable)
Cliente ←─── Licenca (cliente_id, nullable)

Obra ←─── Fonograma (obra_id)
Obra ←─── Share (obra_id, nullable)
Obra ←─── Licenca (obra_id, nullable)
Obra ←─── Projeto (via projeto_id in Obra)

Lancamento ←─── Fonograma[] (via fonograma_ids[] in Lancamento)
Lancamento ←─── Contrato (lancamento_id)

Transacao ←─── NotaFiscal (transacao_id)
Contrato ←─── TemplateContrato (template_id)

Lead ←─── LeadInteraction (lead_id)
Funcionario ←─── FolhaPagamento (funcionario_id)
Funcionario ←─── FeriasAusencia (funcionario_id)
Funcionario ←─── DocumentoFuncionario (funcionario_id)
```

---

## 6. DATA LAYER — STORAGE

### Complete data flow
```
Component / Hook
    ↓ useDataQuery (generic) or specific hook
    ↓ storage.list / storage.create / storage.update / storage.delete
    ↓ MOCK_MODE ?
        YES → MOCK_DATA in memory + localStorage (musicos360_mock_data)
        NO → api-client.ts → HTTP API (backend NestJS)
    ↓ Automatic audit log (_audit_log, max 2000 entries)
    ↓ TanStack Query cache + invalidation
    ↓ Component re-render
```

### Tables with tenant isolation (TENANT_SCOPED_TABLES)
`artistas`, `clientes`, `contatos`, `leads`, `contratos`, `obras`, `fonogramas`, `shares`, `lancamentos`,
`transacoes`, `notas_fiscais`, `projetos`, `eventos`, `inventario`, `campanhas`, `conteudos`, `briefings`,
`tarefas_marketing`, `metas_artistas`, `monitoramentos`, `licencas`, `regras_financeiras`,
`ecad_reports`, `funcionarios`, `folha_pagamento`, `afastamentos`, `documentos_funcionario`

### Tables without tenant isolation
`templates_contratos`, `regras`, roles, permissions, role_permissions, `usuarios`,
proposals, proposal_items, followups, catalogo, company_settings, profiles, user_settings, team_members, team_invites

### Cache (TanStack Query)
| Type | staleTime | gcTime | Entities |
|---|---|---|---|
| STATIC | 30 min | 1 hour | — |
| SEMI_STATIC | 10 min | 30 min | templates, regras, roles, permissions, external integrations |
| DYNAMIC | 2 min | 10 min | `artistas`, `contratos`, `obras`, `fonogramas`, `transacoes`, `campanhas`... |
| REALTIME | 30 sec | 5 min | eventos, notifications, metrics, metas_artistas |

---

## 7. CONTEXTS AND PROVIDERS (tree)

```
ThemeProvider            (dark/light mode, localStorage)
  ErrorBoundary          (root error boundary)
    QueryClientProvider  (TanStack Query)
      AuthProvider       (user, session, signIn/signOut)
        TenantProvider   (tenant, RBAC, feature flags)
          RealtimeLayer  (window events musicos360:*)
          TooltipProvider
            Sonner       (toasts)
              BrowserRouter
                Routes   (all route groups)
```

---

## 8. AUTHENTICATION

### Mock Mode (development, VITE_USE_MOCK=true)
- User always authenticated: MOCK_USER
- signIn/signOut: NOPs (keeps mock state)
- No HTTP calls

### Real Mode (production, VITE_USE_MOCK=false)
- POST `/auth/login` → JWT access_token in memory
- httpOnly cookie → refresh token (sent automatically)
- On mount: POST `/auth/refresh` → restores the session
- POST `/auth/logout` → revokes the cookie

### Extracting data from the JWT
```typescript
{ sub, email, role, org_id } = decodeJwtPayload(access_token)
```

---

## 9. RBAC — PERMISSIONS AND ROLES

### Roles
| Role | Description |
|---|---|
| owner | Full access to everything |
| admin | Full access to everything |
| manager | Full on all except audit/settings (read_only) |
| editor | No delete; no access to audit/settings |
| viewer | Read-only on everything; no access to audit/settings |

### Modules covered by RBAC (16)
artists, catalog, releases, contracts, accounting, crm, marketing, events,
inventory, rh, monitoring, licensing, projects, leads, audit, settings

### Actions per module
read, write, delete, export

### Permissions queried with
```typescript
useTenant().canRead(module)
useTenant().canWrite(module)
useTenant().canDelete(module)
useTenant().canExport(module)
useTenant().hasPermission(module, action)
```

---

## 10. FEATURE FLAGS (55 flags)

### Per plan
| Flag | Starter | Pro | Enterprise |
|---|---|---|---|
| moduleMonitoring | ✗ | ✓ | ✓ |
| moduleLicensing | ✗ | ✓ | ✓ |
| moduleRh | ✗ | ✓ | ✓ |
| auditLog | ✗ | ✓ | ✓ |
| bulkActions | ✗ | ✓ | ✓ |
| analyticsAdvanced | ✗ | ✗ | ✓ |
| whitelabel | ✗ | ✗ | ✓ |
| multiTenantAdmin | ✗ | ✗ | ✓ |

### Active integrations in mock
| Integration | State |
|---|---|
| ABRAMUS | ✅ Functional (catalog search and import) |
| Autentique | 🔴 Stub (DisabledIntegrationError) |
| Spotify / YouTube / TikTok | 🔴 Stub |
| Meta Ads / Google Ads | 🔴 Stub |
| DistroKid / SoundOn / Symphonic / OneRP | 🔴 Stub |
| Deezer / Apple Music / SoundCloud | 🔴 Stub |
| ECAD | 🔴 Stub |

### Gated features
| Flag | Current state |
|---|---|
| aiFeatures | false (AI limited to buttons in Marketing/ArtistaForm) |
| billingPortal | false |
| storageR2 | false |
| rbacAdvanced | false |
| analyticsAdvanced | false |
| whitelabel | false |

---

## 11. TENANT (MULTI-TENANCY)

### Structure
```typescript
Tenant {
  id, name, slug, plan (starter|professional|enterprise)
  industry (gravadora|editora|distribuidora|agencia|publisher|outro)
  website, cnpj, phone, address
  features: FeatureFlags
  permissions: Record<TenantModuleKey, TenantModulePermission>
  config: { primaryColor, logoUrl, faviconUrl, customDomain, emailFromName,
            emailFromAddr, supportEmail, whitelabel, hideProductName }
  billing: { status, trialEndsAt, currentPeriodEnd, seats, seatsUsed,
             planId, customerId, subscriptionId }
  onboarding: { completed, currentStep, steps: Record<OnboardingStep, boolean> }
  meta: { createdAt, timezone, locale, currency, version }
}
```

### Onboarding steps (7)
company_profile → invite_team → first_artist → first_catalog_item →
first_contract → connect_integration → complete

### Active mock tenant
`ten-gravadora-exemplo-001` / "Gravadora Exemplo Ltda" / plan: enterprise / 8/25 seats

---

## 12. PUBLIC FORM — ArtistaSignupPublic

Multi-step form (8 steps) reachable at `/cadastro/:orgSlug`

| Step | Name (UI label) | Main fields |
|---|---|---|
| 0 | Profile Photo (`Foto de Perfil`) | foto_url (above step 1) |
| 1 | Basic Information (`Informações Básicas`) | nome_artistico, genero_musical, especialidades[], link_documentos |
| 2 | Personal Data (`Dados Pessoais`) | `nome_civil`, `cpf_cnpj`, `data_nascimento`, `rg`, `endereco`, `tipo_pessoa` |
| 3 | Contacts (`Contatos`) | email, telefone, instagram, facebook, tiktok, twitter, website |
| 4 | Bank Details (`Dados Bancários`) | `banco`, `agencia`, `conta`, `chave_pix`, `titular_conta` |
| 5 | Streaming Platforms (`Plataformas de Streaming`) | spotify_url, youtube_url, deezer_url, apple_music_url, soundcloud_url |
| 6 | Relationships (`Relacionamentos`) | `empresario`, `gravadora`, booker, `juridico`, `financeiro`, `contador` |
| 7 | Distributors (`Distribuidoras`) | distribuidoras_selecionadas{}, distribuidoras_emails{} |

**Result**: a record in `artistas` with `status_cadastro: "onboarding"` e `org_slug`.

---

## 13. ACCOUNTING MODULE — EXACT SCOPE

**Includes**: Transactions (`/accounting`), Accounting P&L (`/accounting/contabilidade`), Invoice (`/accounting/nota-fiscal`)

**Does not include**: external rights receipts (only a transaction category), payout/split engine

### Contabilidade.tsx — Tab structure
| Tab | Content |
|---|---|
| `Todos` (All) | PLTable company + projects table + artists table |
| P&L Empresa (Company P&L) | Statement per category (revenue/expenses/result) |
| P&L Projetos (Projects P&L) | Each transaction = 1 row (name/category/revenue/expenses/result) |
| P&L Artistas (Artists P&L) | Grouped by artista_id |

### Financeiro.tsx — Transactions
Filters: type, category, status, artist, date. Full CRUD. OFX/XLSX export.

---

## 14. CATALOG MODULE — EXACT SCOPE

**Two distinct entities**:
- **Obra** (Work): musical composition (ISWC, cod_ECAD, cod_ABRAMUS) — authors' rights
- **Fonograma** (Phonogram): recording (ISRC, performing artist) — related rights

**Abramus Adapter**: searches the Abramus catalog, imports into obras + fonogramas. The only functional adapter.

---

## 15. RELEASES MODULE — EXACT SCOPE

**`Lançamento`** (Release): album/single/EP with distributor, platforms, global ISRC, UPC. Holds fonograma IDs.

**Share/Share Management**: ownership percentages of musical works, with direction (a_receber vs a_enviar, i.e. to receive vs to send), settlement status, version history.

---

## 16. ARCHITECTURAL PATTERNS

### Mapper pattern (source of truth)
```
shared/lib/normalize.ts                   (generic normalization)
modules/catalog/mappers/registro-musicas.mapper.ts
modules/artist/mappers/artista.mapper.ts
modules/accounting/mappers/entity-to-form.mapper.ts
modules/accounting/mappers/form-to-payload.mapper.ts
modules/releases/mappers/dto-to-entity.mapper.ts
modules/releases/mappers/entity-to-form.mapper.ts
modules/releases/mappers/form-to-payload.mapper.ts
```
> Rule: every form ↔ entity transformation goes EXCLUSIVELY through the module's mapper.

### useDataQuery pattern (generic CRUD hook)
```typescript
useDataQuery<T>({ queryKey, table, select?, orderBy?, filters? }, messages?)
→ { data[], isLoading, error, create, update, delete }
```
All modules use this hook. Only `useObras` has an additional `bulkUpdateEcad`.

### Route Factory pattern
```typescript
export function artistRoutes(P: SuspenseRouteComponent) {
  return (<><Route ... /></>);
}
```
Composed in App.tsx. Each domain has 1 routes file.

### CRUD Modal pattern
Each entity has: `{Entity}FormModal` (create/edit) + `{Entity}ViewModal` (view detail). Consistent across all modules.

---

## 17. ARCHITECTURAL NOTES

### Intentional designs (not inconsistencies)
| Aspect | Design decision |
|---|---|
| `Artista.relacionamentos[]` + campos `empresario_*`/`gravadora_*` | Intentional multi-format model — supports diverse relationship structures |
| `Artista.distribuidoras_selecionadas{}` + `distribuidoras_emails{}` | Distinct fields for granular per-distributor control — intentional design |
| `Contrato` without artista_id AND without cliente_id | A Contrato belongs to an artista OR to a cliente — both nullable, simple and intentional |
| `Share.obra_id` nullable + free-text `nome_musica` field | Share Management = tracking of what was sent/received; the obra is optional |
| `/analytics` → redirect to `/relatorios` | Analytics IS the Reports page — intentional redirect |

### Operational states per entity
| Entity | Possible states |
|---|---|
| Artista | `contratado`, `em_negociacao`, `onboarding`, `inativo` |
| Contrato | `assinado`, `vigente`, `em_analise`, `aguardando_assinatura`, `expirado`, `cancelado` |
| Obra | `registrado`, `pendente`, `analise` |
| Lancamento | `planejado`, `em_producao`, `entregue`, `publicado`, `cancelado` |
| Share | `pendente`, `parcial`, `recebido`, `enviado`, `cancelado` |
| Lead | `novo`, `contactado`, `qualificado`, `proposta`, `fechado`, `perdido` |
| Cliente | `ativo`, `inativo`, `prospect`, `lead` |

### Module implementation state
| Module | Current state |
|---|---|
| `modules/events` | ✅ Complete — Agenda.tsx + EventoFormModal + EventoViewModal + useEventos |
| `modules/inventory` | ✅ Complete — Inventario.tsx + InventarioFormModal + InventarioViewModal + useInventario |
| `modules/projects` | ✅ Complete — Projetos.tsx + ProjetoFormModal + ProjetoViewModal + useProjetos |
| `modules/rh` | ✅ Complete — RH.tsx + FuncionarioFormModal + FolhaPagamentoFormModal + hooks |
| `modules/licensing` | ✅ Complete — Licenciamento.tsx + LicencaFormModal + LicencaViewModal + useLicencas |
| `modules/marketing` | ✅ Complete — 7 pages + mockAnalytics (simulated data) |
| `modules/support` | ✅ Complete — 7 pages + useSupport + mockSupport |
| `modules/reports` | ✅ Complete — Relatorios.tsx + ImportEngine + ExportEngine + AuditLogPanel |
| `modules/analytics` | 🗑️ Removed — redundant; Analytics = Reports page |

### Active keys and prefixes (all correct)
| Item | Current value |
|---|---|
| localStorage | `musicos360_mock_data` |
| Auth cookie | `musicos360_rt` |
| CustomEvents | `musicos360:*` |
| Permission key accounting | `accounting` |

---

## 18. SHARED — COMPONENTS AND UTILITIES

### `shared/components/` (cross-domain)
MainLayout, PageHeader, AppSidebar, ContratoStatusBadge, AIGenerateButton,
FinanceChart, DataTable, PageSkeletons

### `shared/infrastructure/`
ErrorBoundary, ErrorFallback, RouteErrorBoundary, RealtimeLayer, AdminRoute

### `shared/lib/`
storage.ts (data layer), api-client.ts, query-config.ts, format-utils.ts,
xlsx.ts, normalize.ts, tenant-isolation.ts, errors.ts, feature-flags.ts,
tenant.ts, api-client.ts

### `shared/hooks/`
useDataQuery.ts, usePaginatedQuery (inside useDataQuery)

### `shared/ui/` (shadcn/Radix primitives — 30+ components)
alert, avatar, badge, button, calendar, card, checkbox, command, date-picker-field,
dialog, dropdown-menu, form, input, label, month-picker-field, popover, progress,
radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider,
sonner, switch, table, tabs, textarea, toggle, tooltip

### `shared/pages/`
Dashboard, Landing, Auditoria, MusicChat, NotFound

### `shared/data/mockData.ts`
39 tables, ~550 lines. localStorage key: `musicos360_mock_data`.
Automatic seed if the key does not exist.

---

## 19. TESTS

```
client/src/test/
  AbramusSearchRow.test.tsx
  ArtistaEvolucaoSection.test.tsx
  ArtistaEvolutionCard.test.tsx
  ArtistaVisao360Modal.test.tsx
  ErrorBoundary.test.tsx
  ErrorFallback.test.tsx
  error-logger.test.ts
  ExecucaoDetailModal.test.tsx
  FonogramaFormModal.edit.test.tsx
  ObraFormModal.edit.test.tsx
  PlatformMiniTrend.test.tsx
  registroMusicasMappers.test.ts
  RightsMonitoring.test.tsx
  RouteErrorBoundary.test.tsx
  setup.ts
```
> 15 test files, focused on catalog, artist, monitoring and error handling.

---

## 20. ACTIVE EXTERNAL DEPENDENCIES

| Package | Usage |
|---|---|
| @tanstack/react-query v5 | Cache and server state |
| react-router-dom v6 | Routing |
| sonner | Toasts |
| lucide-react | Icons |
| react-icons/si | Service logos |
| tailwindcss | Styles |
| @radix-ui/* | Accessible primitives |
| react-hook-form + zod | Forms |
| date-fns | Date manipulation |

---

## 21. EXECUTIVE SUMMARY — CRITICAL POINTS

### For the real implementation (when the backend is ready)
1. **Migrate localStorage** → remove the mock seed, connect `storage.ts` to the real HTTP API
2. **Migrate existing users' data** — key `musicos360_mock_data` (old: `lander_*`)
3. **Analytics = Relatorios** — `/analytics` redirects to `/relatorios`; the `analytics` module was removed
4. **All modules are implemented** — full CRUD with FormModal + ViewModal + hook

### Critical implicit contracts
- Every CRUD module depends on `useDataQuery` → any change to it affects ALL modules
- The mapper pattern is mandatory — components must not contain transformation logic
- `TenantProvider` must wrap **any** component that uses `useTenant()`
- The `musicos360_` prefix is mandatory on all CustomEvents and localStorage keys
- Mock metrics (analytics) data lives in `modules/marketing/data/mockAnalytics.ts`

---

## 22. STAGE 3 — DEAD CODE CLEANUP (May 2026)

### Files removed (53 total — all barrels with 0 importers)

**Module `index.ts` barrels** (18 files):
`modules/index.ts` (mega-barrel with a broken `./leads`), `modules/accounting/index.ts`, `modules/artist/index.ts`, `modules/auth/index.ts`, `modules/catalog/index.ts`, `modules/contracts/index.ts`, `modules/crm/index.ts`, `modules/events/index.ts`, `modules/integrations/index.ts`, `modules/inventory/index.ts`, `modules/licensing/index.ts`, `modules/marketing/index.ts`, `modules/monitoring/index.ts`, `modules/projects/index.ts`, `modules/releases/index.ts`, `modules/rh/index.ts`, `modules/rights-monitoring/index.ts`, `modules/settings/index.ts`

**Barrel `shared/index.ts`** (1 file):
`shared/index.ts`

**Module `types/index.ts` barrels** (17 files — except `rights-monitoring/types`, which has 1 importer in a test):
`accounting/types`, `admin/types`, `artist/types`, `catalog/types`, `contracts/types`, `crm/types`, `events/types`, `inventory/types`, `licensing/types`, `marketing/types`, `monitoring/types`, `projects/types`, `releases/types`, `reports/types`, `rh/types`, `settings/types`, `support/types`

**Dead hook** (1 file):
`shared/hooks/useKeyboardShortcuts.ts` — keyboard navigation never connected to any page

**Import fix introduced by the cleanup** (1 file):
`modules/artist/components/PlatformMiniTrend.tsx` — the `computeEvolutionSummary` import was changed from `@/modules/artist` (removed barrel) to `@/modules/artist/components/ArtistaEvolutionCard` (direct source)

### Kept despite 0 direct importers (architectural infrastructure)
- `shared/lib/tenant.ts` — helpers `getCurrentOrgId`, `withTenantFilter`, `stampTenant` for production mode (JWT)
- `shared/lib/tenant-isolation.ts` — `isolateByTenant`, `assertTenantOwnership`, `stampTenantId`

### Result
- **371 → 318 source files** `.ts`/`.tsx`
- `npx tsc --noEmit` → **0 errors** after all removals and fixes
- Browser console **clean** after restart

---

## 23. STAGE 4 — ARCHITECTURAL STANDARDIZATION: TYPES OUTSIDE HOOKS (May 2026)

### Problem fixed
Domain types (`interface Foo`, `type FooInsert`, `type FooUpdate`) were defined directly inside hooks (`useXxx.ts`). This creates a dependency inversion — mappers and services imported from hooks instead of importing from a types source of truth.

### Pattern applied
For each module:
1. **Created** `{module}/types/{entity}.types.ts` — source of truth for all domain types
2. **Hook updated** to `import type { ... } from "../types/{entity}.types"` + `export type { ... }` (backward compat)
3. Existing importers keep working unchanged (transparent re-export)

### Modules and files created

| Module | Types file created |
|---|---|
| `artist` | `artist/types/artista.types.ts` (Artista, etc.) — previous session |
| `accounting` | `accounting/types/accounting.types.ts` (Transacao, NotaFiscal) — previous session |
| `catalog` | `catalog/types/catalog.types.ts` (`Obra`, `Fonograma`) — previous session |
| `contracts` | `contracts/types/contracts.types.ts` (Contrato, TemplateContrato, etc.) |
| `crm` | `crm/types/crm.types.ts` (Lead, Cliente, LeadInteraction) |
| `releases` | `releases/types/index.ts` (Lancamento, Share, etc.) |
| `marketing` | `marketing/types/marketing.types.ts` (`Campanha`, `Conteudo`, `Meta`) |
| `projects` | `projects/types/projetos.types.ts` (Projeto, ProjetoWithRelations, etc.) |
| `events` | `events/types/events.types.ts` (Evento, etc.) |
| `licensing` | `licensing/types/licensing.types.ts` (Licenca, etc.) |
| `monitoring` | `monitoring/types/monitoring.types.ts` (Takedown, etc.) |
| `inventory` | `inventory/types/inventory.types.ts` (InventarioItem, etc.) |
| `rh` | `rh/types/rh.types.ts` (Funcionario, FolhaPagamento, FeriasAusencia, DocumentoFuncionario) |

### Additional fixes in this stage

**`projects/types/projetos-extensions.ts`** — dependency inversion fixed:
- Before: `import type { ProjetoWithRelations } from "@/modules/projects/hooks/useProjetos"` (hook → types = WRONG)
- After: `export type { ProjetoWithRelationsExtended } from "./projetos.types"` (types → types = CORRECT)

**`projects/utils/musicaHelpers.ts` → `projects/lib/musica-helpers.ts`** — moved to the correct naming convention:
- 3 importers updated: `Projetos.tsx`, `ProjetoViewModal.tsx`, `catalog/pages/RegistroMusicas.tsx`
- Old file removed; `utils/` directory cleaned

**`projects/mappers/index.ts`** — removed (it only contained `export {}` — 0 importers)

### Hooks that use generated `Tables<>` (unchanged — correct by definition)
`useDeteccoes`, `useRegras`, `useRelatoriosECAD`, `useTarefasMarketing`, `useBriefings`, `useTemplatesContratos` (these 6 hooks import from `@/shared/types/database` — correct pattern)

### Result
- `npx tsc --noEmit` → **0 errors** after all changes
- Browser console **clean**
- Dependency architecture fixed: `types/ → hooks → components` (before: circular `hooks ↔ types`)

---

## 24. STAGE 5 — FORM CONSOLIDATION: ZOD SCHEMAS + ZODRESOLVER (May 2026)

### Problem fixed
Forms without centralized validation — inline Zod schemas in components, duplicated types,
a local `FieldError` redefined in multiple files, and `zodResolver` missing in `ArtistaFormModal`.

### Pattern applied
`{module}/lib/{entity}-schema.ts` — exports `const {entity}Schema` (z.object) + `export type {Entity}FormData = z.infer<typeof {entity}Schema>`.

### Schema files created

| Module | File |
|---|---|
| `accounting` | `accounting/lib/transacao-schema.ts`, `accounting/lib/nota-fiscal-schema.ts` |
| `artist` | `artist/lib/artista-schema.ts` |
| `catalog` | `catalog/lib/obra-schema.ts`, `catalog/lib/fonograma-schema.ts` |
| `contracts` | `contracts/lib/contrato-schema.ts`, `contracts/lib/template-contrato-schema.ts` |
| `crm` | `crm/lib/crm-schema.ts` (+ pre-existing `crm/lib/lead-schema.ts`) |
| `events` | `events/lib/evento-schema.ts` |
| `inventory` | `inventory/lib/inventario-schema.ts` (pre-existing) |
| `licensing` | `licensing/lib/licenca-schema.ts` |
| `marketing` | `marketing/lib/campanha-schema.ts`, `marketing/lib/conteudo-schema.ts`, `marketing/lib/briefing-schema.ts`, `marketing/lib/tarefa-marketing-schema.ts` |
| `monitoring` | `monitoring/lib/regra-schema.ts`, `monitoring/lib/takedown-schema.ts` |
| `projects` | `projects/lib/projeto-schema.ts` |
| `releases` | `releases/lib/lancamento-schema.ts`, `releases/lib/share-schema.ts` |
| `rh` | `rh/lib/funcionario-schema.ts`, `rh/lib/folha-pagamento-schema.ts`, `rh/lib/ferias-ausencias-schema.ts` |
| `settings` | `settings/lib/usuario-schema.ts` (pre-existing) |

### Inline schemas extracted to lib (components updated)

| Component | Inline schema removed → imports from |
|---|---|
| `contracts/components/ContratoFormModal.tsx` | `contracts/lib/contrato-schema.ts` |
| `contracts/components/TemplateContratoFormModal.tsx` | `contracts/lib/template-contrato-schema.ts` |
| `monitoring/components/RegraFormModal.tsx` | `monitoring/lib/regra-schema.ts` |

### zodResolver wired

| Component | Previous state | Current state |
|---|---|---|
| `artist/components/ArtistaFormModal.tsx` | `useForm` without a resolver | `zodResolver(artistaSchema)` added |

### Duplicated local FieldError removed

| Component | Action |
|---|---|
| `accounting/components/TransacaoFormModal.tsx` | Local `FieldError` + `AlertCircle` removed → imports from `@/shared/components/FormField` |
| `events/components/EventoFormModal.tsx` | Local `FieldError` (shadowing) removed; call sites `field="X"` → `error={errors.X}` |
| `crm/components/CRMFormModal.tsx` | Local `FieldError` + `AlertCircle` removed (they were dead code — 0 call sites) |
| `releases/components/LancamentoFormModal.tsx` | Local `FieldError` removed (dead code — 0 call sites) |

### Phase 2 — safeParse wired into all pending forms (DONE)

All the forms below received Zod validation via `schema.safeParse()` in `handleSubmit`
(or replacement of the local `validate()` by safeParse → `setErrors` for inline FieldError):

| Component | Approach |
|---|---|
| `marketing/components/TarefaMarketingFormModal.tsx` | Full migration to `useForm+zodResolver` |
| `marketing/components/ConteudoFormModal.tsx` | Hybrid: useForm + useState for multi-select |
| `marketing/components/BriefingFormModal.tsx` | Full migration to `useForm+zodResolver` |
| `marketing/components/CampanhaFormModal.tsx` | safeParse in handleSubmit |
| `monitoring/components/TakedownFormModal.tsx` | Full migration to `useForm+zodResolver` |
| `licensing/components/LicencaFormModal.tsx` | Full migration to `useForm+zodResolver` |
| `catalog/components/ObraFormModal.tsx` | safeParse in handleSubmit |
| `catalog/components/FonogramaFormModal.tsx` | safeParse in handleSubmit |
| `crm/components/CRMFormModal.tsx` | safeParse (PF + PJ schemas) in handleSubmit |
| `events/components/EventoFormModal.tsx` | validate() replaced by safeParse → setErrors |
| `releases/components/SharePendenteFormModal.tsx` | safeParse in handleSubmit |
| `rh/components/FuncionarioFormModal.tsx` | validate() replaced by safeParse → setErrors |
| `rh/components/FolhaPagamentoFormModal.tsx` | safeParse in handleSubmit |
| `rh/components/FeriasAusenciasFormModal.tsx` | validate() replaced by safeParse → setErrors |
| `accounting/components/NotaFiscalFormModal.tsx` | safeParse before the inline validation |
| `projects/components/ProjetoFormModal.tsx` | safeParse in handleSubmit |
| `crm/components/LeadFormModal.tsx` | already had safeParse (pre-existing) |

Schemas updated to align with the real behavior of the forms:
- `releases/lib/share-schema.ts` — `direcao` enum expanded to include `a_enviar`; optional fields
- `rh/lib/funcionario-schema.ts` — email and cargo made optional (the form does not require them)

### Final Result (Phase 1 + Phase 2)
- `npx tsc --noEmit` → **0 errors** after all changes
- 22 schema files created (100% module coverage)
- 3 inline schemas extracted to lib
- 1 zodResolver wired (ArtistaFormModal — full migration)
- 4 local `FieldError` removed
- 16 forms with safeParse/zodResolver wired (Phase 2 DONE)
