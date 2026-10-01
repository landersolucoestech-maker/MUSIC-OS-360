> Historical record. Kept as recorded; not the current contract.

# 63 — Decisão Final: Versão e Política TypeScript da `apps/api-v2`

Definição read-only da versão exata de TypeScript e da política de compilação/strictness da futura `apps/api-v2`, com verificação em fontes oficiais/primárias atuais. Stack já fechada (Node 24, NestJS 11.1.28, Drizzle, PostgreSQL 17, container long-running — docs 58/59/60/61) não reaberta. Nenhum `tsconfig`/`package.json`/`pnpm-lock.yaml` foi alterado, nenhuma dependência foi instalada. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e shared packages não foram alterados.

## Stack já fechada (contexto, não reaberta)

```text
Node.js 24 | NestJS 11.1.28 | @nestjs/platform-express 11.1.28 | Express 5.2.1 | Drizzle ORM |
PostgreSQL 17/Supabase | Long-running container
Também obrigatórios: frontend preservado, contratos HTTP preservados, comportamento cross-domain
preservado, tenant isolation, financial traceability (doc62)
```

---

## 1 — TypeScript atual

```text
CURRENT_TYPESCRIPT_DECLARED:
^5.8.3 (raiz/web) | ^5.3.3 (apps/api) — 2 ranges declarados, doc42/54

CURRENT_TYPESCRIPT_RESOLVED:
5.9.3 — versão única resolvida no pnpm-lock.yaml para os 2 ranges (doc55/56/57, já confirmado
  anteriormente, não reinvestigado aqui além de citar o já apurado)
```

---

## 2 — Verificação externa (fontes oficiais consultadas nesta etapa)

```text
registry.npmjs.org/typescript — dist-tag "latest": 7.0.2 (publicado em 5 de agosto de 2026, DIAS antes
  desta etapa) — TypeScript 7.0 é um marco arquitetural: primeira versão estável a rodar sobre um
  compilador nativo reescrito em Go ("tsgo", porte do TypeScript-em-TypeScript), com ganhos de
  velocidade de build de 8x-12x — mas REMOVE a API clássica de compilador em JavaScript sobre a qual
  ferramentas como ts-jest, NestJS CLI (nest build), ts-loader e regras type-aware do ESLint são
  construídas.

github.com/microsoft/typescript/releases — última versão da linha 6.x confirmada: 6.0.3 (release
  estável anterior ao salto para 7.0, entre 5.9.3 e 7.0.2 na linha do tempo de releases).

Achado decisivo (múltiplas fontes concordantes sobre o estado real do ecossistema ao redor do TS 7.0
  no momento desta consulta):
  - ts-jest (última versão publicada) declara peer dependency "typescript >=4.3 <7" — NÃO aceita
    TypeScript 7 em nenhuma versão publicada até o momento desta consulta.
  - "nest build" e os plugins CLI de Swagger/GraphQL, ts-loader e regras type-aware do ESLint NÃO
    funcionam sob TypeScript 7 no momento desta consulta.
  - NestJS não publicou posição oficial nem cronograma de suporte ao compilador nativo (tsgo);
    não existe ainda um builder "-b tsgo" para o Nest CLI.
  - A orientação encontrada é usar um setup "lado a lado" (TS 7 só para checagem de tipo, TS 6.x para
    build real) como contorno temporário, com recomendação explícita de aguardar a API programática
    estabilizada prevista para TypeScript 7.1 antes de abandonar esse contorno.
  - TypeScript 6.0 especificamente NÃO tem esse problema — mantém a API clássica de compilador
    (só removida em 7.0) e, quanto a decorators, adiciona suporte à proposta Stage 3 do ECMAScript
    SEM remover os decorators legacy — a orientação confirmada é manter
    "experimentalDecorators: true" e "emitDecoratorMetadata: true" (exatamente os flags que a
    apps/api-v2 já precisa para o NestJS, seção 5 abaixo) para preservar DI/parameter binding
    intactos sob TS 6.0.
```

---

## 3 — Decisão de versão

```text
Comparação:
A. Manter TypeScript atual (5.9.3): tecnicamente funcional, mas não é mais a versão estável mais
   recente sem os problemas do salto direto — ficaria uma linha atrás sem motivo técnico que a
   justifique como "adequada" (só inércia).
B. Atualizar para a stable atual COMPATÍVEL — não 7.0.2 (a "latest" nominal, mas confirmadamente
   quebrada para nest build/ts-jest/ESLint type-aware neste momento, evidência acima) — e sim 6.0.3
   (a stable real e madura mais recente que preserva compatibilidade total com toda a toolchain já
   decidida: NestJS 11.1.28, ts-jest, class-validator/decorators).

SELECTED_TYPESCRIPT_VERSION:
6.0.3

CHANGE_FROM_CURRENT_STACK_REQUIRED:
SIM — 5.9.3 (atual) → 6.0.3 (v2). Não é "manter porque já existe" (5.9.3 não é a versão exata
  escolhida) nem "atualizar só porque é mais nova" (7.0.2, a versão mais nova de todas, foi
  explicitamente rejeitada com evidência concreta de quebra de ferramental) — é a versão estável mais
  recente tecnicamente adequada e suportada pela stack já fechada, conforme a própria regra desta
  etapa exige.
```

---

## 4 — Strictness

```text
SETTING: strict
VALUE: true
RATIONALE: flag guarda-chuva (ativa noImplicitAny/strictNullChecks/strictFunctionTypes/
  strictBindCallApply/strictPropertyInitialization/noImplicitThis/alwaysStrict) — base de segurança de
  tipos para um código totalmente novo, sem débito técnico legado a acomodar; suporta diretamente o
  princípio de "Domain sem dependência do ORM" e tipos inferidos do Drizzle sem reflection (doc58/61)
  só rendem seu benefício completo sob strict mode.

SETTING: noImplicitAny
VALUE: true (herdado de strict, listado explicitamente por clareza)
RATIONALE: nenhum valor pode ser implicitamente `any` — reforça diretamente a regra NO_ANY_AS_ESCAPE_HATCH
  (seção 8).

SETTING: strictNullChecks
VALUE: true (herdado de strict)
RATIONALE: crítico para um sistema financeiro/multi-tenant (doc62 — rastreabilidade financeira,
  doc49 — campos de identidade) onde tratamento incorreto de null/undefined poderia gerar estado
  silenciosamente errado, exatamente o tipo de falha que o doc62 proíbe.

SETTING: noImplicitReturns
VALUE: true
RATIONALE: todo caminho de código de uma função precisa retornar explicitamente — evita um Use Case
  esquecer um `return` num branch específico, produzindo `undefined` silencioso onde um valor de
  negócio era esperado (relevante à regra de consistência do doc62).

SETTING: noFallthroughCasesInSwitch
VALUE: true
RATIONALE: previne fallthrough acidental em switch — relevante a máquinas de estado de domínio (ex.:
  status de Contrato/Lançamento, doc62/flows.ts) onde um `break` ausente poderia propagar
  silenciosamente um caso para o próximo.

SETTING: noUncheckedIndexedAccess
VALUE: true
RATIONALE: acesso por índice (array/objeto) passa a retornar `T | undefined` em vez de `T` — reduz uma
  classe real de bug em torno de lookups dinâmicos (mapas de permissão RBAC, registries por chave,
  resultados de query Drizzle) onde uma chave/índice assumido presente pode estar ausente — exatamente
  o tipo de falha silenciosa que o doc62 proíbe.

SETTING: exactOptionalPropertyTypes
VALUE: false
RATIONALE: diferente das demais, esta é a única flag desta lista NÃO habilitada — motivo concreto,
  não omissão: é a flag de strictness com o histórico mais documentado de fricção com definições de
  tipo de bibliotecas de terceiros não escritas especificamente para suportá-la (distinção entre
  propriedade ausente vs. propriedade presente com valor `undefined` explícito), e não há verificação
  disponível nesta etapa de que os typings atuais do NestJS 11.1.28/Drizzle já são
  exactOptionalPropertyTypes-compatíveis. Regra explícita do prompt ("não habilite opção incompatível
  sem avaliar impacto") aplicada aqui de forma conservadora — candidata a reavaliação futura específica,
  não descartada permanentemente.

SETTING: useUnknownInCatchVariables
VALUE: true
RATIONALE: variáveis de `catch` tipadas como `unknown` em vez de `any` por padrão — reforça
  diretamente a preferência unknown-sobre-any desta mesma etapa (seção 8), relevante ao tratamento de
  erro de infraestrutura/integração antes da tradução para o modelo de erro já aprovado (doc50/51).

SETTING: noImplicitOverride
VALUE: true
RATIONALE: exige a palavra-chave `override` explícita ao sobrescrever método de classe base — prática
  segura e de baixo atrito, sem incompatibilidade conhecida com NestJS/Drizzle, útil nos padrões
  baseados em classe do NestJS (Guards/Interceptors/Filters implementando interfaces/estendendo
  classes base).

SETTING: forceConsistentCasingInFileNames
VALUE: true
RATIONALE: já usada no tsconfig raiz do monorepo atual (doc42) — segurança de cross-plataforma
  relevante especificamente neste ambiente de desenvolvimento (Windows, case-insensitive por padrão)
  vs. o alvo de deployment real (Docker/Linux, case-sensitive, doc61) — evita que uma diferença de
  capitalização de import passe despercebida localmente e quebre só em CI/produção.
```

---

## 5 — Decorators / metadata

```text
experimentalDecorators: true
emitDecoratorMetadata: true

Ambos OBRIGATÓRIOS e mantidos exatamente como estão hoje — confirmado pela verificação externa
(seção 2): TypeScript 6.0 preserva totalmente os decorators legacy sob esses 2 flags, e é assim que o
NestJS resolve DI (Dependency Injection) e parameter binding em Guards/Controllers/Providers. Nenhuma
migração para decorators Stage 3 (opcionalmente disponíveis desde o TS 6.0) é feita nesta etapa — o
NestJS ainda depende do modelo legacy, migrar exigiria suporte oficial do próprio framework, que a
verificação externa confirmou não existir ainda.
```

---

## 6 — Module / Resolution / Target

```text
MODULE_SYSTEM:
CommonJS — o ecossistema NestJS 11.x (CLI, plugin de Swagger, emissão confiável de metadata de
  decorator) permanece mais maduro e testado em CommonJS; ESM nativo é citado publicamente como um
  objetivo de modernização do NestJS 12 (doc59, achado já registrado), não do 11.x atual — adotar ESM
  agora empilharia um segundo risco experimental sobre a já cuidadosa escolha de versão desta etapa
  (TS 6.0.3, não 7.0.2), sem nenhum requisito desta stack que exija ESM especificamente.

MODULE_RESOLUTION:
"node10" (resolução clássica, nomenclatura atual do que antes era "node") — par coerente com
  module=CommonJS; a apps/api-v2 não é um pacote híbrido ESM/CJS que precisaria de "node16"/"nodenext",
  então a resolução clássica é a combinação de menor risco.

TARGET:
ES2023 — Node.js 24 (doc60) suporta nativamente sintaxe/recursos até essa linha sem necessidade de
  downleveling; evita tanto um alvo antigo desnecessário (o legacy usa ES2021, justificado por um
  Node mais antigo, doc42 — não é mais o piso real da v2) quanto "ESNext" (alvo móvel entre versões do
  próprio compilador TypeScript, menos previsível para builds reprodutíveis).

Nenhuma alteração foi feita no monorepo atual (proibido pelo prompt) — esta seção define apenas a
configuração CONCEITUAL pretendida para quando a apps/api-v2 for de fato criada.
```

---

## 7 — Path aliases

```text
PATH_ALIASES_ALLOWED:
SIM

Aliases internos são permitidos (ex.: "@shared/*" apontando para src/shared/, conforme a estrutura de
diretórios já aprovada no doc48) — mas SEMPRE respeitando as boundaries já fixadas no doc47: um alias
nunca pode resolver para dentro de domain/application/infrastructure de OUTRO domínio que não o próprio
módulo consumidor — apenas para o Public Application Service (<domain>.service.ts) desse outro domínio,
ou para src/shared/ (tipos/primitivos técnicos, doc47/48).

CROSS_DOMAIN_BYPASS_ALLOWED:
NÃO

Nenhum alias de path é configurado especificamente para facilitar (ou sequer permitir estruturalmente)
um import que fure a regra de cross-domain já aprovada — os aliases seguem a mesma fronteira, não a
contornam.
```

---

## 8 — Domain safety

```text
DOMAIN_TYPES_MUST_NOT_DEPEND_ON_HTTP_DTOS:
SIM

Reafirma, no nível de tipos TypeScript, a regra já fixada no doc47 (Domain nunca depende de DTOs HTTP)
e no doc48 (DTO HTTP vive em presentation/dto/, Domain object vive em domain/entities|value-objects/,
tipos sempre distintos mesmo quando os campos coincidem) — não reaberta, apenas confirmada como
exigência também de compilação/tipagem, não só de organização de pastas.

NO_ANY_AS_ESCAPE_HATCH:
SIM

`any` não é um mecanismo rotineiro para contornar um contrato de tipo — quando a origem de um dado é
genuinamente desconhecida no momento da compilação (corpo de resposta de integração externa antes de
validação, resultado de JSON.parse, valor capturado num catch — este último já coberto por
useUnknownInCatchVariables, seção 4), o tipo correto é `unknown`, mantido até uma validação/narrowing
explícita (ex.: o mecanismo Zod já definido como escape hatch de validação no doc44, ou um type guard
próprio) — nunca promovido a `any` "para o TypeScript parar de reclamar".
```

---

## 9 — Build

```text
TYPECHECK_SEPARATE_FROM_BUILD:
SIM

NO_EMIT_TYPECHECK:
SIM

Mesmo padrão já usado pela apps/api legacy (doc42/54, não copiado por inércia — reavaliado e confirmado
adequado): um script de "typecheck" dedicado, rodando `tsc --noEmit` (sem gerar artefato, só validar
tipos) como gate explícito de CI, separado do script de "build" real (que efetivamente compila para
JS a ser empacotado no container long-running, doc61). Essa separação permite rodar o gate de tipos de
forma rápida e cacheável, falhando o CI antes ou em paralelo ao build/test completo, sem exigir que
toda validação de tipo espere pela emissão de artefato.
```

---

## 10 — Decisão final

```text
SELECTED_TYPESCRIPT_VERSION:
6.0.3

CHANGE_FROM_CURRENT_STACK_REQUIRED:
SIM

STRICT_MODE:
SIM
```

---

## Resumo

```text
UNRESOLVED_TYPESCRIPT_DECISIONS:
0
```

## Cobertura

Versão atual determinada (5.9.3, declarada em 2 ranges), versão estável atual verificada em fontes
primárias (registry.npmjs.org, GitHub Releases oficial do TypeScript) com achado decisivo: a versão
"latest" nominal (7.0.2, lançada dias antes desta etapa) está confirmadamente incompatível com nest
build/ts-jest/ESLint type-aware no momento desta consulta — rejeitada com evidência concreta, não por
precaução genérica; TypeScript 6.0.3 selecionado como a stable real mais recente sem essa quebra. 10
flags de strictness definidas individualmente com rationale técnico, incluindo 1 exceção justificada
(exactOptionalPropertyTypes: false, por ausência de verificação de compatibilidade, não por preguiça).
Decorators/metadata confirmados obrigatórios e preservados. Module/Resolution/Target definidos
conceitualmente para Node 24 + NestJS 11 + container long-running, sem alterar o monorepo atual. Path
aliases permitidos com boundary de cross-domain explicitamente preservada (não contornável). Domain
safety (tipos de Domain independentes de DTO HTTP, `any` proibido como escape hatch rotineiro,
`unknown` preferido) definida. Build com typecheck separado e gate de CI explícito definido. Nenhum
`tsconfig`/`package.json`/`pnpm-lock.yaml` foi alterado, nenhuma dependência foi instalada. `apps/api-v2`
não foi criado. `apps/web`, `apps/api` (legacy) e shared packages não foram alterados. Node.js, NestJS
e Drizzle não foram reavaliados. Nenhum documento anterior foi modificado.
