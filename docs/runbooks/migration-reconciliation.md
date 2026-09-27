# OBSOLETO EM 2026-07-04

> **NAO EXECUTAR ESTE RUNBOOK.**
>
> Este documento usava o baseline historico `61` tabelas / `14` migrations e a
> premissa de waves antigas pendentes. A fonte de verdade atual validada pelo
> `DATABASE_URL` e `157` public tables / `80` registros em
> `public.musicos360_migrations`. A execucao de waves antigas esta bloqueada.
> Use `docs/STAGE_4_CANONICAL_BASELINE_157_80.md` como documento canonico.
# Runbook — Reconciliação de Migrations (Prod +66) · MUSIC OS 360

> Produção está **66 migrations atrás** (última aplicada `AddArtistIdToWorks20260523000001`; repo tem 79).
> Evidência já coletada (read-only, direto em prod): **0% perda de dados**, **0 órfãos/duplicatas/violações**, backfills com fail-safe. Ver auditorias DROP COLUMN / CRM / Migration-Failure.

## ⚠️ Pré-requisito bloqueante: mirror FIEL de produção
`create_branch` do Supabase **NÃO** reproduz o estado de prod (o schema é via TypeORM, não Supabase CLI → branch nasce quase vazio). Para um ensaio fiel, criar o mirror por **uma** das vias:
1. **pg_dump/restore:** `pg_dump` de prod (schema+dados) → restore num Postgres descartável/branch. **(recomendado)**
2. **Supabase branch com dados** (se disponível no plano) a partir de main.
3. **CI runner:** restaurar snapshot de prod e rodar o *migration runner* TypeORM.
**Não usar** `staging-go-live` (schema divergente, 142 tabelas).

Validação do mirror antes de começar (deve bater com prod):
```sql
-- comparar com prod: tabelas=61, musicos360_migrations=14, RLS/FORCE, row counts críticos
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r';
SELECT count(*) FROM musicos360_migrations;
```
Row counts críticos de referência (prod, hoje): tenants=2, org_members=11, artists≈105, contracts=72, transactions=89, billing_subscriptions=2, crm_tasks=4, releases=87; a maioria operacional=0.

## FASE 2 — Snapshot pré-migration (mirror)
```sql
-- migrations, contagem de tabelas, row counts das 14 tabelas críticas, RLS/FORCE, policies
SELECT string_agg(name,',' ORDER BY id) FROM musicos360_migrations;
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r';
-- counts: tenants, organizations, org_members, users, artists, works, phonograms, contracts, releases, transactions, leads, crm_tasks, billing_subscriptions, invoices
```

## FASE 3 — Aplicar as 66 por WAVES (ordem cronológica — TypeORM aplica sequencial)
> Usar o **migration runner** (`pnpm --filter @music-os-360/api db:migrate`) apontando `DATABASE_URL` para o **mirror**. As "waves" são checkpoints de validação; a ordem real é por timestamp.

| Wave | Migrations (faixa) | Conteúdo |
|---|---|---|
| **1 — Domínios aditivos** | `20260526…` → `20260609…` | financeiro categorias, audiovisual (9), marketing, registry/society, skills, workflow_executions, musicchat, notifications, genre |
| **2 — CRM** | `20260528000002` (+ backfill) | contacts/contact_*, operational_tasks · **backfill `crm_tasks(4) → operational_tasks`** |
| **3 — RBAC Enterprise** | `20260610…` → `20260614…` | permissions, roles, role_permissions, org structure, **backfill org_members.role_id**, decision logs, users projection, templates/aliases/inheritance |
| **4 — RLS/Tenant Hardening** | `20260612…` → `20260621…` | helpers RLS (PortableRlsTenantContext), FORCE RLS operacional, harmonização de policies, tenant_invitations, rbac_error_logs |
| **5 — Público + Billing** | `20260630…` + `20260701000001/002/003` | public artist registration, billing enforcement, billing plans, billing RLS hardening |

**Parar na primeira falha** e reportar (não continuar a wave).

## FASE 4 — Validações por wave (repetir após cada wave)
```sql
-- 1) migrations da wave registradas / nenhuma pendente
SELECT name FROM musicos360_migrations ORDER BY id DESC LIMIT 20;
-- 2) tabelas esperadas existem (ajustar por wave)
-- 3) dados críticos preservados (comparar counts com o snapshot FASE 2)
-- 4) órfãos = 0 (FKs de domínio) — reusar as queries da auditoria de falha
-- 5) RLS/FORCE consistente ; policies criadas
SELECT count(*) FILTER (WHERE relforcerowsecurity) AS force_on FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r';
```
Registrar por wave: **Migrations aplicadas · Tempo · Status(PASS/FAIL) · counts antes/depois**.
Checkpoints de dados conhecidos:
- Wave 2: `operational_tasks` recebe as **4** de `crm_tasks` (backfill); `count(operational_tasks) ≥ 4`.
- Wave 3: `org_members.role_id` **sem NULL** (fail-safe → viewer). `SELECT count(*) FROM org_members WHERE role_id IS NULL` = 0.
- Wave 5: `billing_plans` = 3 seeds (Stripe IDs NULL); `tenant_billing_state` backfilled (1 por tenant).

## FASE 5 — Validações finais do mirror (após as 66)
```sql
-- total migrations = repo (79) ; billing/RBAC/contacts existem
SELECT count(*) FROM musicos360_migrations;                       -- esperado: ~79
SELECT to_regclass('public.billing_plans'), to_regclass('public.payment_events'),
       to_regclass('public.tenant_billing_state'), to_regclass('public.roles'),
       to_regclass('public.permissions'), to_regclass('public.contacts'),
       to_regclass('public.operational_tasks');                   -- todos NOT NULL
-- registry_status CHECK válido (0 linhas violando) ; org_members.role_id preenchido
-- billing seeds (3) ; tenant_billing_state backfilled ; payment_events pronto (0 linhas, tabela ok)
-- tenant isolation: matriz A/B/system/super_admin (ver runbook de billing staging)
```
Comparar row counts críticos **antes vs depois**: devem ser **iguais** (aditivo) exceto onde há backfill (operational_tasks +4).

## FASE 6 — Relatório de risco (preencher com o resultado do ensaio)
1. 66 aplicaram sem erro? · 2. Tempo total? · 3. Perda de dados? (esperado: 0) · 4. Row counts inesperados? · 5. Falha de constraint? · 6. Falha de RLS? · 7. Falha de backfill? · 8. Warnings? · 9. Ajustes antes de prod?

## FASE 7 — Runbook de PRODUÇÃO (executar só após mirror PASS)
1. **Backup obrigatório** de prod (validado — ver `dr.md`). Confirmar restore testável.
2. **Janela de manutenção** (app read-only/pausa de writes se possível).
3. **Comandos:** `pnpm --filter @music-os-360/api db:migrate` (DATABASE_URL=prod owner). Aplica em ordem.
4. **Validações por wave** (mesmas queries da FASE 4) — parar e abortar na 1ª falha.
5. **Rollback:**
   - Falha numa migration aditiva → `down()` da migration + investigar; dados intactos.
   - Falha após várias waves → restaurar backup pré-janela (dados preservados).
   - CRM/backfill → idempotente; reexecutar após corrigir.
6. **Critérios de ABORTAR:** qualquer FAIL de constraint/backfill não previsto, row count crítico divergente, erro de RLS, tempo > SLA da janela.
7. **Checklist pós-migration:** `/health` 200 · login · isolamento tenant A/B · billing seeds · smoke dos módulos reativados (audiovisual/marketing/RBAC/CRM).

## Critérios para iniciar
- [ ] Mirror **fiel** de prod criado e validado (tabelas/migrations/counts batem)
- [ ] Backup de prod validado
- [ ] Backfill CRM (`crm_tasks→operational_tasks`) escrito/testado
- [ ] Janela + on-call + rollback prontos
