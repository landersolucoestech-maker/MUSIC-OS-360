> Historical record. Kept as recorded; not the current contract.

# 41 — Ordem de Implementação dos 35 Domínios

Ordenação topológica read-only dos 35 domínios do [`38-domain-inventory.md`](./38-domain-inventory.md), respeitando integralmente as dependências obrigatórias aprovadas nos docs [`39`](./39-domain-dependency-map.md) e [`40`](./40-domain-dependency-final-resolution.md). Nenhuma arquitetura interna, controller, service, repository, schema ou migration foi definida. Nenhum arquivo foi alterado.

## Ordem numerada

```text
01 — auth
02 — external-lookups
03 — rbac
04 — core-entities-gateway
05 — company-settings
06 — uploads
07 — workspace-panel
08 — integrations
09 — ai
10 — audit
11 — support
12 — notifications
13 — conversations
14 — audiovisual
15 — reports
16 — billing
17 — contracts
18 — artists
19 — works
20 — phonograms
21 — shares
22 — releases
23 — events
24 — inventory
25 — hr
26 — licensing
27 — projects
28 — accounting
29 — admin-billing
30 — leads
31 — clients
32 — users
33 — marketing
34 — oauth-bridge
35 — dashboard
```

---

## Registro por domínio

```text
POSITION: 01
DOMAIN: auth
REQUIRED_DEPENDENCIES: NENHUMA
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (não aplicável — não tem dependências)
JUSTIFICATION: raiz de todo o sistema de sessão/tenant/permissões (doc39, Parte 1) — os outros 33 domínios (todos exceto external-lookups) dependem dele para AUTH e/ou TENANT; precisa vir primeiro.
```

```text
POSITION: 02
DOMAIN: external-lookups
REQUIRED_DEPENDENCIES: NENHUMA
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (não aplicável)
JUSTIFICATION: único domínio sem nenhuma dependência de auth/tenant (doc38: AUTH_REQUIRED/TENANT_SCOPED NÃO) — colocado cedo por não bloquear nem ser bloqueado por nada, mas poderia estar em qualquer posição sem violar a ordem.
```

```text
POSITION: 03
DOMAIN: rbac
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: depende só de auth; precisa vir antes de "users" (doc39: users→rbac, obrigatória) — colocado logo após a infraestrutura básica para não atrasar o domínio que depende dele.
```

```text
POSITION: 04
DOMAIN: core-entities-gateway
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: wrapper técnico que serve artists/works/phonograms/shares/contracts/releases/events/inventory/hr/licensing/projects (doc38) — precisa existir antes de qualquer um desses domínios de negócio o consumir.
```

```text
POSITION: 05
DOMAIN: company-settings
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele (doc39).
```

```text
POSITION: 06
DOMAIN: uploads
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; utilitário técnico sem dependentes registrados no doc39.
```

```text
POSITION: 07
DOMAIN: workspace-panel
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; utilitário de infraestrutura sem dependentes registrados.
```

```text
POSITION: 08
DOMAIN: integrations
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; precisa vir antes de "oauth-bridge" (doc39: oauth-bridge→integrations, obrigatória, para o redirect de Spotify).
```

```text
POSITION: 09
DOMAIN: ai
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
OPTIONAL_DEPENDENCIES: NENHUMA (ai é o ALVO das dependências opcionais marketing→ai e contracts→ai, não o dependente)
JUSTIFICATION: só depende de auth; é consumido opcionalmente por marketing e contracts (doc39), então precisa estar disponível antes deles, mas nada o bloqueia.
```

```text
POSITION: 10
DOMAIN: audit
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; é o ALVO da dependência opcional marketing→audit (doc39) — precisa existir antes de marketing, mas nada o bloqueia.
```

```text
POSITION: 11
DOMAIN: support
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; é dependência obrigatória de "dashboard" (doc40: dashboard→support) — precisa vir antes dele.
```

```text
POSITION: 12
DOMAIN: notifications
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 13
DOMAIN: conversations
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele (doc20/26 já esclareceram que é distinto do "MusicChat" fora de escopo).
```

```text
POSITION: 14
DOMAIN: audiovisual
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 15
DOMAIN: reports
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; doc40 confirmou que a dependência de "entidades reportáveis" é genérica/dinâmica por design (introspecção de schema), sem lista fixa de domínios-alvo — não impõe nenhuma restrição de ordem adicional.
```

```text
POSITION: 16
DOMAIN: billing
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; precisa vir antes de "admin-billing" (doc39: admin-billing→billing, obrigatória) e de "dashboard" (doc40: dashboard→billing indiretamente via accounting não, mas billing não é dependência direta do dashboard — nota: dashboard depende de accounting, não de billing diretamente, conferido no doc40).
```

```text
POSITION: 17
DOMAIN: contracts
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth (e do core-entities-gateway, já na posição 04); precisa vir antes de "clients" (doc39: clients→contracts, obrigatória) e de "dashboard" (doc40: dashboard→contracts, obrigatória).
```

```text
POSITION: 18
DOMAIN: artists
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT, PERMISSION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; é a dependência obrigatória mais reutilizada do grafo — precisa vir antes de "leads" (doc39: leads→artists), "marketing" (doc39: marketing→artists) e "dashboard" (doc40: dashboard→artists).
```

```text
POSITION: 19
DOMAIN: works
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT, PERMISSION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 20
DOMAIN: phonograms
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT, PERMISSION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 21
DOMAIN: shares
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 22
DOMAIN: releases
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; precisa vir antes de "dashboard" (doc40: dashboard→releases, obrigatória).
```

```text
POSITION: 23
DOMAIN: events
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT, PERMISSION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 24
DOMAIN: inventory
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT, PERMISSION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 25
DOMAIN: hr
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT, PERMISSION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 26
DOMAIN: licensing
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT, PERMISSION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 27
DOMAIN: projects
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT, PERMISSION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; nenhum outro domínio depende dele.
```

```text
POSITION: 28
DOMAIN: accounting
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM
JUSTIFICATION: só depende de auth; precisa vir antes de "dashboard" (doc40: dashboard→accounting, obrigatória).
```

```text
POSITION: 29
DOMAIN: admin-billing
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
- billing (DATA)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (auth@01, billing@16)
JUSTIFICATION: opera sobre o mesmo catálogo de planos/assinaturas de "billing" (doc39) — não pode vir antes dele.
```

```text
POSITION: 30
DOMAIN: leads
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
- artists (EVENT)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (auth@01, artists@18)
JUSTIFICATION: a conversão de lead produz um artista (doc39: crm.lead.converted invalida QUERY_KEYS.ARTISTAS) — "artists" precisa existir antes; também é dependência obrigatória de "dashboard" (doc40).
```

```text
POSITION: 31
DOMAIN: clients
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
- contracts (DATA)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (auth@01, contracts@17)
JUSTIFICATION: expõe GET /clients/${id}/contracts (doc39) — "contracts" precisa existir antes.
```

```text
POSITION: 32
DOMAIN: users
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
- rbac (DATA)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (auth@01, rbac@03)
JUSTIFICATION: atribuição de papel a usuário referencia um papel definido em "rbac" (doc39) — não pode vir antes dele.
```

```text
POSITION: 33
DOMAIN: marketing
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
- artists (DATA)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (auth@01, artists@18)
OPTIONAL_DEPENDENCIES:
- ai (INTEGRATION) — já disponível na posição 09
- audit (DATA) — já disponível na posição 10
JUSTIFICATION: artist-goals referencia artistas (doc39) — "artists" precisa existir antes; as dependências opcionais (ai, audit) já estão disponíveis antes desta posição, mas não seriam bloqueantes de qualquer forma.
```

```text
POSITION: 34
DOMAIN: oauth-bridge
REQUIRED_DEPENDENCIES:
- auth (AUTH, parcial — doc38 MISTO)
- integrations (INTEGRATION)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (auth@01, integrations@08)
JUSTIFICATION: o redirect de Spotify busca a URL de autorização em um endpoint do domínio integrations (doc39: BACKEND_AUTH_ENDPOINTS) — "integrations" precisa existir antes.
```

```text
POSITION: 35
DOMAIN: dashboard
REQUIRED_DEPENDENCIES:
- auth (AUTH, TENANT)
- artists (DATA)
- contracts (DATA)
- leads (DATA)
- support (DATA)
- marketing (DATA)
- accounting (DATA)
- releases (DATA)
DEPENDENCIES_ALREADY_BEFORE_IT: SIM (auth@01, support@11, billing→não é dependência direta, contracts@17, artists@18, releases@22, accounting@28, leads@30, marketing@33 — todas antes de 35)
JUSTIFICATION: agregador cross-domínio (doc40) — precisa vir depois de TODOS os domínios que compõem seu payload (OperationalDashboard), incluindo "leads" e "marketing", que só ficam prontos nas posições 30 e 33 — por isso "dashboard" só pode ser o último domínio da ordem.
```

---

## Validação

```text
TOTAL_DOMAINS_ORDERED: 35
DUPLICATED_DOMAINS: 0
MISSING_DOMAINS: 0
DEPENDENCY_ORDER_VIOLATIONS: 0
```

Conferência de violação feita edge a edge (todas as dependências obrigatórias dos docs 39/40): `admin-billing→billing` (29>16 ✓), `leads→artists` (30>18 ✓), `clients→contracts` (31>17 ✓), `users→rbac` (32>3 ✓), `marketing→artists` (33>18 ✓), `oauth-bridge→integrations` (34>8 ✓), `dashboard→{artists,contracts,leads,support,marketing,accounting,releases}` (35 > 18,17,30,11,33,28,22, todas ✓), e as 33+32+8 dependências universais de auth/tenant/permission (todas apontam para a posição 01, satisfeitas para todo domínio nas posições 02-35). Nenhuma violação encontrada.

## Cobertura

35/35 domínios do doc38 ordenados, cada um exatamente uma vez. Todas as dependências obrigatórias dos docs 39/40 foram respeitadas; as dependências opcionais (marketing→ai, marketing→audit, contracts→ai) foram registradas mas não usadas para forçar posição. Nenhuma arquitetura interna, controller, service, repository, schema ou migration foi definida — reservado para etapas posteriores. `apps/web` e `apps/api` não foram alterados. Nenhum doc anterior foi modificado.
