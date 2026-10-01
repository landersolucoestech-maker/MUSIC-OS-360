> Historical record. Kept as recorded; not the current contract.

# 59 — Decisão Final: Versão do NestJS para a `apps/api-v2`

Definição read-only da versão exata de NestJS/adapter HTTP da futura `apps/api-v2`, reavaliando genuinamente entre manter NestJS 10 (versão do legacy, doc57) ou adotar a versão estável atual, conforme exigido pelo prompt. Framework/adapter em si (NestJS + platform-express) já aprovado nos docs 43/44, não reaberto — apenas a VERSÃO exata é decidida aqui. Nenhum código foi escrito, nenhuma dependência foi instalada/atualizada. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), banco e deployment não foram alterados.

## Estado atual (contexto, não reaberto)

```text
Node.js 20
Backend legacy: NestJS 10.4.22 + @nestjs/platform-express 10.4.22 + Express 5.2.1
API v2 já decidiu: NestJS + platform-express (docs 43/44, não reaberto)
Decisão pendente: MANTER NESTJS 10 ou ADOTAR NESTJS 11+
```

## Verificação externa (fontes primárias — npm registry oficial, consultado nesta etapa)

```text
@nestjs/core            → latest: 11.1.28 | engines: Node.js >= 20 | peer: rxjs ^7.1.0
@nestjs/platform-express → latest: 11.1.28 | dependency direta: express 5.2.1 (fixo) | peer:
                          @nestjs/core ^11.0.0, @nestjs/common ^11.0.0
@nestjs/config           → latest: 4.0.4 | peer: @nestjs/common ^10.0.0 || ^11.0.0 (compatível com
                          ambas as majors)
@nestjs/swagger            → latest: 11.4.6 | peer: @nestjs/core ^11.0.1, @nestjs/common ^11.0.1,
                          class-validator "*" (opcional), class-transformer "*" (opcional),
                          reflect-metadata ^0.1.12 || ^0.2.0
@nestjs/throttler            → latest: 6.5.0 | peer: @nestjs/core/common ^7.0.0 até ^11.0.0 (faixa
                          ampla, compatível com 11.x)
@nestjs/testing                → latest: 11.1.28 | peer: @nestjs/core ^11.0.0, @nestjs/common ^11.0.0

NestJS 12: mencionado publicamente como alvo de lançamento para o início do Q3 2026 (modernização em
  torno de ESM) — NÃO é a versão "latest" publicada no registry no momento desta consulta (a tag
  "latest" de @nestjs/core aponta para 11.1.28) — portanto fora das 2 opções desta etapa
  (NESTJS_10 | NESTJS_CURRENT_STABLE), tratado como pré-lançamento/futuro, não avaliado como opção
  madura hoje.
```

Fontes: registry.npmjs.org (dados de `package.json` publicado, primários) para as versões/peer
dependencies exatas; busca por documentação/changelog oficial NestJS (Trilon Consulting, cobertura
técnica direta do lançamento do NestJS 11, usada só para contexto de breaking changes, não para
números de versão) — nenhuma fonte de terceiros foi usada para determinar um número de versão, apenas
o registry oficial.

---

## Comparação

```text
1. Node.js 20 compatibility
Opção A (10.4.22): compatível (NestJS 10 nunca exigiu Node 20 como piso, funciona em faixa mais ampla).
Opção B (11.1.28): compatível E ALINHADA — o próprio @nestjs/core 11.1.28 já declara "engines": Node.js
  >= 20 como REQUISITO MÍNIMO, exatamente igual ao piso já fixado neste projeto (doc42/57) — não é
  apenas compatibilidade, é a mesma versão mínima, sem folga a menos nem a mais.
DIFERENCIADOR: NENHUM prático — ambas compatíveis; B tem alinhamento mais direto (o piso da
  ferramenta é exatamente o piso do projeto), sem ser decisivo por si só.

2. Express 5 compatibility
Opção A: @nestjs/platform-express 10.4.22 já usa express@5.2.1 hoje no legacy (doc55/57) — Express 5 NÃO
  é exclusividade da v11, já está em uso.
Opção B: @nestjs/platform-express 11.1.28 fixa a MESMA versão exata — express@5.2.1 — confirmado via
  registry nesta etapa.
DIFERENCIADOR: NENHUM — é literalmente a mesma versão do Express nas duas opções. Migrar de A para B
  não introduz NENHUMA mudança de versão do Express neste projeto especificamente (diferente do caso
  genérico "NestJS 10→11 traz Express 5", que aqui já não se aplica porque o projeto já está em
  Express 5 desde o legacy).

3. Security/support status
Opção A: major 10 já superada por uma major estável há mais de um ano (11 é a "latest" hoje) — uma API
  nova começando em 10 em 2026 nasceria numa linha de suporte mais próxima do fim de vida útil do que
  do início.
Opção B: major estável atual, com releases recentes ("último publicado há 1 mês" no momento da consulta)
  — janela de suporte ativo mais longa pela frente, relevante para uma aplicação que deve viver anos.
DIFERENCIADOR: Opção B.

4. Breaking changes
Opção A: nenhuma (permanece na versão já usada pelo legacy — mas o legacy NÃO é requisito de
  compatibilidade desta v2, regra explícita do prompt).
Opção B: mudanças reais existem entre 10 e 11 (matching de rota com wildcard nomeado, ordem de execução
  de OnModuleDestroy/OnApplicationShutdown invertida, CacheModule migrado para cache-manager v6,
  prioridade de ConfigService#get alterada, módulos dinâmicos idênticos importados múltiplas vezes
  deixam de ser mesclados) — MAS, por ser uma aplicação NOVA sem código a migrar, essas mudanças são
  apenas "convenções a seguir desde o primeiro dia", não uma migração real a executar.
DIFERENCIADOR: Opção B tem risco de breaking change estruturalmente NULO para este caso específico
  (app nova), porque não existe código legacy sendo portado — o "breaking change" só existiria se
  estivéssemos migrando o `apps/api` existente, o que esta etapa explicitamente não é.

5. Nest ecosystem compatibility
Opção A: ecossistema completo (config/swagger/throttler/testing) tem releases compatíveis com 10.x —
  mas @nestjs/config 4.0.4 e @nestjs/swagger 11.4.6 (as versões MAIS RECENTES desses pacotes) já
  exigem/preferem a linha 11.x (swagger 11.4.6 tem peer ^11.0.1, não aceita mais 10.x) — ou seja,
  ficar em NestJS 10 significaria não poder usar as versões mais recentes de @nestjs/swagger, tendo
  que fixar uma versão mais antiga desse pacote especificamente.
Opção B: todo o ecossistema relevante (config 4.0.4, swagger 11.4.6, throttler 6.5.0, testing 11.1.28)
  tem release estável e coerente na linha 11.x, sem nenhuma versão "presa" numa linha anterior.
DIFERENCIADOR: Opção B — coerência de ecossistema sem exceção.

6. class-validator/class-transformer compatibility
Ambas as opções: SEM IMPACTO — @nestjs/swagger declara class-validator/class-transformer como peer "*"
  (qualquer versão), essas bibliotecas não são versionadas em função da major do NestJS.
DIFERENCIADOR: NENHUM.

7. Drizzle integration
Ambas as opções: SEM IMPACTO — a integração Drizzle↔NestJS (doc58) é um provider customizado via DI
  padrão do Nest, sem nenhuma dependência de recurso específico de uma major do framework.
DIFERENCIADOR: NENHUM.

8. Testing compatibility
Opção A: @nestjs/testing compatível com 10.x (versões antigas do pacote).
Opção B: @nestjs/testing 11.1.28 (latest) exige @nestjs/core/common ^11.0.0 — coerente com o resto do
  ecossistema já decidido em B.
DIFERENCIADOR: NENHUM decisivo — ambas plenamente testáveis, apenas a versão do pacote de teste precisa
  acompanhar a major escolhida (o que já está implícito na decisão, não é custo adicional).

9. Deployment em Docker
Ambas: SEM IMPACTO — nenhuma mudança de base image, nenhuma dependência de major do NestJS no Dockerfile
  em si (doc42/57 — base node:20-alpine, inalterada por esta decisão).
DIFERENCIADOR: NENHUM.

10. Deployment em Vercel
Ambas: SEM IMPACTO — o padrão de handler serverless (Express sobre função, doc42/43) não depende da
  major do NestJS, só do adapter platform-express, que existe igualmente em ambas as opções.
DIFERENCIADOR: NENHUM.

11. Custo de adoção
Opção A: custo zero de adoção (é a versão já usada no monorepo, ainda que pelo legacy).
Opção B: custo de aprendizado pontual das poucas mudanças de convenção citadas no critério 4 — baixo,
  documentado publicamente, sem migração de código real a fazer.
DIFERENCIADOR: leve vantagem de A neste critério isolado — mas o próprio prompt já desqualifica "já
  existe"/"custo zero de introdução" como critério decisório isolado (mesma regra já aplicada no doc58).

12. Benefício real para uma API nova
Opção A: nenhum benefício específico além de "é o que já se conhece" — que o próprio prompt já
  descarta como requisito ("compatibilidade com código NestJS legacy NÃO é requisito").
Opção B: piso de Node.js da ferramenta já alinhado ao piso do projeto (critério 1), ecossistema mais
  recente sem exceções presas a versões antigas (critério 5), janela de suporte mais longa pela frente
  (critério 3), zero mudança de versão de Express neste projeto especificamente (critério 2) — 4
  benefícios concretos e verificáveis, não apenas "é mais nova".
DIFERENCIADOR: Opção B.
```

---

## Decisão

```text
SELECTED:
NESTJS_CURRENT_STABLE

SELECTED_NESTJS_VERSION:
11.1.28 (@nestjs/core, @nestjs/common, @nestjs/platform-express, @nestjs/testing — mesma linha 11.1.28
  para os 4 pacotes centrais, confirmados via registry nesta etapa)

SELECTED_PLATFORM_EXPRESS_VERSION:
@nestjs/platform-express 11.1.28

SELECTED_EXPRESS_VERSION:
5.2.1 (dependência fixa de @nestjs/platform-express 11.1.28, confirmada via registry — idêntica à
  versão já resolvida no monorepo atual, doc55/56/57; NÃO é uma mudança de versão de Express, é a
  mesma já em uso)

HTTP_ADAPTER:
platform-express (não reaberto — doc43/44)

EXPRESS_MAJOR_COMPATIBLE:
SIM
```

Justificativa: a reavaliação não encontrou nenhum critério, entre os 12 pedidos, onde manter NestJS 10
seja tecnicamente superior para uma aplicação nova — os únicos pontos a favor de A (custo zero de
adoção) já são explicitamente desqualificados pela própria regra do prompt como critério decisório
isolado. Em contrapartida, B tem 4 vantagens concretas e verificáveis (piso de Node.js da ferramenta
já alinhado ao piso do projeto, ecossistema mais recente sem pacotes presos a versões antigas, janela
de suporte mais longa, e — o achado mais específico deste projeto — ZERO mudança de versão de Express,
já que o legacy já está em Express 5.2.1 e a v11 fixa exatamente essa mesma versão). O risco de
breaking change, que normalmente seria o principal argumento contra adotar uma major nova, é
estruturalmente nulo aqui porque não existe código legacy sendo migrado — as mudanças de convenção
entre 10 e 11 (critério 4) são apenas regras a seguir desde a primeira linha de código escrita, não uma
migração real.

---

## Ecossistema Nest — versões coerentes (linha 11.x, para os pacotes já relevantes à stack decidida)

```text
@nestjs/core: 11.1.28
@nestjs/common: 11.1.28
@nestjs/platform-express: 11.1.28
@nestjs/config: 4.0.4 (peer compatível com ^11.0.0)
@nestjs/testing: 11.1.28
@nestjs/swagger: 11.4.6 (peer exige ^11.0.1 — só compatível com a linha 11, reforça a decisão)
@nestjs/throttler: 6.5.0 (peer aceita de ^7.0.0 a ^11.0.0 — mencionado aqui apenas por já constar da
  lista pedida pelo prompt; NÃO é uma decisão de adotar rate limiting via este pacote — doc53 já
  registrou rate limiting como estratégia própria no legacy, sem decisão equivalente ainda tomada para
  a v2, fora do escopo desta etapa)

Nenhuma mistura de major é necessária ou permitida — todos os pacotes @nestjs/* centrais na mesma linha
11.x, sem exceção presa a 10.x.
```

---

## Resumo

```text
UNRESOLVED_NESTJS_STACK_DECISIONS:
0
```

## Cobertura

12 critérios pedidos comparados entre NestJS 10.4.22 (atual) e a versão estável atual (11.1.28,
confirmada via npm registry oficial nesta etapa, não por fonte secundária). Ecossistema Nest verificado
para coerência de major (config/swagger/testing/throttler, todos com release estável compatível com
11.x). Express definido explicitamente (platform-express 11.1.28, fixando express 5.2.1 — idêntica à
versão já em uso no projeto, sem mudança real). Fastify não foi reavaliado (fora de escopo, já decidido
nos docs 43/44). Nenhuma implementação foi feita. Nenhuma dependência foi instalada/atualizada. `apps/api-v2`
não foi criado. `apps/web`, `apps/api` (legacy), banco e deployment não foram alterados. Nenhum outro
aspecto da stack foi reavaliado. Nenhum documento anterior foi modificado.
