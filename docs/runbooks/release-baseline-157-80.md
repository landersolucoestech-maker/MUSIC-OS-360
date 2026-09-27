# RELEASE RUNBOOK - CANONICAL BASELINE 157/80

Data: 2026-07-04
Status: runbook oficial de release baseado no baseline canonico atual
Fonte canonica: `docs/STAGE_4_CANONICAL_BASELINE_157_80.md`

## 1. Objetivo

Definir o procedimento seguro de validacao de release do MUSIC OS 360 a partir do baseline canonico:

```text
public_tables = 157
musicos360_migrations = 80
```

Este runbook substitui qualquer roteiro baseado no baseline historico `61/14` e bloqueia definitivamente waves antigas.

## 2. Bloqueios Obrigatorios

Os documentos abaixo sao historicos e nao podem orientar execucao de release ou migrations:

- `docs/runbooks/migration-reconciliation.md` (versionado, marcado OBSOLETO)
- ETAPA 3B - Mirror Restore NO-GO Report (relatorio de sessao, nao versionado)
- ETAPA 3B.1 - Supabase-Compatible Mirror Report (relatorio de sessao, nao versionado)

A decisao tecnica que encerra o impasse 3B/3B.1 esta registrada na secao 6 de
`docs/STAGE_4_CANONICAL_BASELINE_157_80.md`.

Bloqueio explicito:

```text
ETAPA 3C antiga = BLOQUEADA
Waves antigas = BLOQUEADAS
Runbook 61/14 = NAO EXECUTAR
```

## 3. Regras De Seguranca

- Nao executar nada contra producao sem aprovacao explicita.
- Nao executar migrations neste runbook.
- Nao alterar banco.
- Nao alterar `.env`.
- Nao imprimir secrets.
- Nao executar Stripe live.
- Nao executar deploy de producao.
- Rodar comandos permitidos somente contra staging/mirror isolado.
- Parar imediatamente se houver risco de tocar production `DATABASE_URL`.

## 4. Pre-Flight Obrigatorio

Antes de qualquer validacao:

1. Confirmar branch/release candidate.
2. Confirmar que o ambiente alvo e staging ou mirror isolado.
3. Confirmar que variaveis de staging nao apontam para producao.
4. Confirmar que `DATABASE_URL` e `APP_DATABASE_URL` do processo apontam para staging/mirror.
5. Confirmar que `DATABASE_SESSION_CONTEXT_ENABLED=true`.
6. Confirmar que Stripe esta em test-mode.
7. Confirmar que Resend usa dominio/remetente de staging.
8. Confirmar que Sentry usa projeto/environment de staging.
9. Confirmar que R2 usa bucket staging.

Se qualquer item falhar:

```text
NO-GO
```

## 5. Validacao Do Baseline Atual

Objetivo: provar que o ambiente alvo esta no baseline canonico `157/80`.

Validar:

- `public_tables = 157`
- `public.musicos360_migrations = 80`
- sem migrations pendentes inesperadas
- registry de migrations consistente
- schema compativel com `docs/STAGE_4_CANONICAL_BASELINE_157_80.md`

Comando permitido, somente contra staging/mirror:

```bash
corepack pnpm --filter @music-os-360/api db:check
```

Resultado esperado:

```text
PASS
0 migrations pendentes inesperadas
baseline 157/80 confirmado
```

NO-GO se:

- baseline divergir de `157/80`;
- aparecer migration pendente inesperada;
- o comando apontar para producao;
- a conexao usar role indevida para runtime;
- `db:check` falhar.

## 6. Checagem De Novas Migrations Futuras

Este runbook nao executa migrations. Para novas migrations futuras:

1. Confirmar Task ID e RFC quando aplicavel.
2. Confirmar que a migration existe no repo.
3. Confirmar que a migration nao pertence a waves antigas.
4. Confirmar que a migration foi ensaiada em mirror/staging descartavel.
5. Confirmar rollback/forward-fix.
6. Confirmar revisao manual para schema/RLS/billing/auth/RBAC/storage.

Comando proibido neste runbook sem aprovacao explicita:

```bash
corepack pnpm --filter @music-os-360/api db:migrate
```

Se houver migration nova:

```text
NO-GO ate existir runbook especifico de migration futura
```

## 7. Validacao De RLS

Objetivo: garantir que RLS/FORCE RLS e policies criticas estao ativas no staging/mirror.

Validar:

- policies ativas;
- FORCE RLS nas tabelas tenant-scoped criticas;
- runtime app role sem `BYPASSRLS`;
- contexto de sessao tenant funcionando.

Comandos permitidos, somente contra staging/mirror:

```bash
corepack pnpm --filter @music-os-360/api db:check
corepack pnpm --filter @music-os-360/api test:e2e
```

NO-GO se:

- qualquer policy critica estiver ausente;
- app role tiver `BYPASSRLS`;
- E2E de RLS falhar;
- datasource nao inicializar.

## 8. Validacao De Tenant Isolation

Objetivo: provar que Tenant A nao le nem escreve dados do Tenant B.

Comando permitido:

```bash
corepack pnpm --filter @music-os-360/api verify:tenant-isolation
```

Resultado esperado:

```text
PASS
cross-tenant read = 0
cross-tenant write = 0
```

NO-GO se:

- qualquer leitura cross-tenant for possivel;
- qualquer escrita cross-tenant for possivel;
- script falhar sem evidencia clara;
- script rodar contra ambiente nao-staging.

## 9. Validacao De RBAC Readiness

Objetivo: validar readiness do RBAC em ambiente staging/mirror com decision logs reais.

Comando permitido:

```bash
corepack pnpm --filter @music-os-360/api rbac:readiness
```

Resultado esperado:

```text
PASS
>=1000 decisions quando aplicavel
>=10 endpoints quando aplicavel
>=5 resources quando aplicavel
>=5 roles quando aplicavel
>=3 tenants quando aplicavel
cross-tenant = 0
resolver failures = 0
```

NO-GO se:

- readiness falhar;
- decision logs forem insuficientes;
- houver divergencia allow/deny;
- houver cross-tenant finding;
- houver rota protegida sem criterio de permission esperado.

## 10. Validacao De Storage

Objetivo: validar R2/S3 staging e isolamento por tenant.

Comando permitido:

```bash
corepack pnpm --filter @music-os-360/api storage:e2e
```

Validar:

- HeadBucket;
- PutObject;
- GetObject;
- Presigned PUT;
- Presigned GET;
- ListObjects por prefixo tenant;
- DeleteObject;
- isolamento por tenant.

NO-GO se:

- qualquer operacao falhar;
- bucket for de producao;
- prefixo tenant estiver ausente;
- signed URL nao for validada;
- delete/cleanup falhar.

## 11. Validacao De Billing Staging

Objetivo: validar billing sem tocar Stripe live.

Obrigatorio:

- Stripe test-mode;
- webhook secret de staging;
- customer test;
- checkout session test;
- subscription test;
- upgrade/downgrade test;
- cancelamento test;
- reativacao test;
- eventos assinados recebidos em staging.

Eventos minimos:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

NO-GO se:

- qualquer chave Stripe live estiver no ambiente;
- webhook assinatura falhar;
- idempotencia falhar;
- persistencia local nao ocorrer;
- billing guard nao refletir `read_only`/`suspended` quando aplicavel.

## 12. Validacao De Resend Staging

Objetivo: validar email transacional em dominio/remetente staging.

Validar:

- `RESEND_API_KEY` staging;
- `RESEND_FROM_EMAIL` staging;
- SPF;
- DKIM;
- DMARC;
- envio de boas-vindas;
- envio de redefinicao de senha;
- envio de convite;
- envio de notificacao administrativa.

NO-GO se:

- dominio nao estiver validado;
- remetente apontar para producao indevidamente;
- qualquer envio obrigatorio falhar;
- bounce/rejection nao for monitorado.

## 13. Validacao De Sentry Staging

Objetivo: validar observabilidade ponta a ponta.

Validar:

- frontend exception capture;
- backend exception capture;
- release tracking;
- sourcemaps;
- traces;
- correlation id;
- tenant context sem PII indevida.

NO-GO se:

- DSN apontar para projeto errado;
- sourcemap nao resolver;
- backend nao capturar exception controlada;
- frontend nao capturar exception controlada;
- traces nao correlacionarem request frontend/backend.

## 14. Quality Gates Gerais

Comandos permitidos:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm --filter @music-os-360/api test:e2e
```

Resultado esperado:

- typecheck PASS;
- lint PASS;
- build PASS;
- E2E PASS.

NO-GO se qualquer gate falhar.

## 15. Security Gate

Obrigatorio:

- secret scan;
- `gitleaks` PASS;
- nenhum secret staging ausente;
- nenhum secret de producao em staging;
- CORS/CSP/security headers revisados;
- webhooks com assinatura e protecao contra replay quando aplicavel.

NO-GO se:

- `gitleaks` falhar;
- secret real estiver versionado;
- staging usar credencial de producao;
- webhook sem assinatura for exposto.

## 16. Deploy E Smoke Staging

Este runbook nao executa deploy automaticamente.

Antes de GO:

- deploy staging deve existir;
- deploy staging deve passar;
- smoke staging deve passar;
- rollback staging deve estar documentado;
- runbook de incidentes deve estar atualizado.

NO-GO se:

- deploy staging nao existir;
- deploy depender de placeholder;
- smoke staging falhar;
- rollback staging nao estiver testado ou documentado.

## 17. Comandos Permitidos

Somente contra staging/mirror isolado quando aplicavel:

```bash
corepack pnpm --filter @music-os-360/api db:check
corepack pnpm --filter @music-os-360/api test:e2e
corepack pnpm --filter @music-os-360/api verify:tenant-isolation
corepack pnpm --filter @music-os-360/api rbac:readiness
corepack pnpm --filter @music-os-360/api storage:e2e
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

## 18. Comandos Proibidos Sem Aprovacao Explicita

```bash
corepack pnpm --filter @music-os-360/api db:migrate
db:push
deploy
stripe live
qualquer comando contra production DATABASE_URL
qualquer wave antiga
ETAPA 3C antiga
```

Tambem proibido:

- alterar `.env` durante este runbook;
- imprimir secrets;
- aplicar migrations em producao;
- usar runbook `61/14`;
- usar owner/postgres como `APP_DATABASE_URL` runtime.

## 19. Criterio De GO

GO somente se todos forem verdadeiros:

- baseline `157/80` confirmado;
- `db:check` PASS;
- E2E PASS;
- tenant isolation PASS;
- RBAC readiness PASS;
- storage staging PASS;
- Stripe test-mode PASS;
- Resend staging PASS;
- Sentry staging PASS;
- `gitleaks` PASS;
- deploy staging PASS;
- smoke staging PASS;
- nenhum P0 aberto;
- nenhum P1 bloqueante aberto;
- risco de tocar producao = 0.

## 20. Criterio De NO-GO

NO-GO se qualquer item ocorrer:

- qualquer migration pendente inesperada aparecer;
- baseline divergir de `157/80`;
- qualquer gate RLS/RBAC/tenant/storage falhar;
- qualquer secret staging ausente;
- qualquer secret staging apontar para producao;
- deploy staging nao existir;
- smoke staging falhar;
- `gitleaks` falhar;
- houver risco de tocar producao;
- houver P0 aberto;
- houver P1 bloqueante aberto.

## 21. Rollback

Este runbook nao aplica mudancas, portanto nao deve exigir rollback de banco.

Rollback operacional para validacoes:

1. Parar no primeiro gate que falhar.
2. Preservar logs do comando.
3. Confirmar que nenhum comando proibido foi executado.
4. Se o deploy staging falhar, executar rollback staging conforme runbook do provider.
5. Se smoke staging falhar apos deploy, reverter para ultimo release staging conhecido e abrir incidente interno.
6. Nao promover para producao.

Rollback proibido:

- rollback manual em producao sem RFC/aprovacao;
- `db:rollback` em producao sem runbook especifico;
- restaurar dump em producao como acao improvisada.

## 22. Veredito Do Runbook

Este documento cria o processo operacional seguro para releases futuras baseadas em `157/80`.

Ele nao declara GO de producao.

Status:

```text
RUNBOOK_CREATED
PRODUCTION_GO = NOT_DECLARED
```
