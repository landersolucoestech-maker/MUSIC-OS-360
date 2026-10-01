> Historical record. Kept as recorded; not the current contract.

# 43 — Decisão do Framework HTTP da `apps/api-v2`

Decisão read-only baseada exclusivamente nas restrições reais registradas em [`42-api-v2-technical-constraints.md`](./42-api-v2-technical-constraints.md), no contrato canônico final ([`37-canonical-frontend-contract-final.md`](./37-canonical-frontend-contract-final.md) — 250 endpoints/22 eventos realtime/9 exceções funcionais) e na ordem de domínios ([`41-domain-implementation-order.md`](./41-domain-implementation-order.md) — 35 domínios, dependências AUTH/TENANT/PERMISSION universais). Nenhum código foi escrito. `apps/api-v2` não foi criado. Nenhuma dependência foi instalada. Nenhum `package.json` foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados.

## Restrições de entrada (não reinterpretadas, apenas citadas)

```text
RUNTIME: Node 20 (fixado em Docker + CI, doc42)
TYPESCRIPT: ^5.8.3 (raiz/web) — nenhuma versão fixa herdada obrigatoriamente pela api-v2
MONOREPO: pnpm workspaces + Turborepo (doc42)
DEPLOYMENT_TARGET: DUPLO E COMPROVADO — (1) Docker/distroless long-running (Railway/Render/Fly.io) e (2) Vercel serverless function via handler (req,res) com Nest app cacheado entre invocações warm, nunca app.listen(), nunca BullMQ/Socket.IO em modo serverless (doc42)
SUPABASE_AUTH: preservado no frontend (Exceção Funcional, doc37 seção C) — a api-v2 precisa apenas validar o JWT emitido pelo Supabase Auth, não reimplementar auth
ENDPOINTS: 250 (doc37), 0 incompletos/conflitantes
DOMÍNIOS: 35 (doc41), com dependências universais AUTH+TENANT em 33/35 e PERMISSION em 8/35
TESTES: Jest usado pela api legacy, Vitest pelo web — nenhum runner imposto à api-v2 por este prompt
VALIDAÇÃO EXISTENTE NO REPO: Zod já é o padrão real de validação cross-stack — packages/schemas ("Zod schemas compartilhados — validação frontend + backend") e o próprio env.schema.ts da api legacy usam Zod, não class-validator
```

---

## Opções avaliadas

```text
OPTION:
NestJS (platform-express)

COMPATIBLE_WITH_CURRENT_REPO:
SIM — TypeScript com decorators é suportado nativamente por tsconfig próprio da api-v2 (não depende do tsconfig da api legacy); pnpm workspace/Turborepo já orquestram um app Nest hoje (apps/api), então o padrão de build/lint/test por --filter já é validado neste monorepo.

COMPATIBLE_WITH_DEPLOYMENT_TARGET:
SIM — o próprio repositório já prova, em produção, o padrão exato necessário: apps/api/api/index.ts cria a app Nest sobre um handler Express, nunca chama listen(), e cacheia a promise de inicialização entre invocações warm; o mesmo app, com main.ts chamando listen(), roda como servidor long-running no Docker/distroless. Isto NÃO é "escolher porque já existe" — é a evidência concreta de que o adapter Express do Nest funciona nos dois alvos de deployment reais deste repositório, o que é exatamente o critério pedido.

MODULAR_DOMAIN_SUPPORT:
Mapeamento 1:1 natural entre o sistema de Modules do Nest e os 35 domínios do doc41: cada domínio vira um NestModule com seus próprios controllers/providers, e os `imports` de cada Module espelham diretamente as dependências REQUIRED já registradas no doc39/41 (ex.: o Module de "users" importaria o Module de "rbac"). DI hierárquico evita acoplamento direto entre domínios não-dependentes.

VALIDATION_SUPPORT:
Nativa via ValidationPipe + class-validator, MAS o padrão real deste repo é Zod (packages/schemas, env.schema.ts) — Nest não vem com Zod de fábrica; exigiria um pipe customizado (nestjs-zod ou pipe próprio) para alinhar com a convenção já estabelecida. Suportado, porém não é o caminho de menor atrito do framework.

AUTH_GUARD_SUPPORT:
Forte — CanActivate (Guards) é o mecanismo dedicado do framework para exatamente este caso (verificação de JWT Supabase + tenant scope + permission gate), aplicável de forma declarativa e composável por controller/rota, com global guard como rede de segurança para as 33/35 dependências AUTH+TENANT universais do doc41.

ERROR_HANDLING_SUPPORT:
Forte — Exception Filters centralizados (@Catch) permitem um único ponto de mapeamento de erro→HTTP status para as 250 rotas, evitando tratamento de erro duplicado/inconsistente por domínio.

TESTABILITY:
Forte — @nestjs/testing (TestingModule) permite isolar guards/services/controllers por domínio; já usado e comprovado na api legacy com Jest neste mesmo monorepo (apps/api/jest.config.ts).

OBSERVABILITY_SUPPORT:
Neutra/Forte — Interceptors dão um ponto único de instrumentação (logging/tracing/metrics) por request; compatível com bibliotecas genéricas Node já usadas na api legacy (@sentry/node, prom-client) sem exigir nada framework-specific.

SERVERLESS_COMPATIBILITY:
Comprovada neste repo especificamente (não apenas "em tese") — ver COMPATIBLE_WITH_DEPLOYMENT_TARGET. Risco residual: overhead de boot (reflect-metadata + construção do grafo de DI) é maior que frameworks mais finos, mitigado mas não eliminado pelo cache de app entre invocações warm.

NEW_DEPENDENCIES_REQUIRED:
- @nestjs/core, @nestjs/common, @nestjs/platform-express (fundamentais do framework)
- class-validator + class-transformer (padrão nativo do Nest) OU um pipe/adapter Zod customizado para alinhar com o padrão real de validação do repo (packages/schemas) — decisão de validação não tomada aqui, fora de escopo deste prompt

RISKS:
- Maior peso de boot/cold-start em ambiente serverless comparado a frameworks mais finos (Fastify/Express puro/Hono) — parcialmente mitigado pelo padrão de cache já comprovado no repo, não eliminado.
- Tendência natural do ecossistema Nest a puxar para class-validator/DTOs, gerando fricção com o padrão Zod já estabelecido no monorepo (packages/schemas) se não for explicitamente alinhado.
```

```text
OPTION:
Fastify (standalone, sem Nest)

COMPATIBLE_WITH_CURRENT_REPO:
SIM — Node 20 + TypeScript puro, sem exigência de decorators; integra-se ao workspace pnpm/Turborepo do mesmo modo que qualquer outro app.

COMPATIBLE_WITH_DEPLOYMENT_TARGET:
PARCIAL — long-running/Docker: SIM, sem ressalvas (fastify.listen() é o caso de uso principal do framework). Serverless/Vercel: tecnicamente viável (fastify.ready() seguido de fastify.server como handler, ou adapters como @fastify/aws-lambda adaptado), mas NÃO há nenhuma prova no repo atual de que este padrão específico funciona nesta configuração de Vercel — diferente do Nest+Express, que já está comprovado em produção neste mesmo projeto.

MODULAR_DOMAIN_SUPPORT:
Média — o sistema de plugins/encapsulamento do Fastify (fastify-plugin, register()) permite isolar cada um dos 35 domínios, mas não há um conceito nativo de "dependência declarada entre módulos" equivalente aos `imports` do Nest; o mapeamento para o grafo de dependências do doc41 precisaria ser imposto por convenção do time, não pelo framework.

VALIDATION_SUPPORT:
Forte e alinhado ao padrão do repo — Fastify usa JSON Schema nativamente, e há suporte de primeira classe a Zod via @fastify/type-provider-zod, o que casaria diretamente com o padrão Zod já usado em packages/schemas e env.schema.ts.

AUTH_GUARD_SUPPORT:
Média — hooks (onRequest/preHandler) cobrem o caso de uso, mas são funções registradas por rota/plugin, não um mecanismo declarativo unificado como Guards; garantir que as 33/35 dependências AUTH+TENANT do doc41 sejam aplicadas de forma consistente nas 250 rotas depende inteiramente de disciplina do time (ex.: um hook global ajuda, mas overrides por rota são menos padronizados que decorators).

ERROR_HANDLING_SUPPORT:
Forte — setErrorHandler() centralizado cobre o mesmo caso de uso dos Exception Filters do Nest.

TESTABILITY:
Forte — fastify.inject() permite testar rotas sem subir um listener real; compatível com Jest ou Vitest.

OBSERVABILITY_SUPPORT:
Forte — hooks de ciclo de vida (onRequest/onResponse) dão pontos de instrumentação equivalentes aos Interceptors do Nest; ecossistema de plugins de observabilidade maduro.

SERVERLESS_COMPATIBILITY:
Viável em tese, NÃO comprovada neste repositório — maior leveza de boot que o Nest (vantagem real para cold start), mas sem precedente local no padrão exato de handler serverless já usado (api/index.ts), exigindo validação própria antes de confiar na combinação.

NEW_DEPENDENCIES_REQUIRED:
- fastify
- @fastify/type-provider-zod (para alinhar validação ao padrão Zod já usado no repo)

RISKS:
- Ausência de um mecanismo de dependência entre módulos equivalente ao Nest exige convenção própria do time para não violar a ordem de implementação do doc41 silenciosamente.
- Padrão de guard/tenant-check dependeria inteiramente de hooks aplicados manualmente/por convenção em 250 rotas — maior risco de uma rota esquecer o enforcement de tenant scope do que num framework com Guards declarativos.
- Combinação com o handler serverless da Vercel não tem precedente comprovado neste projeto (ao contrário do Nest+Express).
```

```text
OPTION:
Express puro (sem framework de aplicação por cima)

COMPATIBLE_WITH_CURRENT_REPO:
SIM — já é uma dependency direta da api legacy (apps/api/package.json) e é literalmente o servidor HTTP por trás do handler serverless atual (apps/api/api/index.ts usa express() diretamente).

COMPATIBLE_WITH_DEPLOYMENT_TARGET:
SIM — é a peça comprovada exatamente no padrão serverless já em produção neste repositório (o próprio handler de api/index.ts é um `express()`), e trivialmente compatível com o modo long-running/Docker via app.listen().

MODULAR_DOMAIN_SUPPORT:
Fraca por si só — Express não tem nenhum conceito nativo de módulo/domínio; Router isolado por domínio é possível, mas toda a estrutura de dependência entre domínios, DI de services e enforcement cross-cutting (auth/tenant/permission) precisaria ser inteiramente desenhada e mantida pelo time, sem nenhuma garantia estrutural do framework.

VALIDATION_SUPPORT:
Nenhuma nativa — qualquer validação (inclusive Zod, que é o padrão real do repo) precisaria ser aplicada manualmente como middleware em cada uma das 250 rotas, sem nenhum mecanismo do framework para garantir cobertura uniforme.

AUTH_GUARD_SUPPORT:
Fraca — apenas middleware de rota/router; sem nenhuma primitiva declarativa, o risco de uma das 250 rotas esquecer o middleware de tenant/permission é o mais alto entre todas as opções avaliadas.

ERROR_HANDLING_SUPPORT:
Média — Express 5 (já usado na api legacy) tem error-handling middleware nativo (inclusive para erros assíncronos, corrigido a partir da v5), suficiente mas exigindo disciplina manual para centralizar em 250 rotas.

TESTABILITY:
Forte — supertest é maduro e já usado na api legacy (apps/api/package.json devDependencies); compatível com Jest ou Vitest.

OBSERVABILITY_SUPPORT:
Média — sem pontos de instrumentação estruturados nativos (equivalentes a Interceptors/hooks); instrumentação via middleware manual, funcional mas sem padronização imposta pelo framework.

SERVERLESS_COMPATIBILITY:
Comprovada neste repo — é literalmente o mecanismo já usado no handler de api/index.ts hoje.

NEW_DEPENDENCIES_REQUIRED:
- express (já presente como padrão no monorepo, mas ainda assim uma dependency nova e própria da api-v2)
- middleware de validação Zod (ex.: um wrapper próprio, sem biblioteca "oficial" equivalente a um type-provider)

RISKS:
- Nenhuma estrutura imposta para 35 domínios/250 rotas — todo o isolamento, DI e enforcement de tenant/permission precisaria ser construído do zero e mantido por convenção, o maior risco de inconsistência entre as 4 opções avaliadas dado o volume de rotas.
- Ausência de mecanismo declarativo de guard aumenta a chance de uma rota individual ficar sem tenant/permission check, um erro de isolamento multi-tenant caro de detectar tardiamente.
```

```text
OPTION:
Hono

COMPATIBLE_WITH_CURRENT_REPO:
SIM — TypeScript-first, roda em Node 20 via @hono/node-server, integra-se a um workspace pnpm/Turborepo sem exigências especiais.

COMPATIBLE_WITH_DEPLOYMENT_TARGET:
PARCIAL — Hono foi desenhado primariamente para runtimes edge (Cloudflare Workers, Vercel Edge Functions), que NÃO é o alvo real deste repositório (a function Vercel atual roda em runtime Node.js via handler Express, não em Edge Runtime, doc42). Hono também roda em Node.js long-running via @hono/node-server, e tem um adapter para Vercel Node functions — mas nenhum desses caminhos tem qualquer precedente comprovado neste projeto.

MODULAR_DOMAIN_SUPPORT:
Média — app.route() permite compor sub-apps por domínio, suficiente para os 35 domínios, mas sem nenhum mecanismo nativo de declaração de dependência entre módulos (mesma limitação do Fastify/Express nesse quesito).

VALIDATION_SUPPORT:
Forte e alinhado ao padrão do repo — @hono/zod-validator é first-class e usa Zod diretamente, o mesmo padrão já estabelecido em packages/schemas.

AUTH_GUARD_SUPPORT:
Média — middleware é o único mecanismo (equivalente aos hooks do Fastify); sem primitiva declarativa própria para guard, mesma limitação estrutural do Express/Fastify frente ao Nest.

ERROR_HANDLING_SUPPORT:
Média/Forte — app.onError() centraliza tratamento de erro de forma simples.

TESTABILITY:
Forte — app.request() permite testes sem subir servidor real, similar ao fastify.inject().

OBSERVABILITY_SUPPORT:
Fraca/Média — ecossistema de plugins de observabilidade é o menos maduro entre as 4 opções, por ser o framework mais novo e mais focado em edge.

SERVERLESS_COMPATIBILITY:
Não comprovada neste repositório em nenhum dos dois alvos de deployment reais (nem Docker long-running, nem o padrão Vercel Node function já em uso) — é a opção com menos evidência local entre as 4.

NEW_DEPENDENCIES_REQUIRED:
- hono
- @hono/node-server (para rodar fora de runtime edge)
- @hono/zod-validator

RISKS:
- Nenhum precedente no repositório em nenhum dos dois deployment targets reais — maior risco de descoberta tardia de incompatibilidade específica com a configuração Vercel já usada (crons, rewrites, maxDuration definidos em apps/api/vercel.json).
- Ecossistema mais novo e menos maduro para observabilidade/RBAC em escala enterprise (250 rotas, 35 domínios) comparado a Nest/Fastify/Express.
- Framework historicamente mais associado a edge runtimes; usá-lo apenas em modo Node.js abre mão da sua principal vantagem competitiva sem eliminar o risco de ecossistema mais novo.
```

**Opção descartada antes da avaliação completa (não conta em `OPTIONS_EVALUATED`):** tRPC — desconsiderado porque o contrato canônico já aprovado (doc37) é fundamentalmente REST-shaped (250 endpoints com paths/métodos HTTP fixos, consumidos por um frontend congelado via `api-client.ts`); adotar tRPC exigiria uma camada de compatibilidade REST sobre um paradigma RPC-por-procedimento, o que é uma mudança de arquitetura de contrato, não apenas de framework HTTP — fora do escopo desta decisão pontual.

---

## Decisão

```text
SELECTED_FRAMEWORK:
NestJS (platform-express)

RATIONALE:
Entre as 4 opções tecnicamente viáveis, o NestJS é a única cuja combinação framework+adapter+deployment-target já está comprovada em produção NESTE repositório especificamente (apps/api/api/index.ts + apps/api/Dockerfile) — não como argumento de familiaridade, mas como evidência concreta de que o padrão "app Nest sobre handler Express, cacheado entre invocações warm, sem listen() em serverless" resolve exatamente a restrição de deployment duplo (Docker long-running + Vercel serverless) documentada no doc42. As outras 3 opções (Fastify, Express puro, Hono) são todas tecnicamente capazes de rodar nos dois alvos, mas nenhuma tem esse padrão específico comprovado localmente — adotá-las exigiria validar do zero uma combinação sem precedente.

Além do deployment, dois critérios do próprio prompt pesaram diretamente a favor do Nest: (1) MODULAR_DOMAIN_SUPPORT — o sistema de Modules com `imports` declarados mapeia 1:1 para os 35 domínios e o grafo de dependências REQUIRED do doc39/41, tornando a ordem de implementação já aprovada diretamente representável na estrutura do código, o que nenhuma das outras opções oferece nativamente; (2) AUTH_GUARD_SUPPORT — o mecanismo de Guards é a única primitiva, entre as 4 opções, desenhada especificamente para enforcement declarativo e consistente de autenticação/tenant/permissão por rota, o que reduz o maior risco identificado nas outras 3 opções (uma das 250 rotas esquecer o check de tenant scope, já que 33/35 domínios dependem disso de forma obrigatória segundo o doc41).

A única fricção real identificada é que o padrão de validação idiomático do Nest (class-validator) diverge do padrão Zod já estabelecido no restante do monorepo (packages/schemas, env.schema.ts) — registrado como risco, não como impeditivo, e não resolvido aqui por estar fora do escopo deste prompt (nenhuma escolha de biblioteca de validação foi feita).
```

---

## Resumo

```text
OPTIONS_EVALUATED:
4

SELECTED_FRAMEWORK:
NestJS (platform-express)

NEW_DEPENDENCIES_REQUIRED:
2 (categorias: núcleo do framework — @nestjs/core+@nestjs/common+@nestjs/platform-express; camada de validação — class-validator+class-transformer OU adapter Zod customizado, decisão não tomada)

UNRESOLVED_FRAMEWORK_DECISIONS:
1 (alinhamento entre o padrão de validação idiomático do Nest e o padrão Zod já estabelecido no monorepo — registrado como risco, não bloqueia a escolha do framework HTTP em si, mas fica pendente para uma decisão futura e específica sobre validação)
```

## Cobertura

4 opções tecnicamente viáveis avaliadas com os 9 critérios pedidos cada; 1 opção (tRPC) descartada antes da avaliação completa com justificativa registrada, não contada no total. Nenhuma arquitetura de diretórios, ORM, migration tool, repository/service/controller ou schema de banco foi definida. `apps/api-v2` não foi criado, nenhuma dependência foi instalada, nenhum `package.json` foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.
