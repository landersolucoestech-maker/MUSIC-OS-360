> Historical record. Kept as recorded; not the current contract.

# Módulo: admin (Painel Super Admin)

Fase 2 do Prompt 97. Escopo: `apps/web/src/modules/admin/**` completo (9 páginas, 5 serviços reais,
1 layout, 1 componente de knowledge base) + dependências seguidas fora da pasta por import real
(`shared/infrastructure/AdminRoute.tsx`, `App.tsx::SuperAdminRoute`, `shared/hooks/useAudit`,
`shared/hooks/useIsAdmin`, backend `billing.controller.ts`, `support-tickets`, `audit-logs`). Lado
banco↔backend já resolvido na Fase 1 — não refeito aqui.

Read-only. `DATABASE_WRITES: 0`. Nenhum `.ts`/`.tsx` alterado.

## 1. Panorama — divisão real/fake muito nítida neste módulo

Ao contrário de `accounting` (onde os gaps eram pontuais), `admin` tem uma divisão estrutural clara:

| Página | Rota | Backend real? |
|---|---|---|
| AdminDashboard | `/admin/dashboard` | ✅ `adminTenantsService` + `adminBillingService` |
| AdminClients | `/admin/clients` | ✅ idem (CRUD de tenant) |
| AdminPlans | `/admin/plans` | ✅ `adminPlansService` → `/billing/plans*` |
| AdminSubscriptions | `/admin/subscriptions` | ✅ `adminBillingService` → `/billing/admin/subscriptions*` |
| AdminAudit | `/admin/audit` | ⚠️ real mas **tenant-scoped**, não cross-tenant (§4) |
| AdminSupport | `/admin/support` | ⚠️ real mas **tenant-scoped**, não cross-tenant (§4) |
| AdminKnowledge | `/admin/knowledge` | ❌ sem backend — mock dev-only, autodesabilitado em prod (honesto) |
| AdminSettings | `/admin/configuracoes` | ❌ **as 8 abas inteiras são decorativas** (§2) |
| Auditoria | `/configuracoes/auditoria` (via `settings.routes.tsx`, guard `AdminRoute`) | ferramenta de completude de dados cross-módulo, fora do escopo campo-a-campo desta passada (§7) |

## 2. `AdminSettings.tsx` — achado central: 8 abas, 0 funcionais

Lido por completo (770 linhas). Nenhuma das 8 abas persiste dado algum:

- **Geral / Email / Notificações**: todos os campos são `<input defaultValue>`/`<select defaultValue>`
  sem `onChange`→estado nem qualquer chamada de API. O botão "Salvar Alterações" (`SaveBar`) só
  executa `toast.success("Configurações salvas")` — **toast de sucesso falso, nenhuma escrita real**.
- **Segurança**: mesmos padrões — política de senha, 2FA, sessão, toggles de auditoria — todos
  `useState` local dentro do próprio componente `Toggle`, perdido ao fechar a aba. Mesmo `SaveBar` falso.
- **Webhooks**: `const WEBHOOKS: [...] = []` — comentário no código: *"virão da API real
  (/admin/webhooks) quando o endpoint existir. Nunca exibir dados fictícios — vazio até lá."*
  Botão "Novo Webhook" **não tem `onClick`** — clicar não faz nada. Campo "Webhook Secret" tem
  placeholder "Configurar via API de webhooks" (não funcional).
- **Chaves API**: idêntico — `const API_KEYS: [...] = []`, comentário "virão da API real quando o
  endpoint existir". Botão "Nova Chave API" **também sem `onClick`**.
- **Integrações**: usa `PLATFORM_PROVIDERS` (= `ADMIN_PLATFORM_PROVIDERS`, sempre `[]` — ver §3) como
  `useState` inicial. `toggleProvider`/`runHealthCheck` só mutam o estado local do React (nunca
  chamam API). `pendingPlatformAction` mostra um toast explícito: *"Configuração de provedor global
  será feita pela API de plataforma (pendente)."*
- **Usuários**: usa `ADMIN_USERS` (sempre `[]` — ver §3). Lista **permanentemente vazia**. **Não
  existe nenhum botão/fluxo de convite ou criação de usuário nesta tela** — a gestão de usuários
  exigida pela seção 4 do prompt simplesmente não existe na UI do admin.

Classificação: toda a árvore de componentes de `AdminSettings.tsx` (`TabGeral`, `TabEmail`,
`TabSeguranca`, `TabNotificacoes`, `TabWebhooks`, `TabChavesApi`, `TabIntegracoes`, `TabUsuarios`) é
`STATIC`/`DEAD` do ponto de vista de persistência — nenhuma delas tem `FRONTEND→HOOK→HTTP→BACKEND→
DATABASE` real. `REAL_MAPPING_GAP` único e sistêmico, não 8 gaps independentes.

## 3. `data/admin-source.ts` — fonte central, deliberadamente vazia

```ts
export const ADMIN_DATA_IS_MOCK = false as const; // "Não existem mais dados fictícios em nenhum modo"
export const ADMIN_KPIS = EMPTY_KPIS;              // todos os campos zerados
export const ADMIN_REVENUE = [];
export const ADMIN_PLANS = [];        // (mesma constante consumida pela Landing pública)
export const ADMIN_TENANTS = [];
export const ADMIN_SUBSCRIPTIONS = [];
export const ADMIN_USERS = [];
export const ADMIN_SECURITY_EVENTS = [];
export const ADMIN_NOTIFICATIONS = [];
export const ADMIN_INTEGRATIONS = [];
export const ADMIN_PLATFORM_PROVIDERS = [];
export const ADMIN_SYSTEM_METRICS = [];
```

Comentário do arquivo: *"Quando endpoints `/admin/*` reais existirem, substituir esta camada por
hooks que consomem a API real."* Verificado via grep repo-wide: **só 3 exports têm consumidor real**
— `ADMIN_NOTIFICATIONS`/`ADMIN_DATA_IS_MOCK` (`AdminLayout.tsx`) e `ADMIN_USERS`/
`ADMIN_PLATFORM_PROVIDERS` (`AdminSettings.tsx`, ver §2). Os outros 6 exports
(`ADMIN_KPIS`, `ADMIN_TENANTS`, `ADMIN_SECURITY_EVENTS`, `ADMIN_SYSTEM_METRICS`, `ADMIN_REVENUE`,
`ADMIN_SUBSCRIPTIONS`) **não têm nenhum consumidor em `apps/web/src`** — código morto puro.

### 3.1 Banner "Admin analytics indisponível" sempre visível (mesmo quando falso)

`AdminLayout.tsx`: `{!ADMIN_DATA_IS_MOCK && (<banner>Endpoints administrativos ainda não foram
implementados...</banner>)}`. Como `ADMIN_DATA_IS_MOCK` é `false` fixo, `!false = true` — **o banner
aparece em toda página admin, sempre**, mesmo nas 6 páginas (Dashboard/Clients/Plans/Subscriptions/
Audit/Support) que **têm** integração real. Mensagem desatualizada em relação ao estado real do
código — não é um bug funcional (não quebra nada), mas é uma informação incorreta exibida ao usuário
em toda sessão administrativa. `DISPLAY_MAPPING_MISMATCH`-adjacente, registrado como
`REAL_MAPPING_GAP` por afetar a interface, não uma coluna específica.

## 4. AdminAudit / AdminSupport — "cross-tenant" apenas na aparência

Ambos os serviços (`admin-audit.service.ts`, `admin-support.service.ts`) têm comentário idêntico no
código: usam os endpoints já existentes `GET /audit-logs` e `GET /support-tickets`
(`RequireRole('viewer')`/`RequireRole('manager')` respectivamente — **tenant-scoped por design**, não
rotas exclusivas de super-admin). Ambos os `toAdminX()` mappers fixam
`tenant_name: ""` explicitamente, com o comentário *"o endpoint é escopado ao tenant atual (não
expõe tenant_name)"*. Resultado: a coluna **"Tenant"** nas grids de `AdminAudit` e `AdminSupport`
está sempre vazia (nenhuma linha jamais preenche esse valor) — `DISPLAY_MAPPING_MISMATCH` real e
verificável. Mais amplamente: o "Super Admin" vendo `/admin/audit` ou `/admin/support` só vê os
logs/tickets do **seu próprio tenant atual**, não da plataforma inteira — uma limitação funcional
real frente ao que o nome/posicionamento do painel promete, não uma falha de segurança (não há
vazamento entre tenants — é isolamento correto, só que também aplicado onde um super-admin
legitimamente precisaria de visão cross-tenant).

## 5. Autorização — backend verificado, sem gap encontrado

`billing.controller.ts` lido: todas as 8 rotas `admin/tenants*`, `admin/subscriptions`,
`admin/invoices` exigem `@RequireRole('super_admin')` — igual ao guard de frontend
(`SuperAdminRoute`, checa `user.role === 'super_admin'`, redireciona para `/` senão). `GET
/billing/plans` exige `admin`; `POST/PATCH /billing/plans*` exige `super_admin` (visualizar catálogo
é menos privilegiado que alterá-lo — consistente, não é gap). `AUTHORIZATION_GAP: 0` — toda ação
visível no frontend tem enforcement equivalente ou mais estrito no backend.

Dois mecanismos de guard distintos coexistem por design, servindo propósitos diferentes:
`SuperAdminRoute` (App.tsx, checa `user.role === 'super_admin'`, usado em `admin.routes.tsx`) vs.
`AdminRoute` (`shared/infrastructure/AdminRoute.tsx`, usa hook `useIsAdmin()`, usado só para
`Auditoria.tsx` via `settings.routes.tsx`) — não é inconsistência, são dois níveis de admin
diferentes (plataforma vs. tenant), mas vale registrar que existem dois guards com nomes parecidos e
lógicas diferentes, risco de confusão futura para quem for dar manutenção.

## 6. Formulários reais (Create/Edit)

### AdminPlans — criar/editar plano (`/billing/plans`)

Mapeamento verificado via `toBackendDto()`/`toAdminPlan()` (transformação bidirecional completa e
correta): `name`, `color` (guardado dentro de `features.color`, JSON), `price_monthly`/`price_annual`
(reais↔centavos), `max_users`/`max_artists`/`max_storage_gb` (dentro de `limits{}` JSON),
`features[]` (dentro de `features.labels[]` JSON), `active`. 9 campos, `CREATE_SUPPORTED` e
`EDIT_SUPPORTED` para todos. Ações extras reais: excluir (soft — `PATCH active:false`, não DELETE) e
"Sincronizar com Stripe" (`POST /billing/plans/:id/sync-stripe`). Sem gaps.

### AdminClients — editar tenant

`UpdateAdminTenantPayload = Pick<AdminTenant, "name"|"owner_email"|"slug"|"country"|"plan"|"status">`
→ `PATCH /billing/admin/tenants/:id`. 6 campos, mapeamento direto, sem transformação. Sem gaps.
Não há **criação** de tenant nesta tela (só listagem/edição) — provisionamento de tenant acontece por
outro fluxo (onboarding/signup), fora do escopo deste módulo.

### AdminSubscriptions — ações de estado (não CRUD tradicional)

`suspendTenant(reason)`, `reactivateTenant(reason)`, `applyOverride(status, reason, until)`,
`removeOverride(reason)` — todas via `POST /billing/admin/tenants/:id/*`, mapeamento direto,
confirmadas reais e com `@RequireRole('super_admin')` no backend. Não são formulários de
create/edit de registro, são transições de estado — registradas aqui por completude.

## 7. `Auditoria.tsx` — ferramenta de completude, fora do escopo campo-a-campo

Página distinta de `AdminAudit.tsx` (logs de ação vs. completude de dados). Usa `useAudit()` +
`AuditModuleId` para checar campos faltantes em 10 módulos diferentes (artistas, projects, catalog
[obras+fonogramas], lancamentos, contratos, accounting, eventos, inventory, crm, serviços — este
último sem módulo real, `module: null`). Como sua substância real pertence a CADA um desses outros
módulos (ainda pendentes na Fase 2), o mapeamento campo-a-campo de "o que conta como incompleto para
cada entidade" fica registrado como **decisão de escopo explícita**: será coberto quando os módulos
`artist`, `projects`, `catalog`, `releases`, `contracts`, `accounting` (já feito), `events`,
`inventory`, `crm-relationships` forem auditados individualmente, não duplicado aqui. Confirmado:
rota real (`/configuracoes/auditoria`), guard `AdminRoute`, sem gap de roteamento.

## 8. Tables/Grids

| Tela | Colunas | Observação |
|---|---|---|
| AdminClients | Tenant, Plano, Status, Usuários, Storage, MRR, Ciclo, Próxima Cobrança, Método, (ações) | 10 — todas de `AdminTenant`/`AdminSubscription` reais |
| AdminSubscriptions | Cliente, Plano, Status, Ciclo, MRR, Início, Próx. Cobrança, Método, (ações) | 8 + sub-tabela de faturas (Data, Valor, Status = 3) |
| AdminSupport | #, Assunto, Tenant, Prioridade, Status, Atribuído, Criado | 7 — "Tenant" sempre vazio (§4) |
| AdminAudit | Ação, Entidade, Usuário, Tenant, IP, Detalhes, Quando | 7 — "Tenant" sempre vazio (§4) |
| AdminSettings (Usuários) | Usuário, Tenant, Role, MFA, Status, Sessões, Último Login | 7 — fonte 100% vazia (§2) |

Nenhuma tabela usa `SortableTableHead` (sem ordenação client nem server); nenhuma usa
`TablePagination` (listas completas renderizadas de uma vez — aceitável na escala atual de dados
administrativos, registrado sem julgamento).

## 9. Filtros / Busca

Todos client-side (mesmo padrão de `accounting`): AdminClients (busca + status + plano = 3),
AdminSubscriptions (busca + status = 2), AdminSupport (busca + status/tabs = 2), AdminAudit
(busca = 1), AdminSettings-Usuários (busca = 1). `BACKEND_FILTER: NENHUM` em todos — `.list()` de
cada serviço não aceita parâmetros de filtro, tudo filtrado em memória sobre o array já carregado.

## 10. Import / Export / Realtime / Storage

Nenhum encontrado em `modules/admin/**` (grep dedicado: 0 ocorrências de `xlsx`/`XLSX`/
`useRealtime`/`channel(`/`postgres_changes`/`type="file"`). `XLSX_EXPORTS: 0`,
`XLSX_RULE_VIOLATIONS: 0`, `REALTIME_EVENTS: 0`, `STORAGE_FIELDS: 0`.

## 11. Users / Auth — distinção auth.users / application users / app.users

Nenhum código deste módulo referencia `auth.users` ou `app.users` diretamente. `AdminRoute`/
`SuperAdminRoute` consomem `useAuth()` (contexto de sessão, en cima de `auth.users` via Supabase
Auth, já mapeado em doc80 §3) e checam `user.role` (campo de aplicação, não de `auth.users`). A
única "gestão de usuários" da UI admin (`TabUsuarios`) está completamente não-funcional (§2) — não
há, neste módulo, nenhum fluxo real de convite/ativação/desativação/reset de senha administrado
centralmente; esses fluxos (quando existem) pertencem ao módulo `auth`/`settings` de cada tenant,
não ao painel super-admin.

## Resumo

```text
STATUS: CONCLUÍDO (módulo admin)
MODULE_STATUS: COMPLETE
UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_COLUMNS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_PERMISSIONS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
REAL_MAPPING_GAPS: 6 (AdminSettings 8 abas 100% decorativas; AdminKnowledge sem backend, dev-only
  autodesabilitado em prod; banner "endpoints não implementados" sempre visível mesmo quando falso;
  6 exports mortos em admin-source.ts; AdminAudit/AdminSupport tenant-scoped apesar da moldura
  cross-tenant; botões "Novo Webhook"/"Nova Chave API" sem onClick)
AUTHORIZATION_GAPS: 0 (backend confirma @RequireRole('super_admin') em toda rota admin/billing real)
TENANT_ISOLATION_GAPS: 0 (isolamento correto; limitação é de funcionalidade, não de segurança)
```
