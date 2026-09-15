# MUSIC OS 360 — Arquitetura de Segurança

> **Nota de atualidade (2026-09-15):** este documento predatava uma quantidade
> significativa de trabalho já concluído (ver §8) e não deve ser tratado como
> fonte corrente sem cruzar com o código. `docs/CODEBASE_MAP.md` é a fonte
> verificada mais recente sobre o estado real de segurança/tenancy deste
> repositório.

## Visão Geral

MUSIC OS 360 usa autenticação Supabase + RBAC hierárquico + RLS no banco de dados para garantir isolamento multi-tenant completo.

---

## 1. Fluxo de Autenticação JWT

```
Browser → Supabase Auth → JWT (ES256, JWKS)
         ↓
         Bearer token no header Authorization
         ↓
NestJS JwtAuthGuard → JWKS endpoint do Supabase
         ↓
         Verifica assinatura ES256
         ↓
         Extrai: sub (userId), app_metadata.org_id, app_metadata.role
         ↓
TenantGuard → valida org_id contra tabela tenants
         ↓
         req.auth = { userId, sessionId, orgId, orgRole }
         req.tenant = TenantEntity
         req.currentMember = OrgMemberEntity
         ↓
RolesGuard → compara currentMember.role com @RequireRole()
```

### Claims do JWT Supabase

| Claim | Valor | Uso |
|-------|-------|-----|
| `sub` | UUID do utilizador | `req.auth.userId` |
| `session_id` | UUID da sessão | `req.auth.sessionId` |
| `app_metadata.org_id` | UUID da organização | lookup em `tenants.org_id` |
| `app_metadata.role` | Role RBAC | ex: `admin`, `editor` |
| `email` | Email do utilizador | logging/audit |

### JWKS Endpoint

```
https://<SUPABASE_PROJECT_ID>.supabase.co/auth/v1/.well-known/jwks.json
```

O `JwtAuthGuard` usa `jwks-rsa` com cache de 1 hora para buscar chaves públicas.

---

## 2. Hierarquia de Roles (RBAC)

```
super_admin (6) > owner (5) > admin (4) > manager (3) > editor (2) > viewer (1)
```

| Role | Nível | Acesso |
|------|-------|--------|
| `viewer` | 1 | Leitura geral |
| `editor` | 2 | Criar e editar registos |
| `manager` | 3 | Gerir equipa, aprovar, excluir registos |
| `admin` | 4 | Gestão de utilizadores, configurações sensíveis |
| `owner` | 5 | Billing, configuração da org |
| `super_admin` | 6 | Acesso total — plataforma |

### Decorators

```ts
@RequireRole('editor')          // method-level
@Roles('admin')                 // class-level alias
@RequireRole('manager', 'admin') // OR logic — mínimo do array
```

---

## 3. Guard Chain (Global — APP_GUARD)

Todos os guards são registados globalmente em `app.module.ts`:

```
Request → RateLimitGuard → JwtAuthGuard → TenantGuard → RolesGuard → Controller
```

| Guard | Função |
|-------|--------|
| `RateLimitGuard` | Previne abuso (100 req/min/IP por padrão) |
| `JwtAuthGuard` | Verifica assinatura JWKS, rejeita expirados/inválidos |
| `TenantGuard` | Valida `org_id` → lookup em `tenants` + `org_members` |
| `RolesGuard` | Compara `currentMember.role` com `@RequireRole()` |

Rotas públicas (ex: webhook Stripe, health check) usam `@Public()` para bypass.

---

## 4. Isolamento Multi-Tenant

### Backend (NestJS)

Todas as queries de domínio recebem `tenant.id` via `@CurrentTenant()`:

```ts
@Get()
@RequireRole('viewer')
list(@CurrentTenant() tenant: { id: string }) {
  return this.service.list(tenant.id, query); // sempre filtrado por tenant_id
}
```

Nenhum repository retorna dados sem filtro `tenant_id`. Verificado em:
- `ArtistsService`, `WorksService`, `PhonogramsService`, `ContractsService`
- `TransactionsService`, `UsersService`, `HrService`, `AuditLogService`
- Todos os outros módulos de domínio

### TenantGuard — Lookup de Tenant

```ts
// Primary: app_metadata.org_id → tenants.org_id (UUID direto)
// Fallback: external_auth_org_id (backward-compat para tenants antigos)
WHERE (t.org_id::text = :orgId OR t.external_auth_org_id = :orgId)
  AND t.deleted_at IS NULL
```

---

## 5. Supabase RLS (Row-Level Security)

Script: `apps/api/supabase-rls.sql`

### Helper Functions

```sql
auth_org_id()   → UUID da org do JWT
auth_org_role() → role do utilizador do JWT
has_min_role(required) → boolean
```

### Política por Tabela

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `organizations` | own org | super_admin | super_admin | super_admin |
| `tenants` | org match | admin+ | admin+ | admin+ |
| `org_members` | org match | admin+ | admin+ | owner+ |
| `artists` | tenant | editor+ | editor+ | manager+ |
| `works` | tenant | editor+ | editor+ | manager+ |
| `phonograms` | tenant | editor+ | editor+ | manager+ |
| `contracts` | tenant | editor+ | editor+ | manager+ |
| `transactions` | tenant | editor+ | editor+ | manager+ |
| `audit_log` | manager+ | any member | — | — |
| `notifications` | own | manager+ | — | — |

---

## 6. RBAC por Módulo/Rota

| Módulo | Leitura | Escrita | Delete | Notas |
|--------|---------|---------|--------|-------|
| Artistas | viewer+ | editor+ | manager+ | |
| Obras/Fonogramas | viewer+ | editor+ | manager+ | |
| Contratos | viewer+ | editor+ | manager+ | |
| Transações (Accounting) | viewer+ | editor+ | manager+ | |
| HR (funcionários) | viewer+ | manager+ | admin+ | dados sensíveis |
| HR (payroll) | manager+ | manager+ | admin+ | muito sensível |
| ECAD Reports | manager+ | manager+ | admin+ | financeiro regulatório |
| Audit Log | manager+ | — | — | read-only |
| Utilizadores | manager+ | owner+ | owner+ | |
| Billing | admin+ (ver) | owner+ | owner+ | |
| Notificações | viewer (own) | manager+ | — | |
| AI Gateway | editor+ | editor+ | — | |
| Integrações | editor+ | admin+ | admin+ | |

---

## 7. Checklist de Validação

### Autenticação

- [x] Login com email/senha via Supabase
- [x] Sessão persiste no localStorage (`musicos360_auth`)
- [x] `onAuthStateChange` sincroniza sessão entre abas
- [x] Refresh token automático pelo SDK Supabase
- [x] Logout limpa sessão local e revoga no Supabase
- [x] Hard refresh mantém sessão (via `getSession()` no mount)
- [x] JWT expirado → `JwtAuthGuard` retorna 401 `"Token expirado"`
- [x] JWT inválido/adulterado → 401 `"Token inválido"`
- [x] JWT sem `kid` → 401 (sem chave JWKS para verificar)

### Multi-Tenant

- [x] `org_id` ausente no JWT → `TenantGuard` rejeita com 401
- [x] `org_id` sem tenant correspondente → 401
- [x] Tenant inativo (`active = false`) → 401
- [x] Utilizador não membro do tenant → 403
- [x] Cross-tenant data access impossível (queries sempre `WHERE tenant_id = ?`)
- [x] Supabase RLS como segunda linha de defesa

### RBAC

- [x] Rota sem `@RequireRole()` → aberta a qualquer membro autenticado do tenant
- [x] Role insuficiente → 403 com mensagem descritiva
- [x] Passthrough mode (sem DB) → permite tudo (dev local)
- [x] `super_admin` bypassa todas as restrições de role
- [x] `@Roles()` e `@RequireRole()` são funcionalmente equivalentes

### Segurança Adicional

- [x] Rate limiting global (RateLimitGuard)
- [x] Audit log em todas as mutações críticas (`@Audit()`)
- [x] CORS restrito a origens configuradas
- [x] Webhook Stripe verificado por HMAC
- [x] Dados PII encriptados em AES-256 (email, telefone, CPF/CNPJ)

---

## 8. Pendências / Próximos Passos

| Item | Prioridade | Descrição |
|------|-----------|-----------|
| Executar `supabase-rls.sql` | Alta | Aplicar RLS no projeto Supabase |
| Popular `app_metadata.org_id` | Alta | Definir org_id no Supabase Dashboard → Authentication → Users ou via trigger |
| Renomear `auth_user_id` → `supabase_user_id` | Média | Migration de schema (aguarda DB em produção) |
| Renomear `external_auth_org_id` → `ext_org_id` | Média | Mesmo — migration de schema |
| ~~Testes E2E de isolamento de tenant~~ | — | **Feito.** `apps/api/test/e2e/rls/rls-isolation.e2e-spec.ts` já cobre exatamente isto: INSERT/UPDATE/DELETE cross-tenant bloqueados (Postgres `42501`, `WITH CHECK`) contra um banco Postgres real, tenant A × tenant B, em dezenas de tabelas. Verificado em 2026-09-15 durante o handoff do Cartographer (`docs/CODEBASE_MAP.md`). |
| Teste de RBAC denial | Alta | Verificar que `viewer` não consegue `POST /contracts` |
| Expiração de JWT | Alta | Testar comportamento quando token expira mid-session |
| `super_admin` portal | Baixa | Interface de gestão de organizações |

---

## 9. Variáveis de Ambiente Necessárias

### Frontend (VITE_*)

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_USE_MOCK=false
VITE_MOCK_MODE=false
```

### Backend

```env
SUPABASE_URL=https://<project-id>.supabase.co
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<64-char hex>
```

---

## 10. Arquivos Chave

```
apps/api/src/core/guards/
  auth.guard.ts   → JwtAuthGuard (JWKS + ES256)
  tenant.guard.ts       → TenantGuard (org_id isolation)
  roles.guard.ts        → RolesGuard (RBAC hierarchy)

apps/api/src/core/decorators/
  roles.decorator.ts    → @RequireRole() + @Roles() aliases
  current-user.ts       → @CurrentUser() param decorator
  current-tenant.ts     → @CurrentTenant() param decorator
  public.decorator.ts   → @Public() bypass marker

apps/api/src/core/rbac/
  rbac.service.ts       → Permission matrix (can/assertCan)

apps/api/supabase-rls.sql → RLS policies para aplicar no Supabase
```
