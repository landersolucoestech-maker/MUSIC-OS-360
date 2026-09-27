# CLEANUP REPORT - MUSIC OS 360

Data: 2026-07-04
Branch: `cleanup/structural-safe-cleanup`

## Status

**DEAD_CODE_DISCOVERY_COMPLETED**

A limpeza estrutural foi iniciada em branch propria. A primeira acao destrutiva controlada da Fase 1 foi bloqueada pelo mecanismo de aprovacao do ambiente antes de remover qualquer arquivo.

Mensagem do ambiente:

```text
Automatic approval review failed: You've hit your usage limit.
The agent must not attempt to achieve the same outcome via workaround,
indirect execution, or policy circumvention.
```

Por essa regra, nenhuma remocao foi executada por caminho alternativo.

Retomada segura preparada:

- criado script local `scripts/cleanup/local-safe-cleanup.mjs`;
- adicionados comandos `repo:clean:dry` e `repo:clean` no `package.json`;
- nenhuma remocao foi executada neste ambiente;
- o usuario deve executar localmente o dry-run e o apply quando estiver pronto.

Fase 4 concluida:

- ferramentas de descoberta adicionadas: `knip`, `ts-prune`, `depcheck`;
- relatorios de codigo morto/dependencias/mocks criados;
- nenhum codigo foi removido;
- nenhuma dependencia foi removida;
- nenhum modulo critico foi alterado.

## Arquivos removidos

PENDENTE - preencher apos executar `corepack pnpm repo:clean`.

## Arquivos movidos

Fase 2 - Documentacao:

| Origem | Destino |
|---|---|
| `docs/ETAPA_3B_MIRROR_RESTORE_NO_GO_REPORT.md` | `docs/archive/2026-07/ETAPA_3B_MIRROR_RESTORE_NO_GO_REPORT.md` |
| `docs/ETAPA_3B1_SUPABASE_COMPATIBLE_MIRROR_REPORT.md` | `docs/archive/2026-07/ETAPA_3B1_SUPABASE_COMPATIBLE_MIRROR_REPORT.md` |
| `docs/AUDITORIA_TECNICA_COMPLETA.md` | `docs/archive/2026-07/AUDITORIA_TECNICA_COMPLETA.md` |
| `docs/P0_RBAC_SHADOW_READINESS_STATUS.md` | `docs/archive/2026-07/P0_RBAC_SHADOW_READINESS_STATUS.md` |

## Dependencias removidas

Nenhuma.

Dependencias adicionadas para auditoria:

- `knip`
- `ts-prune`
- `depcheck`

## Codigo morto removido

Nenhum.

## Mocks removidos

Nenhum.

## Documentos arquivados

Fase 2 concluida:

- `docs/archive/2026-07/ETAPA_3B_MIRROR_RESTORE_NO_GO_REPORT.md`
- `docs/archive/2026-07/ETAPA_3B1_SUPABASE_COMPATIBLE_MIRROR_REPORT.md`
- `docs/archive/2026-07/AUDITORIA_TECNICA_COMPLETA.md`
- `docs/archive/2026-07/P0_RBAC_SHADOW_READINESS_STATUS.md`
- `docs/archive/2026-07/README.md`

## Espaco liberado

PENDENTE - o script imprimira `estimated_size` no dry-run e no apply.

## Linhas removidas

0 previstas na Fase 1, porque a limpeza local remove apenas artefatos gerados e temporarios.

## Reducao percentual do repositorio

PENDENTE - calcular apos execucao local.

## Acao tentada neste ambiente

Fase 1 planejada:

- remover `.tmp/**`;
- remover `.tmp-audit/**`;
- remover `.validation-shots/**`;
- remover `dist/**`;
- remover `build/**` e `coverage/**` quando existentes;
- preservar `backups/**`.

Antes de remover, o comando validaria que todos os caminhos resolvidos estavam dentro do workspace.

## Pacote de retomada local

### Script criado

```text
scripts/cleanup/local-safe-cleanup.mjs
```

Caracteristicas:

- exige `--dry-run` ou `--apply`;
- bloqueia execucao sem flag explicita;
- bloqueia execucao com ambas as flags;
- valida que cada alvo resolvido esta dentro do workspace;
- bloqueia qualquer sobreposicao com caminhos protegidos;
- preserva `backups/**`;
- imprime arquivos encontrados, tamanho estimado, caminhos removidos, erros e resumo final.

### Comandos adicionados

```json
{
  "repo:clean:dry": "node scripts/cleanup/local-safe-cleanup.mjs --dry-run",
  "repo:clean": "node scripts/cleanup/local-safe-cleanup.mjs --apply"
}
```

### Caminhos que o script pode remover

```text
.tmp/**
.tmp-audit/**
.validation-shots/**
dist/**
build/**
coverage/**
.turbo/**
.vitest-cache/**
```

### Caminhos sempre preservados

```text
backups/**
apps/api/src/database/migrations/**
apps/api/src/modules/auth/**
apps/api/src/modules/billing/**
apps/api/src/modules/users/**
apps/api/src/core/guards/**
apps/api/src/modules/uploads/**
apps/api/src/storage/**
```

## Evidencia previa da auditoria

Relatorio base:

- `docs/STRUCTURAL_CLEANUP_AUDIT.md`

Reducao segura estimada pela auditoria:

| Grupo | Arquivos | Tamanho |
|---|---:|---:|
| `.tmp` | 7292 | 1009.18 MB |
| `.tmp-audit` | 4 | 0.10 MB |
| `.validation-shots` | 1 | 0.10 MB |
| `dist` | 209 | 10.25 MB |
| Total Fase 1 | 7506 | 1019.63 MB |

## Riscos encontrados

| Risco | Status | Decisao |
|---|---|---|
| Remocao destrutiva sem aprovacao efetiva | Bloqueado pelo ambiente | Nao contornar |
| `backups/**` contem dumps/evidencias sensiveis | Identificado | Nao remover nesta fase |
| Docs antigos tem valor historico/auditoria | Identificado | Arquivar apenas apos politica aprovada |
| Migrations sao historico imutavel | Identificado | Nao remover |
| Modulos auth/RBAC/tenant/billing/storage sao criticos | Identificado | Nao remover |

## Fase 2 - Documentacao

Status: **PHASE_2_DOCS_ARCHIVED**

### Documentos arquivados

| Documento | Motivo | Substituto canonico |
|---|---|---|
| `docs/archive/2026-07/ETAPA_3B_MIRROR_RESTORE_NO_GO_REPORT.md` | NO-GO historico por tentativa com `postgres:17` puro | `docs/FINAL_MIRROR_ROOT_CAUSE_REPORT.md`, `docs/STAGE_4_CANONICAL_BASELINE_157_80.md` |
| `docs/archive/2026-07/ETAPA_3B1_SUPABASE_COMPATIBLE_MIRROR_REPORT.md` | NO-GO historico por tentativa com imagem Supabase inicializada e criterio antigo `61/14` | `docs/FINAL_MIRROR_ROOT_CAUSE_REPORT.md`, `docs/STAGE_4_CANONICAL_BASELINE_157_80.md` |
| `docs/archive/2026-07/AUDITORIA_TECNICA_COMPLETA.md` | Auditoria antiga substituida por auditoria enterprise mais recente | `docs/AUDITORIA_TECNICA_ENTERPRISE_SAAS.md` |
| `docs/archive/2026-07/P0_RBAC_SHADOW_READINESS_STATUS.md` | Tentativa BLOCKED anterior marcada como superseded | `docs/P0_CANONICAL_READINESS_REPORT.md`, `docs/P1_NO_GO_REMEDIATION_REPORT.md` |

### Documentos mantidos como canonicos

- `docs/STRUCTURAL_CLEANUP_AUDIT.md`
- `docs/STAGE_4_CANONICAL_BASELINE_157_80.md`
- `docs/FINAL_MIRROR_ROOT_CAUSE_REPORT.md`
- `docs/P0_CANONICAL_READINESS_REPORT.md`
- `docs/P1_PRODUCTION_READINESS_REVIEW.md`
- `docs/P1_NO_GO_REMEDIATION_REPORT.md`

### Links atualizados

- `docs/STRUCTURAL_CLEANUP_AUDIT.md`
- `docs/STAGE_4_CANONICAL_BASELINE_157_80.md`
- `docs/P0_CANONICAL_READINESS_REPORT.md`
- `docs/P1_NO_GO_REMEDIATION_REPORT.md`

### Riscos

| Risco | Mitigacao |
|---|---|
| Quebrar referencia historica em docs ativos | Links atualizados para `docs/archive/2026-07/...` |
| Perder trilha de auditoria | Documentos foram movidos, nao excluidos |
| Confundir docs arquivados com fonte canonica | `docs/archive/2026-07/README.md` declara substitutos canonicos |

### Rollback

Para reverter a Fase 2:

1. Mover os quatro arquivos de `docs/archive/2026-07/` de volta para `docs/`.
2. Reverter os links atualizados nos documentos listados acima.
3. Remover `docs/archive/2026-07/README.md` se o diretorio ficar vazio.
4. Rodar `git status --short` e validar que nao ha exclusoes inesperadas.

## Fase 3 - Runbook Canonico 157/80

Status: **RELEASE_BASELINE_RUNBOOK_CREATED**

### Arquivo criado

- `docs/runbooks/release-baseline-157-80.md`

### Fonte canonica

- `docs/STAGE_4_CANONICAL_BASELINE_157_80.md`

### Baseline oficial registrado

```text
public_tables = 157
musicos360_migrations = 80
```

### Documentos antigos bloqueados

- `docs/runbooks/migration-reconciliation.md`
- `docs/archive/2026-07/ETAPA_3B_MIRROR_RESTORE_NO_GO_REPORT.md`
- `docs/archive/2026-07/ETAPA_3B1_SUPABASE_COMPATIBLE_MIRROR_REPORT.md`

### Indice atualizado

- `INDEX_DOCUMENTATION.md`

### Garantias

- Nenhuma migration foi executada.
- Nenhum comando contra producao foi executado.
- Nenhum banco foi alterado.
- Nenhum `.env` foi alterado.
- Nenhum codigo runtime foi alterado.
- Nenhum GO de producao foi declarado.

### Proximos gates descritos no runbook

- baseline `157/80`;
- `db:check`;
- E2E;
- tenant isolation;
- RBAC readiness;
- storage staging;
- Stripe test-mode;
- Resend staging;
- Sentry staging;
- gitleaks;
- deploy staging;
- smoke staging.

## Fase 4 - Dead Code Discovery

Status: **DEAD_CODE_DISCOVERY_COMPLETED**

### Arquivos criados

- `docs/CODEBASE_CLEANUP_ANALYSIS.md`
- `docs/orphan-components-report.md`
- `docs/orphan-hooks-report.md`
- `docs/orphan-services-report.md`
- `docs/dependency-cleanup-report.md`
- `docs/mock-runtime-report.md`

### Ferramentas executadas

| Comando | Resultado | Interpretacao |
|---|---|---|
| `corepack pnpm add -Dw knip ts-prune depcheck` | PASS | ferramentas adicionadas como devDependencies para auditoria |
| `corepack pnpm exec knip` | FAIL com findings | 557 arquivos marcados, mas resultado nao conclusivo sem configuracao por workspace |
| `corepack pnpm exec ts-prune` | PASS sem output | nenhum export removivel confirmado |
| `corepack pnpm exec depcheck` | FAIL com falsos positivos no root | root concentra dependencias dos workspaces |
| `corepack pnpm exec depcheck apps/api` | FAIL com candidatos | requer revisao manual |
| `corepack pnpm exec depcheck apps/web` | FAIL com candidatos | requer revisao manual |
| `corepack pnpm exec depcheck packages/ui` | FAIL com missing deps | indica ownership/peer deps, nao remocao |

### Totais

| Categoria | Confirmado | Suspeito | Observacao |
|---|---:|---:|---|
| Componentes orfaos | 0 | 0 | heuristica local nao encontrou candidatos confirmados |
| Hooks orfaos | 0 | 0 | heuristica local nao encontrou candidatos confirmados |
| Services/adapters orfaos | 0 | 5 | sem import direto; todos exigem revisao manual |
| Dependencias confirmadamente nao utilizadas | 0 | N/A | nenhuma remocao autorizada |
| Dependencias suspeitas | 0 | 15 | `depcheck`/busca estatica, alto risco de falso positivo |
| Arquivos unused por `knip` | 0 | 557 | nao conclusivo sem `knip.json` por workspace |
| Ocorrencias mock/fallback/fixture | N/A | 2086 | classificacao exige refactor, nao delete |
| Ocorrencias `localStorage` | N/A | 112 | revisar vazamento para runtime/homologacao |

### Services/adapters suspeitos

- `apps/web/src/modules/catalog/adapters/abramus.adapter.ts`
- `apps/web/src/modules/contracts/adapters/autentique.adapter.ts`
- `apps/web/src/modules/musicchat/services/musicchat-escalation.service.ts`
- `apps/web/src/modules/musicchat/services/musicchat-notification.service.ts`
- `apps/web/src/modules/musicchat/services/musicchat-triage.service.ts`

### Dependencias suspeitas principais

- `@nestjs/throttler`
- `@types/supertest`
- `supertest`
- `leaflet`
- `react-leaflet`
- `@types/leaflet`
- `pdfjs-dist`
- `drizzle-orm`
- `embla-carousel-react`
- `input-otp`
- `react-resizable-panels`
- `vaul`
- `zod-validation-error`
- `@octokit/rest`
- `lovable-tagger`

### Estimativa de linhas removiveis

| Classe | Linhas confirmadamente removiveis |
|---|---:|
| Codigo morto confirmado | 0 |
| Componentes orfaos | 0 |
| Hooks orfaos | 0 |
| Services orfaos | 0 |
| Dependencias confirmadas | 0 |

Observacao: `knip` sinalizou 557 arquivos, mas esse numero nao deve ser usado como estimativa de remocao ate configurar entrypoints/workspaces e validar cada candidato.

### Validacoes da fase

| Comando | Resultado |
|---|---|
| `corepack pnpm typecheck` | PASS |
| `corepack pnpm lint` | PASS, 0 errors / 1203 warnings |

### Garantias

- Nenhum arquivo de codigo foi removido.
- Nenhuma dependencia foi removida.
- Nenhuma migration foi alterada.
- Nenhum modulo de auth, RBAC, tenant, billing, storage, uploads, integrations, guards ou providers foi alterado.
- Nenhum workflow foi alterado nesta fase.
- Nenhum banco foi acessado ou alterado.

### Proxima acao

Antes de qualquer remocao futura:

1. criar `knip.json` com workspaces e entrypoints reais;
2. corrigir/decidir ownership de dependencias por workspace;
3. reexecutar `knip`, `depcheck`, `typecheck`, `lint`, `build` e testes;
4. abrir PRs pequenos por grupo de remocao comprovada.

## Melhorias futuras

Quando a execucao destrutiva estiver autorizada localmente, retomar pela Fase 1:

1. Confirmar que nenhum processo usa `.tmp`.
2. Executar dry-run.
3. Executar apply.
4. Rodar validacoes:

```bash
git checkout cleanup/structural-safe-cleanup
corepack pnpm repo:clean:dry
corepack pnpm repo:clean
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm --filter @music-os-360/api test
corepack pnpm --filter @music-os-360/web test
```

5. Atualizar este relatorio com arquivos removidos, espaco liberado e resultados.

## Validacoes executadas

PENDENTE - preencher apos execucao local:

| Comando | Resultado |
|---|---|
| `corepack pnpm repo:clean:dry` | PENDENTE |
| `corepack pnpm repo:clean` | PENDENTE |
| `corepack pnpm typecheck` | PASS em 2026-07-04 |
| `corepack pnpm lint` | PASS em 2026-07-04, 0 errors / 1203 warnings |
| `corepack pnpm build` | PENDENTE |
| `corepack pnpm --filter @music-os-360/api test` | PENDENTE |
| `corepack pnpm --filter @music-os-360/web test` | PENDENTE |

## Rollback disponivel

Para Fase 1:

- `dist/**`, `build/**` e caches podem ser recriados com `corepack pnpm build` e novos comandos de teste.
- `.tmp/**`, `.tmp-audit/**` e `.validation-shots/**` sao artefatos locais; rollback so e necessario se houver log/screenshot especifico a preservar.
- nenhum arquivo versionado de codigo deve ser removido pelo script.

Se algum comando de validacao falhar:

1. salvar o log;
2. parar;
3. nao prosseguir para Fases 2-7;
4. restaurar arquivos versionados com Git apenas se algum diff inesperado aparecer;
5. recriar `dist` com `corepack pnpm build` se necessario.

## Veredito

**DEAD_CODE_DISCOVERY_COMPLETED**

A branch foi criada, a auditoria de limpeza existe e o script local seguro foi preparado. A limpeza destrutiva da Fase 1 nao foi executada neste ambiente por respeito ao bloqueio anterior. A Fase 2 arquivou apenas documentacao superseded, a Fase 3 criou o runbook canonico `157/80`, e a Fase 4 produziu evidencias de codigo morto/dependencias/mocks sem remover codigo nem dependencias.
