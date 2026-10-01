> Historical record. Kept as recorded; not the current contract.

# 01 — Auditoria das Alterações Não Commitadas

Documento gerado por inspeção read-only (`git status --short`, `git diff --stat`, `git diff --name-status`, `git diff --cached --name-status`, `git ls-files --others --exclude-standard`). Nenhum arquivo existente foi alterado, nenhum comando de escrita (`add`/`commit`/`stash`/`checkout`/`restore`/`reset`/`clean`/`tag`) foi executado.

## Resumo dos comandos

- `git diff --cached --name-status` → **vazio**. Não há nada staged no index.
- `git diff --name-status` (unstaged, working tree vs HEAD) → **34 arquivos** (33 modificados + 1 deletado).
- `git ls-files --others --exclude-standard` (não rastreados) → **2 arquivos**, ambos criados nesta própria sessão de auditoria (`docs/backend-v2/00-repository-state.md` e `reports/phase3-architecture.md`) — não são alterações pendentes pré-existentes de código de produto.
- `git status --short` também reporta os diretórios `docs/backend-v2/` e `reports/` como `??` (não rastreados) porque contêm apenas os 2 arquivos acima e outros arquivos de log/relatório pré-existentes que já estavam presentes no disco mas fora do índice do Git (não versionados).

> **Nota factual:** o snapshot de `git status` observado no início desta sessão de trabalho (antes deste PROMPT 02) listava dezenas de arquivos **staged** (`A`) em `apps/api/src/modules/reports/**` e vários relatórios em `reports/*.md`. Esses arquivos não aparecem mais como staged/modificados agora porque **já foram commitados** entre aquele snapshot inicial e o momento desta auditoria — confirmado via `git log --oneline -- apps/api/src/modules/reports/export/export-engine.service.ts`, que mostra commits recentes (`a85cf58c fix(reports): fail explicitly on oversized XLSX exports`, `83d487ab fix(reports): keep single-sheet separator local to export engine`, etc.) já no histórico do HEAD atual. Não é uma perda de trabalho nem uma anomalia — é progresso normal de commits ocorrido fora desta sessão. Os arquivos `.md`/`.json`/`.csv`/`.xlsx` de relatório da Fase 1/2 que estavam staged não foram encontrados no disco em `reports/` no momento desta auditoria (o diretório agora contém majoritariamente logs `build-health-pnpm-*.log` e `localhost-api-*.log`, mais o `phase3-architecture.md` criado nesta sessão) — registrado aqui como fato observado, sem investigação adicional (fora do escopo deste prompt).

## Lista completa — 34 arquivos com alterações não staged (working tree vs HEAD)

| # | Caminho | Status Git | Área | apps/web | apps/api | Config compartilhada | Docs/reports | Staged? |
|---|---|---|---|---|---|---|---|---|
| 1 | `.agents/agent_assets_metadata.toml` | D (deletado) | Config raiz (.agents) | Não | Não | Sim | Não | Não |
| 2 | `.env.example` | M | Config raiz (env) | Não | Não | Sim | Não | Não |
| 3 | `.env.staging.example` | M | Config raiz (env) | Não | Não | Sim | Não | Não |
| 4 | `.github/workflows/ci.yml` | M | CI/CD | Não | Não | Sim | Não | Não |
| 5 | `.github/workflows/staging.yml` | M | CI/CD | Não | Não | Sim | Não | Não |
| 6 | `apps/api/.env.dev.example` | M | apps/api (env) | Não | Sim | Não | Não | Não |
| 7 | `apps/api/.env.example` | M | apps/api (env) | Não | Sim | Não | Não | Não |
| 8 | `apps/api/.env.production.template` | M | apps/api (env) | Não | Sim | Não | Não | Não |
| 9 | `apps/api/SECURITY_ARCHITECTURE.md` | M | apps/api (doc interna) | Não | Sim | Não | Não | Não |
| 10 | `apps/api/migrate.mjs` | M | apps/api (script) | Não | Sim | Não | Não | Não |
| 11 | `apps/api/scripts/verify-supabase.ts` | M | apps/api (script) | Não | Sim | Não | Não | Não |
| 12 | `apps/api/seed.mjs` | M | apps/api (script) | Não | Sim | Não | Não | Não |
| 13 | `apps/api/src/app.module.ts` | M | apps/api (core) | Não | Sim | Não | Não | Não |
| 14 | `apps/api/src/core/config/env.schema.ts` | M | apps/api (core/config) | Não | Sim | Não | Não | Não |
| 15 | `apps/api/src/core/decorators/permissions.decorator.ts` | M | apps/api (core/RBAC) | Não | Sim | Não | Não | Não |
| 16 | `apps/api/src/core/guards/auth.guard.ts` | M | apps/api (core/guards) | Não | Sim | Não | Não | Não |
| 17 | `apps/api/src/core/guards/crud-permission-metadata.spec.ts` | M | apps/api (core/guards, teste) | Não | Sim | Não | Não | Não |
| 18 | `apps/api/src/core/guards/permissions.guard.spec.ts` | M | apps/api (core/guards, teste) | Não | Sim | Não | Não | Não |
| 19 | `apps/api/src/core/rbac/rbac-authority-mode.ts` | M | apps/api (core/RBAC) | Não | Sim | Não | Não | Não |
| 20 | `apps/api/src/core/security/security-startup.service.ts` | M | apps/api (core/security) | Não | Sim | Não | Não | Não |
| 21 | `apps/api/src/core/security/token-verifier.service.ts` | M | apps/api (core/security) | Não | Sim | Não | Não | Não |
| 22 | `apps/api/src/modules/integrations/spotify/spotify.service.ts` | M | apps/api (módulo integrations) | Não | Sim | Não | Não | Não |
| 23 | `apps/api/test/rbac-shadow-harness/rbac-shadow-harness.config.ts` | M | apps/api (teste) | Não | Sim | Não | Não | Não |
| 24 | `apps/web/.env.example` | M | apps/web (env) | Sim | Não | Não | Não | Não |
| 25 | `docker-compose.yml` | M | Config raiz (infra local) | Não | Não | Sim | Não | Não |
| 26 | `docs/ENTERPRISE_INFRASTRUCTURE.md` | M | Documentação | Não | Não | Não | Sim | Não |
| 27 | `docs/PROVISIONING_GUIDE.md` | M | Documentação | Não | Não | Não | Sim | Não |
| 28 | `docs/RUNBOOK_INCIDENT.md` | M | Documentação | Não | Não | Não | Sim | Não |
| 29 | `docs/SRE_RUNBOOK.md` | M | Documentação | Não | Não | Não | Sim | Não |
| 30 | `docs/STAGING_ARCHITECTURE.md` | M | Documentação | Não | Não | Não | Sim | Não |
| 31 | `docs/runbooks/release-baseline-157-80.md` | M | Documentação | Não | Não | Não | Sim | Não |
| 32 | `scripts/env-check.mjs` | M | Config raiz (script) | Não | Não | Sim | Não | Não |
| 33 | `scripts/verify-staging-secrets-presence.mjs` | M | Config raiz (script) | Não | Não | Sim | Não | Não |
| 34 | `server/ai-proxy.ts` | M | Outro (`server/`, fora de `apps/`) | Não | Não | Não* | Não | Não |

\* `server/ai-proxy.ts` não se encaixa em "config compartilhada" nem em `apps/web`/`apps/api` — é um diretório de nível raiz separado (`server/`), classificado como "Outro".

## Arquivos não rastreados (untracked) — 2 total

| Caminho | Área | Origem |
|---|---|---|
| `docs/backend-v2/00-repository-state.md` | Documentação (docs/reports) | Criado nesta sessão de auditoria (PROMPT 01) |
| `reports/phase3-architecture.md` | Documentação (docs/reports) | Criado nesta sessão, em auditoria read-only anterior (Fase 3, cluster de arquitetura) |

Nenhum outro arquivo não rastreado foi encontrado por `git ls-files --others --exclude-standard`.

## Contagem por área

| Área | Nº de arquivos (unstaged) |
|---|---|
| apps/api | 18 |
| apps/web | 1 |
| Config compartilhada (raiz: `.agents`, `.env*`, `.github/workflows`, `docker-compose.yml`, `scripts/*`) | 8 |
| Documentação (`docs/*`) | 6 |
| Outro (`server/`) | 1 |
| **Total** | **34** |

## Respostas específicas

```text
APPS_WEB_DIRTY: SIM
APPS_API_DIRTY: SIM
SHARED_CONFIG_DIRTY: SIM
STAGED_CHANGES: NÃO
UNTRACKED_FILES: SIM
```

## Cobertura

Análise limitada aos comandos Git solicitados (status/diff/ls-files). Não foi feita leitura do conteúdo (`git diff` completo linha-a-linha) de cada arquivo — apenas classificação de caminho/área, conforme escopo deste prompt ("Não analisar regras de negócio ainda").
