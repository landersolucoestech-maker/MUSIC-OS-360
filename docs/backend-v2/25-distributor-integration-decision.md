> Historical record. Kept as recorded; not the current contract.

# 25 — Decisão Funcional Aprovada: Integração com Distribuidoras (D1)

Registro da decisão humana para `D1` (doc24 — [`24-required-functional-decisions.md`](./24-required-functional-decisions.md)). Nenhuma implementação foi feita nesta etapa. `D2` (MusicChat) não foi tratado — permanece `REQUIRES_DECISION`, sem alteração. Nenhum doc anterior foi modificado. Nenhum arquivo de `apps/web` ou `apps/api` foi alterado.

D1 muda de status:

```text
REQUIRES_DECISION → APPROVED
```

---

## Princípio funcional aprovado

```text
As integrações com distribuidoras devem utilizar a API oficial de cada distribuidora quando essa API existir e estiver oficialmente disponível para integração.

O sistema é multi-tenant e será utilizado por diferentes empresas/clientes.

Cada tenant deve conectar e autenticar exclusivamente a sua própria conta na distribuidora.

As credenciais, tokens, sessões, autorizações e dados de integração de uma empresa nunca podem ser compartilhados com outro tenant.

O mecanismo de autenticação deve seguir obrigatoriamente o método oficial suportado pela API da respectiva distribuidora.

Quando a distribuidora oferecer OAuth ou mecanismo equivalente de autorização delegada, utilizar esse mecanismo.

Quando a API oficial utilizar outro modelo de autenticação, a implementação deverá seguir exclusivamente esse modelo documentado oficialmente.

Não presumir que todas as distribuidoras possuem API pública ou OAuth.

Distribuidoras sem API oficial disponível não devem receber integração simulada, scraping, automação de login ou API inventada.
```

Esta decisão resolve o D1 do doc24 escolhendo, em essência, uma variante condicionada da Opção B (OAuth/autenticação oficial) sobre a Opção A (conexão manual sem verificação) e a Opção C (abandonar o conceito) — mas com uma ressalva explícita que nenhuma das três opções originais continha isoladamente: a exigência não é "sempre OAuth" nem "sempre manual", é "seguir o que a API oficial de cada distribuidora exigir, e não fingir integração onde não houver API oficial". Nenhuma pesquisa sobre quais das 6 distribuidoras efetivamente têm API oficial foi feita nesta etapa — isso é explicitamente adiado.

## Distribuidoras identificadas (integrações potenciais)

```text
ONErpm
DistroKid
Symphonic
SoundOn
MusicPro
SomVibe
```

A presença nesta lista **não** significa que uma API oficial já foi confirmada para nenhuma delas. Nenhuma pesquisa de API foi realizada nesta etapa (explicitamente proibida pelo escopo deste prompt). Esta é a mesma lista de 6 distribuidoras já catalogada em `apps/web/src/modules/releases/services/distribution-platforms.ts` (`DISTRIBUTION_PLATFORMS`, doc19/21/24) e em `apps/web/src/modules/settings/pages/Configuracoes.tsx` (`DISTRIBUTORS`, doc21).

## Regra multi-tenant (obrigatória)

```text
Cada conexão pertence a exatamente um tenant.

tenant A → conta da distribuidora do tenant A

tenant B → conta da distribuidora do tenant B
```

É proibido:

```text
tenant A → credenciais/token do tenant B
```

## Credenciais — requisito arquitetural futuro (não implementado nesta etapa)

```text
Nunca armazenar senha de distribuidora em texto puro.

Preferir tokens/autorização delegada quando a API oficial permitir.

Secrets e tokens deverão possuir armazenamento seguro e isolamento por tenant.
```

Nenhum mecanismo de armazenamento, endpoint, tabela, migration ou DTO foi criado ou definido nesta etapa — este bloco registra apenas o requisito para etapas futuras.

## Relação com o achado do doc23 (não reaberta)

O gap de escrita documentado no doc23 (Caso 4 — nenhum código atual em `apps/web` grava a chave `musicos360_distributor_connections`; `Configuracoes.tsx` hoje só oferece links estáticos para o portal de cada distribuidora) permanece como estava — esta decisão define o PRINCÍPIO que orientará a futura implementação, não a implementação em si. O achado de que a Opção B "pura" (OAuth uniforme) tinha o risco de nenhuma das 6 distribuidoras ter API documentada (doc24, D1, riscos da Opção B) é exatamente o que esta decisão endereça ao condicionar o método de autenticação à existência real de API oficial por distribuidora, em vez de presumir um único mecanismo para todas.

---

## Resumo

```text
DECISION: D1
DECISION_STATUS: APPROVED
INTEGRATION_MODEL: OFFICIAL_API_WHEN_AVAILABLE
AUTH_MODEL: PER_TENANT_OFFICIAL_PROVIDER_AUTH
TENANT_ISOLATION_REQUIRED: SIM
SHARED_PROVIDER_CREDENTIALS_ALLOWED: NÃO
DISTRIBUTORS_WITHOUT_OFFICIAL_API: NO_FAKE_INTEGRATION
D2_STATUS: REQUIRES_DECISION (inalterado — não tratado nesta etapa)
```

## Cobertura

Somente D1 (doc24) foi tratado. D2 (MusicChat) não foi tocado. Nenhuma pesquisa de API de distribuidora foi feita. Nenhum OAuth, login, endpoint, tabela, migration ou DTO foi criado. `apps/web` e `apps/api` não foram alterados. Nenhum doc anterior foi modificado.
