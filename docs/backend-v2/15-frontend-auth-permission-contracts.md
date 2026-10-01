> Historical record. Kept as recorded; not the current contract.

# 15 — Autenticação, Tenant e Permissões no Frontend

Rastreamento read-only em `apps/web/**`. `apps/api` não foi consultado. Nenhum arquivo foi alterado. Regras de negócio fora do escopo (autenticação/tenant/RBAC) não foram analisadas.

**Princípio central confirmado no próprio código** (comentário em `usePermissions.ts`): *"O frontend apenas oculta/bloqueia/desabilita; o backend é a autoridade final."* Nada aqui deve ser lido como um limite de segurança real — é só o que a UI usa para decidir o que mostrar.

---

## AUTH (2 mecanismos)

```text
ARQUIVO: app/providers/AuthContext.tsx
SÍMBOLO/FUNÇÃO: AuthProvider / useAuth() — session, user (com user.role, user.mustChangePassword, user.org_id)

TIPO: AUTH

ORIGEM_DA_IDENTIDADE: Supabase Auth SDK (getSupabaseClient().auth.getSession()/onAuthStateChange()) — sessão persistida em localStorage sob a chave "musicos360_auth" (ver lib/supabase.ts)

ROLE/PERMISSION: N/A (identidade, não autorização — role é decodificado do JWT via app_metadata)

RECURSO_AFETADO: toda a aplicação (a sessão alimenta api-client.ts e TenantContext)

COMPORTAMENTO: mantém `session`/`user` em estado React; a cada mudança de sessão chama `setAccessToken()`/`setTenantId()` (bridge para api-client.ts)

EVIDÊNCIA: app/providers/AuthContext.tsx:112-122 (applyApiSessionState/clearApiSessionState), :200-220 (getSession/onAuthStateChange)
```

```text
ARQUIVO: shared/lib/api-client.ts
SÍMBOLO/FUNÇÃO: setAccessToken()/getAccessToken() + injeção do header Authorization em request()

TIPO: AUTH

ORIGEM_DA_IDENTIDADE: variável de módulo `_accessToken`, alimentada exclusivamente por AuthContext.tsx

ROLE/PERMISSION: N/A

RECURSO_AFETADO: toda chamada via `api.*` (não `publicApi.*`)

COMPORTAMENTO: injeta `Authorization: Bearer <token>` em toda chamada autenticada; em 401, limpa o token e ativa um circuit-breaker de 30s (ver doc 13)

EVIDÊNCIA: shared/lib/api-client.ts:26-35 (setAccessToken/getAccessToken), :160-162 (injeção do header)
```

## TENANT (2 mecanismos)

```text
ARQUIVO: app/providers/TenantContext.tsx
SÍMBOLO/FUNÇÃO: TenantProvider / useTenant() — tenant, permissionKeys, contextLoading, contextError

TIPO: TENANT

ORIGEM_DA_IDENTIDADE: GET /auth/context (SaasAuthContext.workspace/.membership — ver doc 10 caso 1) — com fallback para claims do JWT decodificado localmente enquanto a chamada não resolve

ROLE/PERMISSION: deriva `permissionKeys` de `context.membership.permissions` (string[] "resource:action") — a FONTE ÚNICA de permissão real (ver seção PERMISSION abaixo)

RECURSO_AFETADO: toda a aplicação (menus, gates de permissão, billing)

COMPORTAMENTO: mantém estado de tenant/permissões; nenhuma validação own do lado do cliente além de espelhar o que o servidor devolve

EVIDÊNCIA: app/providers/TenantContext.tsx:268-317 (useEffect de sincronização com /auth/context)
```

```text
ARQUIVO: shared/lib/api-client.ts
SÍMBOLO/FUNÇÃO: setTenantId()/getTenantId() + injeção do header X-Tenant-ID em request()

TIPO: TENANT

ORIGEM_DA_IDENTIDADE: variável de módulo `_tenantId`, alimentada por AuthContext.tsx (a partir de `mapped.user.org_id` da sessão Supabase, não de TenantContext.tsx)

ROLE/PERMISSION: N/A

RECURSO_AFETADO: toda chamada via `api.*` (não `publicApi.*`)

COMPORTAMENTO: injeta `X-Tenant-ID: <tenantId>` em toda chamada autenticada, se `_tenantId` estiver setado — nenhuma validação de formato/consistência do lado do cliente

EVIDÊNCIA: shared/lib/api-client.ts:37-43 (setTenantId/getTenantId), :164-166 (injeção do header)
```

## ROLE (2 mecanismos, 6 valores únicos de role)

```text
ARQUIVO: app/providers/tenant-labels.ts
SÍMBOLO/FUNÇÃO: ROLE_PERMISSIONS (matriz estática role→permissões por módulo) + getPermissionsFromToken()

TIPO: ROLE

ORIGEM_DA_IDENTIDADE: decodificação manual do JWT (`token.split(".")[1]`, `atob`, `payload.role`) — usado como FALLBACK/estado otimista, não como fonte de autorização real (essa é `membership.permissions`, via TenantContext)

ROLE/PERMISSION:
- valores de TenantRole: "owner", "admin", "manager", "editor", "viewer" (5 valores)
- matriz: owner/admin → acesso total (FULL_PERMISSION) em todos os 17 módulos; manager → total exceto audit/settings (READ_ONLY); editor → read+write (sem delete) em todos exceto audit/settings (NO_ACCESS); viewer → READ_ONLY em todos exceto audit/settings (NO_ACCESS)

RECURSO_AFETADO: `tenant.permissions` (estado inicial/otimista) — ACHADO: não há evidência de que `tenant.permissions` seja lido por `RequirePermission`/`usePermissions()` (que usam exclusivamente `permissionKeys`, uma fonte diferente) — parece ser estado decorativo/legado, não consultado pelos gates reais

COMPORTAMENTO: define o estado inicial de `tenant.permissions` antes do `/auth/context` resolver, e serve de fallback se o JWT não puder ser decodificado (default: viewer)

EVIDÊNCIA: app/providers/tenant-labels.ts:61-97
```

```text
ARQUIVO: App.tsx
SÍMBOLO/FUNÇÃO: SuperAdminGuard — `user?.role`

TIPO: ROLE

ORIGEM_DA_IDENTIDADE: `user.role` (string crua do AuthContext, decodificada do JWT — não é um dos 5 valores de TenantRole)

ROLE/PERMISSION: "super_admin" (6º valor de role encontrado, dimensão SEPARADA de TenantRole — usado só para o console administrativo da plataforma, não para módulos de tenant)

RECURSO_AFETADO: rotas `/admin/*` (via `adminRoutes(SuspenseRoute, SuperAdminRoute)`)

COMPORTAMENTO: redireciona para "/" se `!user || user.role !== "super_admin"`

EVIDÊNCIA: App.tsx:99-106
```

## PERMISSION (2 mecanismos, 4 verbos coarse únicos)

```text
ARQUIVO: shared/hooks/usePermissions.ts
SÍMBOLO/FUNÇÃO: usePermissions() — hasPermission/hasAllPermissions/hasAnyPermission/can/canModule

TIPO: PERMISSION

ORIGEM_DA_IDENTIDADE: TenantContext.permissionKeys (string[] "resource:action", vindo de GET /auth/context — membership.permissions) — a FONTE ÚNICA declarada explicitamente no comentário do arquivo

ROLE/PERMISSION:
- verbos coarse da UI (TenantModulePermission): "read", "write", "delete", "export" (4 valores)
- comportamento fail-open em DEV/AUTH_DISABLED (`devPermissive` sempre true → hasPermission sempre true); fail-closed em produção quando `permissionKeys === null` (isLoadingPermissions=true, gates renderizam fallback)

RECURSO_AFETADO: qualquer componente que use `usePermissions()`/`RequirePermission`/`useHasPermission`

COMPORTAMENTO: `can(resource,action)` monta a chave `${resource}:${action}` e verifica presença no Set de `permissionKeys`; `canModule(module,action)` traduz via `tenantModulePermissionKeys()` (permission-map.ts) antes de checar

EVIDÊNCIA: shared/hooks/usePermissions.ts:31-58
```

```text
ARQUIVO: shared/lib/permission-map.ts
SÍMBOLO/FUNÇÃO: MODULE_RESOURCE (18 chaves de módulo UI → resource) + TENANT_ACTION_BACKEND (verbo coarse → ações backend) + tenantModulePermissionKeys()

TIPO: PERMISSION

ORIGEM_DA_IDENTIDADE: mapa estático local (não vem do servidor) — é só uma tabela de tradução de nomes

ROLE/PERMISSION:
- 16 valores únicos de `resource` backend: artist, catalog, releases, contracts, accounting, crm, marketing, events, inventory, rh, monitoring, licensing, projects, leads, settings (usado por 3 módulos UI: settings, musicchat, admin), analytics (usado por: audit)
- tradução de verbo: read→["read"], write→["update","create"], delete→["delete"], export→["export"]

RECURSO_AFETADO: entrada para `canModule()`/`RequirePermission`

COMPORTAMENTO: pura tradução de nomes — comentário explícito no arquivo: "isto NÃO é uma matriz de autorização"

EVIDÊNCIA: shared/lib/permission-map.ts:13-49
```

## ROUTE_GUARD (5 mecanismos)

```text
ARQUIVO: App.tsx
SÍMBOLO/FUNÇÃO: AuthGuard

TIPO: ROUTE_GUARD

ORIGEM_DA_IDENTIDADE: useAuth().user (AuthContext)

ROLE/PERMISSION: N/A (só exige autenticação, não role/permissão)

RECURSO_AFETADO: todas as rotas envolvidas por `<ProtectedRoute>` (local a App.tsx — praticamente toda rota privada da aplicação, ver lista em App.tsx:171-189)

COMPORTAMENTO: redireciona para /auth se `!user` (exceto AUTH_DISABLED); mostra skeleton enquanto `loading`

EVIDÊNCIA: App.tsx:50-56
```

```text
ARQUIVO: App.tsx
SÍMBOLO/FUNÇÃO: PasswordChangeGuard

TIPO: ROUTE_GUARD

ORIGEM_DA_IDENTIDADE: useAuth().user.mustChangePassword

ROLE/PERMISSION: N/A

RECURSO_AFETADO: mesmas rotas de AuthGuard (composto dentro dele)

COMPORTAMENTO: redireciona para /change-required-password se `mustChangePassword===true` — comentário no código confirma que é um espelho best-effort do `MustChangePasswordGuard` do backend, não a defesa real

EVIDÊNCIA: App.tsx:58-67
```

```text
ARQUIVO: App.tsx
SÍMBOLO/FUNÇÃO: BillingGuard

TIPO: ROUTE_GUARD

ORIGEM_DA_IDENTIDADE: useBilling().isSuspended (BillingContext, derivado de GET /billing/subscription)

ROLE/PERMISSION: N/A

RECURSO_AFETADO: mesmas rotas, exceto allowlist (/billing, /configuracoes/billing, /support)

COMPORTAMENTO: redireciona para /billing/blocked se `isSuspended && !allowlisted`

EVIDÊNCIA: App.tsx:69-78
```

```text
ARQUIVO: App.tsx
SÍMBOLO/FUNÇÃO: SuperAdminGuard (ver também seção ROLE acima)

TIPO: ROUTE_GUARD

ORIGEM_DA_IDENTIDADE: useAuth().user.role

ROLE/PERMISSION: "super_admin"

RECURSO_AFETADO: rotas `/admin/*`

COMPORTAMENTO: redireciona para "/" se role ≠ "super_admin"

EVIDÊNCIA: App.tsx:99-106
```

```text
ARQUIVO: shared/infrastructure/ProtectedRoute.tsx
SÍMBOLO/FUNÇÃO: ProtectedRoute (componente standalone)

TIPO: ROUTE_GUARD

ORIGEM_DA_IDENTIDADE: useAuth().user

ROLE/PERMISSION: N/A

RECURSO_AFETADO: NENHUM — **ACHADO: código morto.** Busca por importadores (`from ".../infrastructure/ProtectedRoute"` ou `from "@/shared/infrastructure"` seguido de uso de `ProtectedRoute`) não encontra nenhum consumidor em `apps/web/src`. O `ProtectedRoute` realmente usado em App.tsx é uma constante local homônima (linha 91), definida no próprio arquivo, que NÃO importa este componente

COMPORTAMENTO: (mesma lógica de AuthGuard, mas nunca executada em produção)

EVIDÊNCIA: shared/infrastructure/ProtectedRoute.tsx:34-81; busca negativa por importadores em todo apps/web/src
```

## ACTION_GUARD (4 mecanismos)

```text
ARQUIVO: shared/components/RequirePermission.tsx
SÍMBOLO/FUNÇÃO: RequirePermission (alias: PermissionGate)

TIPO: ACTION_GUARD

ORIGEM_DA_IDENTIDADE: usePermissions().canModule()

ROLE/PERMISSION: parametrizado por `module`(TenantModuleKey) + `action`(read|write|delete|export) em cada uso

RECURSO_AFETADO: 14 usos em 10 páginas de módulo — ver tabela abaixo

COMPORTAMENTO: oculta (`fallback`, default null) se `!canModule()`; renderiza `loadingFallback` (default null) enquanto `isLoadingPermissions`

EVIDÊNCIA: shared/components/RequirePermission.tsx:26-36
```

```text
ARQUIVO: shared/components/RequirePermission.tsx
SÍMBOLO/FUNÇÃO: useHasPermission(module, action)

TIPO: ACTION_GUARD

ORIGEM_DA_IDENTIDADE: usePermissions().canModule() (mesmo mecanismo de RequirePermission, variante hook sem JSX wrapper)

ROLE/PERMISSION: mesmo padrão acima

RECURSO_AFETADO: não enumerado nesta etapa (hook companion, uso não buscado separadamente)

COMPORTAMENTO: retorna boolean, para uso em lógica condicional fora de JSX

EVIDÊNCIA: shared/components/RequirePermission.tsx:45-51
```

```text
ARQUIVO: shared/components/FeatureGate.tsx
SÍMBOLO/FUNÇÃO: FeatureGate

TIPO: ACTION_GUARD (mecanismo DIFERENTE — baseado em PLANO de assinatura, não RBAC)

ORIGEM_DA_IDENTIDADE: usePlanFeatures().features (não relacionado a role/tenant/permissão — é sobre o plano de billing do tenant)

ROLE/PERMISSION: N/A — usa `feature: keyof PlanFeatures` + `requiredPlan: "professional"|"enterprise"` (rótulo apenas exibido, não validado aqui)

RECURSO_AFETADO: telas/seções inteiras atrás de um paywall

COMPORTAMENTO: mostra tela de upsell ("não disponível... disponível a partir do plano X") com botão para /settings/billing, em vez de ocultar silenciosamente

EVIDÊNCIA: shared/components/FeatureGate.tsx:18-54
```

```text
ARQUIVO: shared/components/FeatureGate.tsx
SÍMBOLO/FUNÇÃO: FeatureRequired

TIPO: ACTION_GUARD (mesmo mecanismo de FeatureGate — variante sem UI de fallback)

ORIGEM_DA_IDENTIDADE: usePlanFeatures().features

ROLE/PERMISSION: N/A

RECURSO_AFETADO: não enumerado nesta etapa

COMPORTAMENTO: renderiza `children` só se a feature estiver no plano, senão `null` (silencioso, ao contrário de FeatureGate)

EVIDÊNCIA: shared/components/FeatureGate.tsx:56-66
```

### Todos os 14 usos de `RequirePermission` encontrados

| Página | Linha | module | action |
|---|---|---|---|
| accounting/pages/Financeiro.tsx | 236 | accounting | write |
| rh/pages/RH.tsx | 387 | rh | write |
| licensing/pages/Licenciamento.tsx | 178 | licensing | write |
| monitoring/pages/Monitoramento.tsx | 253 | monitoring | write |
| projects/pages/Projetos.tsx | 152 | projects | write |
| inventory/pages/Inventario.tsx | 106 | inventory | write |
| contracts/pages/Contratos.tsx | 149 | contracts | write |
| contracts/pages/Contratos.tsx | 365 | contracts | write |
| contracts/pages/Contratos.tsx | 370 | contracts | delete |
| catalog/pages/RegistroMusicas.tsx | 343 | catalog | write |
| events/pages/Agenda.tsx | 359 | events | write |
| artist/pages/Artistas.tsx | 253 | artists | write |
| artist/pages/Artistas.tsx | 572 | artists | write |
| artist/pages/Artistas.tsx | 582 | artists | delete |

Todos os 14 usos são `write` ou `delete` — nenhum módulo gateia `read`/`export` no nível de componente (consistente com o padrão de sempre mostrar dados, só ocultar ações de mutação).

---

## Mapeamento por endpoint (só onde rastreável com evidência concreta)

```text
METHOD: POST
ENDPOINT: /transactions
REQUIRED_ROLE: nenhum role específico (qualquer um cujo `permissionKeys` contenha "accounting:create" ou "accounting:update")
REQUIRED_PERMISSION: accounting:write (coarse) → resource:action real seria "accounting:create" (via TENANT_ACTION_BACKEND)
TENANT_REQUIRED: SIM (X-Tenant-ID sempre enviado — ver seção TENANT)
EVIDENCE: modules/accounting/pages/Financeiro.tsx:236-239 (RequirePermission module="accounting" action="write" envolvendo o botão "Nova Transação") → modules/accounting/services/accounting.service.ts:12-13 (createTransaction → storage.create("transacoes",...)) → TABLE_ENDPOINT["transacoes"]="/transactions" (doc 08)
```

```text
METHOD: DELETE
ENDPOINT: /artists/${id}
REQUIRED_ROLE: nenhum role específico
REQUIRED_PERMISSION: artists:delete (coarse) → "artist:delete"
TENANT_REQUIRED: SIM
EVIDENCE: modules/artist/pages/Artistas.tsx:582 (RequirePermission module="artists" action="delete") → modules/artist/services/artista.service.ts:33-35 (delete → storage.delete("artistas", id)) → TABLE_ENDPOINT["artistas"]="/artists"
```

```text
METHOD: POST
ENDPOINT: /contracts
REQUIRED_ROLE: nenhum role específico
REQUIRED_PERMISSION: contracts:write (coarse) → "contracts:create"
TENANT_REQUIRED: SIM
EVIDENCE: modules/contracts/pages/Contratos.tsx:149 (RequirePermission module="contracts" action="write") → modules/contracts/services/contracts.service.ts:24-25 (create → storage.create("contratos",...)) → TABLE_ENDPOINT["contratos"]="/contracts"
```

```text
METHOD: PATCH
ENDPOINT: /contracts/${id}
REQUIRED_ROLE: nenhum role específico
REQUIRED_PERMISSION: contracts:write (coarse) → "contracts:update"
TENANT_REQUIRED: SIM
EVIDENCE: modules/contracts/pages/Contratos.tsx:365 (segundo uso de RequirePermission module="contracts" action="write", em contexto de edição dentro de uma lista) → modules/contracts/services/contracts.service.ts:28-29 (update → storage.update("contratos", id, patch))
```

```text
METHOD: DELETE
ENDPOINT: /contracts/${id}
REQUIRED_ROLE: nenhum role específico
REQUIRED_PERMISSION: contracts:delete (coarse) → "contracts:delete"
TENANT_REQUIRED: SIM
EVIDENCE: modules/contracts/pages/Contratos.tsx:370 (RequirePermission module="contracts" action="delete") → modules/contracts/services/contracts.service.ts:32-33 (delete → storage.delete("contratos", id))
```

### Demais 9 usos de `RequirePermission` — módulo/ação confirmados, endpoint exato NÃO rastreado nesta etapa

```text
UNRESOLVED — rh:write (RH.tsx:387) → serviço rh.service.ts não lido nesta etapa
UNRESOLVED — licensing:write (Licenciamento.tsx:178) → licensing.service.ts não lido
UNRESOLVED — monitoring:write (Monitoramento.tsx:253) → monitoring.service.ts não lido
UNRESOLVED — projects:write (Projetos.tsx:152) → projects.service.ts não lido
UNRESOLVED — inventory:write (Inventario.tsx:106) → inventory.service.ts não lido
UNRESOLVED — catalog:write (RegistroMusicas.tsx:343) → catalog.service.ts não lido
UNRESOLVED — events:write (Agenda.tsx:359) → events.service.ts não lido
UNRESOLVED — artists:write (Artistas.tsx:253) → artista.service.ts tem create/update, mas o botão específico nesta linha não foi confirmado contra um deles
UNRESOLVED — artists:write (Artistas.tsx:572) → mesmo caso acima, segundo uso
```

Justificativa comum: todos esses módulos seguem o mesmo padrão arquitetural confirmado em `accounting`/`artists`/`contracts` (serviço fino sobre `storage.ts` → `TABLE_ENDPOINT`), então é PROVÁVEL que o mesmo padrão se aplique — mas "não deduzir pelo nome/padrão sem evidência direta" foi a regra explícita desta etapa, e os arquivos de serviço correspondentes não foram abertos para confirmar.

### Sobre TENANT_REQUIRED — cobertura ampla, não endpoint-a-endpoint

`X-Tenant-ID` é injetado automaticamente por `api-client.ts` para TODA chamada via `api.*` (não há opt-in/opt-out por endpoint no código do frontend — é uma propriedade do cliente compartilhado, não uma decisão por chamada). Isso cobre a totalidade dos ~253 call sites CANONICAL (dos 270 oficiais, excluindo 2 `publicApi.*` sem tenant, 3 DUPLICATE/DEFERRED sem tenant, e ~12 SPECIALIZED/EXTERNAL onde o cabeçalho é anexado manualmente em alguns — `reports-api.ts` blob e `company-logo.service.ts` — ou ausente em outros — OAuth/masks/IBGE/R2 — ver doc 04).

---

## Totais

```text
AUTH_MECHANISMS: 2

TENANT_MECHANISMS: 2

ROLES_FOUND: 6

PERMISSIONS_FOUND: 4

ROUTE_GUARDS: 5

ACTION_GUARDS: 4

HTTP_CALLS_WITH_EXPLICIT_PERMISSION_REQUIREMENT: 5

HTTP_CALLS_WITH_EXPLICIT_TENANT_REQUIREMENT: 253

UNRESOLVED_PERMISSION_REQUIREMENTS: 9

UNRESOLVED_TENANT_REQUIREMENTS: 0
```

Notas:
- `ROLES_FOUND` (6) = owner, admin, manager, editor, viewer (TenantRole) + super_admin (dimensão separada, só para `/admin/*`).
- `PERMISSIONS_FOUND` (4) = os 4 verbos coarse que o próprio código do frontend enumera como vocabulário fechado (`TenantModulePermission`: read/write/delete/export). As permissões finas reais (`resource:action`) são server-driven (`membership.permissions`) e não enumeráveis estaticamente a partir do frontend — os 16 `resource` e a tradução de verbos estão documentados na seção PERMISSION acima, mas não formam um conjunto fechado enumerável da mesma forma.
- `HTTP_CALLS_WITH_EXPLICIT_PERMISSION_REQUIREMENT` (5) = os 5 endpoints concretamente rastreados (POST /transactions, DELETE /artists/:id, POST /contracts, PATCH /contracts/:id, DELETE /contracts/:id).
- `UNRESOLVED_PERMISSION_REQUIREMENTS` (9) = os 9 usos restantes de `RequirePermission` (module/action conhecidos, endpoint exato não confirmado nesta etapa).
- `HTTP_CALLS_WITH_EXPLICIT_TENANT_REQUIREMENT` (253) = todos os call sites CANONICAL (via `api.*`) dos 270 oficiais — cobertura estrutural do cliente compartilhado, não uma lista endpoint-a-endpoint decidida individualmente no código.
- `UNRESOLVED_TENANT_REQUIREMENTS` (0) — para todos os 270 call sites já existe evidência direta (docs 04/06) de se o tenant é ou não anexado.

## Cobertura

Read-only em `apps/web/src`. Não foram lidos: `rh.service.ts`, `licensing.service.ts`, `monitoring.service.ts` (módulo diferente do `monitoring.service.ts` de financial-categories, verificar se existe), `projects.service.ts`, `inventory.service.ts`, `catalog.service.ts`, `events.service.ts` — os 9 casos UNRESOLVED de permissão dependem desses arquivos. `useHasPermission` e `FeatureRequired` não tiveram seus consumidores enumerados (só a definição). `apps/api` não foi consultado.
