> Historical record. Kept as recorded; not the current contract.

# 56 — Resolução das 7 Versões Ainda Não Identificadas

Continuação read-only de [`55-exact-current-stack-inventory.md`](./55-exact-current-stack-inventory.md) (`PACKAGES_WITH_UNRESOLVED_VERSION: 7`). Nenhuma stack foi reanalisada além destes 7 itens. Nenhuma recomendação foi feita. Nenhum pacote foi instalado/atualizado/removido, `package.json`/`pnpm-lock.yaml` não foram alterados, Supabase/banco/frontend/backend não foram alterados. `apps/api-v2` não foi criado. Nenhum documento anterior foi modificado.

Todos os 7 casos foram resolvidos no nível 1 do método pedido (`pnpm-lock.yaml`) — nenhum precisou escalar para `pnpm list`/`pnpm why`/inspeção de `node_modules/.pnpm`.

---

## 1

```text
COMPONENT:
@hookform/resolvers (integração react-hook-form ↔ Zod, apps/web)

PACKAGE:
@hookform/resolvers

WORKSPACE:
apps/web

DECLARED_VERSION:
^3.10.0

RESOLVED_VERSION:
3.10.0

SOURCE:
pnpm-lock.yaml — entrada "'@hookform/resolvers@3.10.0':" (linha 1262) e snapshot
"'@hookform/resolvers@3.10.0(react-hook-form@7.76.0(react@18.3.1))':" (linha 7757)

RUNTIME_USAGE:
ACTIVE
```

---

## 2

```text
COMPONENT:
Radix UI (component library, apps/web) — 19 subpacotes declarados diretamente em
apps/web/package.json

PACKAGE:
@radix-ui/react-* (19 entradas)

WORKSPACE:
apps/web

SOURCE:
pnpm-lock.yaml — entradas "'@radix-ui/react-*@<versão>':" individuais

RUNTIME_USAGE:
ACTIVE (todas)
```

```text
DECLARED_VERSION → RESOLVED_VERSION (por subpacote):
@radix-ui/react-alert-dialog     ^1.1.14 → 1.1.15
@radix-ui/react-avatar           ^1.1.10 → 1.1.11
@radix-ui/react-checkbox         ^1.3.2  → 1.3.3
@radix-ui/react-collapsible      ^1.1.11 → 1.1.12
@radix-ui/react-dialog           ^1.1.14 → 1.1.15
@radix-ui/react-dropdown-menu    ^2.1.16 → 2.1.16
@radix-ui/react-label            ^2.1.7  → 2.1.8
@radix-ui/react-popover          ^1.1.14 → 1.1.15
@radix-ui/react-progress         ^1.1.7  → 1.1.8
@radix-ui/react-radio-group      ^1.3.7  → 1.3.8
@radix-ui/react-scroll-area      ^1.2.9  → 1.2.10
@radix-ui/react-select           ^2.2.5  → 2.2.6
@radix-ui/react-separator        ^1.1.7  → 1.1.8
@radix-ui/react-slot             ^1.2.3  → 1.2.3
@radix-ui/react-switch           ^1.2.5  → 1.2.6
@radix-ui/react-tabs             ^1.1.12 → 1.1.13
@radix-ui/react-toggle           ^1.1.9  → 1.1.10
@radix-ui/react-tooltip          ^1.2.7  → 1.2.8
@radix-ui/react-visually-hidden  ^1.2.4  → 1.2.4
```

Nota: o lockfile também resolve `@radix-ui/react-slot@1.2.4` e `@radix-ui/react-visually-hidden@1.2.3`
como entradas ADICIONAIS (linhas 2500 e 2642) — são versões distintas puxadas transitivamente por
outros subpacotes Radix que dependem internamente de um `react-slot`/`react-visually-hidden` mais
novo/antigo do que o declarado diretamente em `apps/web/package.json`; a versão RESOLVED_VERSION
registrada acima para cada linha é a que corresponde ao range declarado diretamente pelo app
(`^1.2.3` → 1.2.3; `^1.2.4` → 1.2.4), não a entrada transitiva adicional.

---

## 3

```text
COMPONENT:
@testing-library/jest-dom (matchers de DOM para testes, apps/web)

PACKAGE:
@testing-library/jest-dom

WORKSPACE:
apps/web

DECLARED_VERSION:
^6.9.1

RESOLVED_VERSION:
6.9.1

SOURCE:
pnpm-lock.yaml — entrada "'@testing-library/jest-dom@6.9.1':" (linha 3090) e snapshot idêntico
(linha 9572)

RUNTIME_USAGE:
TEST_ONLY
```

---

## 4

```text
COMPONENT:
@nestjs/typeorm (integração NestJS ↔ TypeORM, apps/api)

PACKAGE:
@nestjs/typeorm

WORKSPACE:
apps/api

DECLARED_VERSION:
^10.0.2

RESOLVED_VERSION:
10.0.2

SOURCE:
pnpm-lock.yaml — entrada "'@nestjs/typeorm@10.0.2':" (linha 1614) e snapshot
"'@nestjs/typeorm@10.0.2(@nestjs/common@...)(@nestjs/core@...)(reflect-metadata@...)(typeorm@0.3.31...)':"
(linha 8176)

RUNTIME_USAGE:
ACTIVE
```

---

## 5

```text
COMPONENT:
@bull-board/* (dashboard de monitoramento de filas BullMQ, apps/api) — 3 subpacotes

PACKAGE:
@bull-board/api, @bull-board/express, @bull-board/nestjs

WORKSPACE:
apps/api

DECLARED_VERSION:
^7.0.0 (as 3)

RESOLVED_VERSION:
@bull-board/api: 7.1.5
@bull-board/express: 7.1.5
@bull-board/nestjs: 7.1.5

SOURCE:
pnpm-lock.yaml — entradas "'@bull-board/api@7.1.5':" (linha 812), "'@bull-board/express@7.1.5':"
(linha 817), "'@bull-board/nestjs@7.1.5':" (linha 820), e snapshots correspondentes (linhas
7433/7438/7447)

RUNTIME_USAGE:
PARTIAL (mesmo status já registrado no doc54/55 para o módulo de filas como um todo — ausente em modo
serverless Vercel, ativo só em modo Docker/long-running)
```

---

## 6

```text
COMPONENT:
@nestjs/testing (TestingModule/DI isolada para testes, apps/api)

PACKAGE:
@nestjs/testing

WORKSPACE:
apps/api

DECLARED_VERSION:
^10.4.22

RESOLVED_VERSION:
10.4.22

SOURCE:
pnpm-lock.yaml — entrada "'@nestjs/testing@10.4.22':" (linha 1601) e snapshot
"'@nestjs/testing@10.4.22(@nestjs/common@...)(@nestjs/core@...)(@nestjs/platform-express@...)':"
(linha 8168)

RUNTIME_USAGE:
TEST_ONLY
```

---

## 7

```text
COMPONENT:
@aws-sdk/s3-request-presigner (geração de URL pré-assinada para upload R2, apps/api)

PACKAGE:
@aws-sdk/s3-request-presigner

WORKSPACE:
apps/api

DECLARED_VERSION:
^3.1045.0

RESOLVED_VERSION:
3.1048.0 — mesma versão resolvida já confirmada para @aws-sdk/client-s3 no doc55 (ambos os pacotes AWS
SDK resolvem para a mesma versão de linha 3.1048.0 dentro do mesmo release train do SDK v3)

SOURCE:
pnpm-lock.yaml — entrada "'@aws-sdk/s3-request-presigner@3.1048.0':" (linha 603) e snapshot idêntico
(linha 7187)

RUNTIME_USAGE:
ACTIVE
```

---

## Resumo

```text
UNRESOLVED_VERSIONS_INITIAL:
7

UNRESOLVED_VERSIONS_REMAINING:
0
```

## Cobertura

Os 7 componentes registrados como `UNRESOLVED` no doc55 foram resolvidos integralmente a partir do
`pnpm-lock.yaml` (nível 1 do método pedido), sem necessidade de `pnpm list`/`pnpm why`/inspeção de
`node_modules/.pnpm`. Nenhuma stack foi reanalisada além destes 7 itens. Nenhuma recomendação de
mudança foi feita. Nenhum pacote foi instalado, atualizado ou removido. `package.json`/`pnpm-lock.yaml`
não foram alterados. `apps/web`, `apps/api` (legacy), banco e Supabase não foram alterados. `apps/api-v2`
não foi criado. Nenhum documento anterior foi modificado.
