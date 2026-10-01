> Historical record. Kept as recorded; not the current contract.

# 44 — Resolução Final da Pendência do Framework HTTP

Continuação read-only de [`43-api-v2-http-framework-decision.md`](./43-api-v2-http-framework-decision.md) (`UNRESOLVED_FRAMEWORK_DECISIONS: 1`). `SELECTED_FRAMEWORK: NestJS (platform-express)` não foi reavaliado nem alterado. Nenhum código foi escrito, `apps/api-v2` não foi criado, nenhuma dependência foi instalada, nenhum `package.json` foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados.

---

## Pendência identificada

```text
PENDING_DECISION:
Alinhamento entre o padrão de validação idiomático do NestJS (class-validator/class-transformer, via ValidationPipe) e o padrão Zod já estabelecido em outras partes do monorepo (packages/schemas — "Zod schemas compartilhados — validação frontend + backend"; apps/api/src/core/config/env.schema.ts) — ou seja, qual biblioteca de validação de request (DTO/body/query) a apps/api-v2 deve adotar como padrão.

WHY_UNRESOLVED:
O doc43 avaliou explicitamente apenas o framework HTTP (roteamento/DI/guards/deployment), não a biblioteca de validação — a tensão Zod-vs-class-validator foi identificada como risco durante a avaliação do NestJS (campo VALIDATION_SUPPORT), mas resolvê-la estava fora do escopo daquele prompt ("nenhuma escolha de biblioteca de validação foi feita").

IMPACT_IF_NOT_RESOLVED:
Sem um padrão de validação definido, cada um dos 35 domínios da apps/api-v2 poderia adotar uma abordagem diferente (class-validator num módulo, Zod noutro) de forma não coordenada, gerando: (1) inconsistência de formato de erro de validação entre domínios (a ValidationPipe nativa do Nest e a ZodValidationPipe customizada já produzem shapes de erro HTTP diferentes, evidenciado abaixo); (2) duplicação de schema entre camadas (packages/schemas em Zod vs DTOs em class-validator descrevendo os mesmos 250 contratos); (3) fricção de revisão de código sem uma convenção clara para decidir qual usar em cada novo endpoint.
```

---

## Investigação

Evidência coletada exclusivamente do código de configuração/validação já existente na `apps/api` (legacy), por ser o único precedente real de NestJS neste monorepo:

```text
apps/api/src/create-app.ts:185-186
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, ... }))
  → ValidationPipe (class-validator) está registrada GLOBALMENTE, aplicada por padrão a toda rota da aplicação.

apps/api/src/modules/**/dto/*.dto.ts
  → 78 arquivos de DTO usando decorators de class-validator (@IsString, @IsEmail, etc.), cobrindo virtualmente todos os 35 domínios do doc41 (financial-categories, invoices, licensing, users, billing, artists, works, contracts, shares, events, hr, marketing, campaigns, registry, uploads, notifications, transactions, e outros).

apps/api/src/modules/*/**.spec.ts (≥10 arquivos, ex.: works-field-contract.spec.ts, contracts.controller.spec.ts, phonograms.controller.spec.ts, shares.dto.spec.ts, projects.dto.spec.ts, artists/create-artist.dto.spec.ts)
  → todos replicam explicitamente as MESMAS opções do ValidationPipe global ("whitelist: true, forbidNonWhitelisted: true, transform: true") em seus próprios testes, com comentários citando-a como "ValidationPipe global (main.ts)" — confirma que é tratada como o padrão oficial e testado da aplicação, não um detalhe incidental.

apps/api/src/core/pipes/zod-validation.pipe.ts
  → uma ZodValidationPipe customizada existe, mas é um Pipe local (PipeTransform), não registrada globalmente — precisa ser instanciada explicitamente por parâmetro (@Body(new ZodValidationPipe(schema))).

apps/api/src/modules/transactions/transactions.controller.ts:14,59,73,87
  → ÚNICO consumidor real da ZodValidationPipe em toda a apps/api — aplicada em 3 rotas do domínio "transactions" (create/update de transações financeiras), usando schemas definidos em apps/api/src/modules/transactions/validators/transacao.validator.ts.

apps/api/src/modules/transactions/validators/transacao.validator.ts
  → o schema Zod ali implementa validação condicional cruzada entre campos (ex.: categoria/subcategoria exigindo artista+projeto apenas para certas combinações, via Sets de subcategorias) — um caso de validação mais naturalmente expresso em Zod (parsing programático) do que em decorators declarativos de class-validator.

apps/api/src/core/config/env.schema.ts
  → segundo (e único outro) uso de Zod encontrado — mas é validação de variáveis de ambiente no boot da aplicação, não validação de request HTTP; categoria diferente de problema.

apps/api/package.json (dependencies)
  → "class-validator": "^0.14.1", "class-transformer": "^0.5.1" E "zod": "^3.22.4" já coexistem como dependencies simultâneas da mesma aplicação NestJS, sem nenhum conflito técnico registrado — prova de que a combinação já roda em produção.

docs/backend-v2/42-api-v2-technical-constraints.md (seção Shared Packages, já registrado, não reaberto)
  → packages/schemas ("Zod schemas compartilhados — validação frontend + backend") tem USED_BY_WEB: NÃO e USED_BY_LEGACY_API: NÃO — ou seja, apesar do nome sugerir um padrão Zod cross-stack já em uso, esse pacote específico não tem NENHUM consumidor real comprovado em nenhum dos dois apps hoje. A "convenção Zod do monorepo" citada como risco no doc43 é, na prática, um pacote órfão — não uma camada de validação ativa que a apps/api-v2 precisaria respeitar ou substituir.
```

---

## Resolução

```text
FINAL_DECISION:
apps/api-v2 adota class-validator + class-transformer (via ValidationPipe global do NestJS, com whitelist/forbidNonWhitelisted/transform habilitados) como padrão DEFAULT de validação de request para os 250 endpoints/35 domínios — mesma configuração já comprovada na apps/api legacy. Zod permanece disponível como escape hatch explícito e local (Pipe por parâmetro, não global) para os casos pontuais de validação condicional/cruzada entre campos que sejam genuinamente mais difíceis de expressar com decorators — mesmo padrão já usado uma vez, deliberadamente, no domínio "transactions" da apps/api legacy.

EVIDENCE:
- apps/api/src/create-app.ts:185-186 (ValidationPipe global — whitelist/forbidNonWhitelisted/transform)
- apps/api/src/modules/**/dto/*.dto.ts (78 arquivos, class-validator, cobrindo quase todos os 35 domínios)
- ≥10 arquivos *.spec.ts replicando e nomeando explicitamente as mesmas opções como "ValidationPipe global"
- apps/api/src/core/pipes/zod-validation.pipe.ts + apps/api/src/modules/transactions/transactions.controller.ts:14,59,73,87 (único uso real de Zod para validação de request HTTP, escopado a 3 rotas de 1 domínio)
- apps/api/package.json (class-validator, class-transformer e zod coexistindo sem conflito, comprovando compatibilidade técnica)
- docs/backend-v2/42-api-v2-technical-constraints.md (packages/schemas: USED_BY_WEB: NÃO, USED_BY_LEGACY_API: NÃO — a "convenção Zod cross-stack" citada no doc43 não tem consumidor real hoje)

RATIONALE:
A tensão registrada no doc43 partiu da premissa de que Zod já é "o padrão real de validação cross-stack" do monorepo — mas a evidência de código mostra o oposto na camada HTTP: class-validator é o padrão sistemático e comprovado (78 DTOs, 1 ValidationPipe global, testado explicitamente em ≥10 specs como comportamento oficial), enquanto Zod aparece exatamente 1 vez para validação de request, deliberadamente escolhido para um caso de validação condicional que os decorators não expressam bem — e o pacote packages/schemas, que seria a evidência de uma convenção Zod mais ampla, está órfão (0 consumidores reais em ambos os apps, doc42). Adotar class-validator como padrão da apps/api-v2 não contraria uma convenção estabelecida — segue a única que está de fato provada em escala (35 domínios) neste framework, neste monorepo. Preservar Zod como escape hatch pontual mantém a flexibilidade que o próprio legacy já demonstrou ser necessária, sem introduzir uma segunda camada de validação concorrente como padrão global.

STATUS:
RESOLVED
```

---

## Resumo

```text
FRAMEWORK:
NestJS (platform-express)

UNRESOLVED_FRAMEWORK_DECISIONS_INITIAL:
1

FRAMEWORK_DECISIONS_RESOLVED:
1

FRAMEWORK_DECISIONS_REQUIRING_HUMAN_DECISION:
0

UNRESOLVED_FRAMEWORK_DECISIONS_REMAINING:
0
```

## Cobertura

A única pendência do doc43 foi resolvida com evidência concreta e direta do código já existente na apps/api legacy (único precedente NestJS real deste monorepo). `SELECTED_FRAMEWORK: NestJS (platform-express)` não foi alterado nem reavaliado. Nenhum ORM, banco, migration tool, estrutura de diretórios, controller, service ou repository foi definido. `apps/api-v2` não foi criado, nenhuma dependência foi instalada, nenhum `package.json` foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.
