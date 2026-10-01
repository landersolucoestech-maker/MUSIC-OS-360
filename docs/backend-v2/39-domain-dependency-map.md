> Historical record. Kept as recorded; not the current contract.

# 39 — Mapa de Dependências entre Domínios

Análise read-only dos 35 domínios do [`38-domain-inventory.md`](./38-domain-inventory.md). Nenhuma ordem de implementação, arquitetura, tabela ou migration foi definida. Nenhum arquivo foi alterado. Nenhum domínio novo foi criado (nenhum erro comprovado foi encontrado no doc38).

## Metodologia

Toda dependência abaixo tem evidência concreta citada (endpoint, campo, evento ou consumidor) — nenhuma foi registrada por "parecerem relacionados". Duas categorias de dependência aparecem em quase todos os domínios (`AUTH`/`TENANT`, herdadas do padrão canônico já estabelecido no doc34/37) e são apresentadas em tabela única para não repetir 33 blocos idênticos; as dependências de negócio distintas (`DATA`/`BUSINESS_RULE`/`INTEGRATION`/`EVENT`) têm um bloco dedicado cada. `PERMISSION` é tratada como uma variação de dependência do domínio `auth` (fonte real de `membership.permissions`, via `GET /auth/context`), não do domínio `rbac` (que é onde papéis/permissões são *definidos*, não onde um domínio de negócio *consome* seu próprio gate de permissão).

---

## Parte 1 — Dependências universais (AUTH / TENANT)

33 dos 35 domínios dependem do domínio `auth` para autenticação (`AUTH_REQUIRED` herdado do padrão canônico, doc34/37); 32 desses 33 também dependem dele para contexto de tenant (`X-Tenant-ID`). As 2 exceções sem nenhuma das duas são `auth` (a própria fonte) e `external-lookups` (serviços de terceiros, sem relação com a auth do sistema, doc38).

```text
DOMAIN → auth (todos os 33 abaixo)
DEPENDENCY_TYPE: AUTH
DEPENDENCY_REASON: toda operação exige Authorization: Bearer <token> válido, obtido/validado pelo domínio auth
DEPENDENCY_EVIDENCE: AUTH_REQUIRED: SIM ou MISTO em cada domínio, doc38 (herdado de api-client.ts, doc04/17)
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO

Domínios: artists, works, phonograms, shares, contracts, releases, events, inventory, hr, licensing, projects, accounting, billing, admin-billing, support, audit, leads, clients, company-settings, users, rbac, integrations, ai, conversations, marketing, audiovisual, reports, notifications, dashboard, oauth-bridge, uploads, workspace-panel, core-entities-gateway
```

```text
DOMAIN → auth (32 dos 33 acima — todos exceto oauth-bridge)
DEPENDENCY_TYPE: TENANT
DEPENDENCY_REASON: toda operação (exceto a troca de código OAuth, que usa exchange_token de uso único em vez de X-Tenant-ID) exige o header X-Tenant-ID, resolvido a partir do JWT obtido no domínio auth
DEPENDENCY_EVIDENCE: TENANT_SCOPED: SIM ou MISTO em cada domínio, doc38; oauth-bridge é a única exceção documentada (doc05/30: "SEM X-Tenant-ID" explícito)
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO

Domínios: os mesmos 33 acima, exceto oauth-bridge (32 no total)
```

```text
DOMAIN → auth (8 domínios com gate de permissão explícito, doc16)
DEPENDENCY_TYPE: PERMISSION
DEPENDENCY_REASON: a UI só habilita a ação de escrita quando a permissão coarse-action correspondente está presente em membership.permissions, entregue por GET /auth/context (domínio auth) — não pelo domínio rbac, que é onde papéis/permissões são definidos, não consumidos
DEPENDENCY_EVIDENCE: doc16, Casos 1-9 (rh:write, licensing:write, monitoring:write[sem endpoint], projects:write, inventory:write, catalog:write, events:write, artists:write — 8 módulos com Caso individual resolvido, excluindo "monitoring" que não tem endpoint real, doc16 Caso 3)
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO

Domínios: hr, licensing, projects, inventory, works, phonograms, events, artists
```

---

## Parte 2 — Dependências de negócio distintas (evidência específica por par)

### `users → rbac`

```text
DEPENDENCY_TYPE: DATA
DEPENDENCY_REASON: a atribuição de papel a um usuário (PATCH /users/${id}/role, PATCH /users/${userId}/role) e o convite de novo usuário (POST /users/invitations) referenciam um papel que precisa existir no domínio rbac — sem um papel válido, a atribuição não tem sentido funcional
DEPENDENCY_EVIDENCE: doc37/38 — endpoints PATCH /users/${id}/role e POST /users/invitations (domínio users) versus POST /rbac/roles, GET /rbac/roles (domínio rbac); doc15/16 (RBAC como fonte única de papéis)
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO
```

Nenhuma evidência inversa (`rbac → users`) foi encontrada — os endpoints de `rbac` (definição de papéis, permissões, grants, herança) não referenciam um usuário específico em nenhum path/consumidor documentado. **Não é um ciclo.**

### `clients → contracts`

```text
DEPENDENCY_TYPE: DATA
DEPENDENCY_REASON: o domínio clients expõe uma visão de contratos vinculados a um cliente específico
DEPENDENCY_EVIDENCE: GET /clients/${clientId}/contracts (doc05/37, modules/crm-relationships/services/clients.service.ts:143)
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO
```

Nenhuma evidência inversa (`contracts → clients`) foi encontrada — os endpoints de `contracts` são inteiramente genéricos via `core-entities-gateway`, sem nenhum path ou consumidor documentado referenciando um cliente. **Não é um ciclo.**

### `marketing → artists`

```text
DEPENDENCY_TYPE: DATA
DEPENDENCY_REASON: o domínio marketing gerencia metas por artista (artist-goals) — a própria nomenclatura do recurso e seu consumidor (useMetas.ts, módulo marketing) evidenciam a referência a um artista
DEPENDENCY_EVIDENCE: POST/GET/PATCH/DELETE /artist-goals(/${id}) (doc05/37, modules/marketing/hooks/useMetas.ts)
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO
```

### `admin-billing → billing`

```text
DEPENDENCY_TYPE: DATA
DEPENDENCY_REASON: admin-billing opera sobre o mesmo catálogo de planos e as mesmas assinaturas que o domínio billing expõe ao próprio tenant — é uma visão administrativa cross-tenant do mesmo dado, não uma entidade nova
DEPENDENCY_EVIDENCE: GET /billing/plans (billing) vs. GET /billing/plans?includeInactive=true + POST/PATCH /billing/plans(/${id}) (admin-billing) — mesmo recurso "plans", visões diferentes (doc05/37)
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO
```

### `marketing → audit`

```text
DEPENDENCY_TYPE: DATA
DEPENDENCY_REASON: o serviço de marketing grava explicitamente uma entrada de audit log como efeito colateral de uma de suas operações
DEPENDENCY_EVIDENCE: POST /activity-logs — consumidor modules/marketing/services/marketing.service.ts:772 (doc05 linha 237)
REQUIRED_DEPENDENCY: NÃO
OPTIONAL_DEPENDENCY: SIM
```

### `oauth-bridge → integrations`

```text
DEPENDENCY_TYPE: INTEGRATION
DEPENDENCY_REASON: para Spotify (spotify_ads/corp_spotify), o popup de OAuth não constrói a URL de autorização no cliente — ele busca a URL pronta em um endpoint do domínio integrations
DEPENDENCY_EVIDENCE: BACKEND_AUTH_ENDPOINTS = { spotify_ads: "/integrations/spotify/auth", corp_spotify: "/integrations/spotify/auth" } em OAuthPopupPage.tsx (doc30/33) — GET /integrations/spotify/auth pertence ao domínio integrations
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO
```

### `marketing → ai`

```text
DEPENDENCY_TYPE: INTEGRATION
DEPENDENCY_REASON: o roteador de provedores de IA usado pelo módulo de marketing chama o domínio ai para gerar conteúdo (copy, sugestões)
DEPENDENCY_EVIDENCE: modules/marketing/ai/providers/providerRouter.ts → POST /ai/generate (doc05/35)
REQUIRED_DEPENDENCY: NÃO
OPTIONAL_DEPENDENCY: SIM
```

### `contracts → ai`

```text
DEPENDENCY_TYPE: INTEGRATION
DEPENDENCY_REASON: o parser semântico de contratos chama o domínio ai para interpretar texto de contrato
DEPENDENCY_EVIDENCE: modules/contracts/services/semantic-parser.service.ts:210 → POST /api/v1/ai/generate (doc05/35, mesmo destino final de /ai/generate)
REQUIRED_DEPENDENCY: NÃO
OPTIONAL_DEPENDENCY: SIM
```

### `leads → artists`

```text
DEPENDENCY_TYPE: EVENT
DEPENDENCY_REASON: a conversão de um lead produz um artista — confirmado pelo próprio efeito do evento realtime de conversão, que invalida dados de AMBOS os domínios
DEPENDENCY_EVIDENCE: useWsEvent('crm.lead.converted', () => inv(QUERY_KEYS.LEADS, QUERY_KEYS.ARTISTAS, QUERY_KEYS.METRICS)) — shared/hooks/useRealtimeSync.ts:36 (doc33)
REQUIRED_DEPENDENCY: SIM
OPTIONAL_DEPENDENCY: NÃO
```

---

## Parte 3 — Dependências estruturais não enumeráveis com evidência atual

### `reports → (entidades reportáveis não identificadas individualmente)`

```text
DEPENDENCY_TYPE: OTHER
DEPENDENCY_REASON: reports opera genericamente sobre "entidades" via parâmetro dinâmico ${entity} (GET/POST .../reports/entities/${entity}/...) — estruturalmente, o domínio não tem dado próprio e não pode funcionar sem que outros domínios de negócio existam, mas QUAIS domínios estão no catálogo real de "entidades reportáveis" nunca foi extraído em nenhum doc anterior (GET /reports/entities e GET /reports/definitions não tiveram o corpo da resposta detalhado nos docs 09/11)
DEPENDENCY_EVIDENCE: GET /reports/entities, GET /reports/definitions (doc05/37) — presença confirmada, conteúdo da lista não confirmado
REQUIRED_DEPENDENCY: SIM (estruturalmente, para o domínio ter qualquer função)
OPTIONAL_DEPENDENCY: NÃO

STATUS: UNRESOLVED — contado em UNRESOLVED_DEPENDENCIES, não atribuído a domínios específicos por falta de evidência do payload
```

### `dashboard → (múltiplos domínios agregados, não identificados individualmente)`

```text
DEPENDENCY_TYPE: OTHER
DEPENDENCY_REASON: GET /analytics/dashboard é, pela própria natureza e nome do domínio (doc38: "agregador cross-domain", RELATED_ENTITIES: N/A), necessariamente dependente de dado de outros domínios para ter conteúdo — mas o shape exato da resposta (quais domínios exatamente compõem o payload de /analytics/dashboard) nunca foi extraído com evidência de campo em nenhum doc anterior (a única pista disponível, a função morta computeFromMockStorage() em useOperationalDashboard.ts, doc32, referenciava artistas/contratos/leads/tickets/campanhas/transacoes/notas_fiscais/eventos — mas é código nunca executado, não prova o contrato real do endpoint)
DEPENDENCY_EVIDENCE: GET /analytics/dashboard (doc05/37); doc32 (função morta, não usada como prova, apenas citada por transparência)
REQUIRED_DEPENDENCY: SIM (estruturalmente)
OPTIONAL_DEPENDENCY: NÃO

STATUS: UNRESOLVED — contado em UNRESOLVED_DEPENDENCIES, não atribuído a domínios específicos por falta de evidência de payload real
```

---

## Parte 4 — Domínios sem nenhuma dependência

```text
DOMAIN: auth
DEPENDS_ON: NENHUM
DEPENDENCY_REASON: é a própria raiz do sistema de sessão/tenant/permissões — todos os demais domínios dependem dele, ele não depende de nenhum outro
EVIDENCE: doc38 (nenhum consumidor de auth referencia outro domínio de negócio)

DOMAIN: external-lookups
DEPENDS_ON: NENHUM
DEPENDENCY_REASON: consultas a serviços de terceiros (ViaCEP/IBGE/Nominatim) e URLs já resolvidas (attachment.url) — não usam autenticação nem tenant do MUSIC OS 360, não fazem parte do backend do sistema
EVIDENCE: doc38 (AUTH_REQUIRED: NÃO, TENANT_SCOPED: NÃO)
```

---

## Ciclos identificados

```text
CYCLIC_DEPENDENCY: NÃO

Nenhum ciclo encontrado. Cada par de domínios com dependência de negócio distinta (Parte 2) foi verificado nas duas direções — em nenhum caso a direção inversa teve evidência (users↔rbac, clients↔contracts, marketing↔artists, admin-billing↔billing, oauth-bridge↔integrations, marketing↔ai, contracts↔ai, leads↔artists) — todas são unidirecionais.
```

---

## Resumo

```text
TOTAL_DOMAINS_ANALYZED:
35

DOMAINS_WITH_DEPENDENCIES:
33

DOMAINS_WITHOUT_DEPENDENCIES:
2

TOTAL_REQUIRED_DEPENDENCIES:
81

TOTAL_OPTIONAL_DEPENDENCIES:
3

AUTH_DEPENDENCIES:
33

TENANT_DEPENDENCIES:
32

PERMISSION_DEPENDENCIES:
8

BUSINESS_DOMAIN_DEPENDENCIES:
5

INTEGRATION_DEPENDENCIES:
3

EVENT_DEPENDENCIES:
1

CYCLIC_DEPENDENCIES:
0

UNRESOLVED_DEPENDENCIES:
2
```

`BUSINESS_DOMAIN_DEPENDENCIES` (5): users→rbac, clients→contracts, marketing→artists, admin-billing→billing, marketing→audit. `INTEGRATION_DEPENDENCIES` (3): oauth-bridge→integrations, marketing→ai, contracts→ai. `EVENT_DEPENDENCIES` (1): leads→artists. `UNRESOLVED_DEPENDENCIES` (2): reports e dashboard — dependência estrutural certa, alvo específico não comprovável sem reabrir/expandir docs anteriores (proibido nesta etapa). Soma de conferência: 33+32+8+5+3+1+2 = 84 dependências totais registradas = 81 obrigatórias + 3 opcionais.

## Cobertura

35/35 domínios do doc38 analisados. Toda dependência registrada tem evidência concreta citada — nenhuma foi criada por semelhança superficial. As 2 dependências estruturalmente certas mas sem alvo específico comprovável (reports, dashboard) foram registradas como `UNRESOLVED`, não inventadas. Nenhum ciclo foi encontrado. Nenhuma ordem de implementação, arquitetura, tabela ou migration foi definida. `apps/web` e `apps/api` não foram alterados. Nenhum doc anterior foi modificado.
