> Historical record. Kept as recorded; not the current contract.

# 64 — Decisão Final: Stack de Validação da `apps/api-v2`

Reavaliação genuína da decisão de validação/DTOs registrada no doc44 (class-validator+class-transformer como padrão, Zod como escape hatch), agora com NestJS 11.1.28 e TypeScript 6.0.3 já fechados (docs 59/63) — informação que não estava disponível quando o doc44 foi escrito. Framework (NestJS/platform-express), arquitetura em camadas (doc47) e modelo de erro (doc50) não reabertos. Nenhum código/DTO/ValidationPipe foi criado, nenhuma dependência foi instalada. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e modelo de erro não foram alterados.

## Stack já fechada (contexto, não reaberta)

```text
Node.js 24 | TypeScript 6.0.3 (strict, noImplicitAny, strictNullChecks, noUncheckedIndexedAccess,
exactOptionalPropertyTypes: false) | NestJS 11.1.28 | Express 5.2.1 | Drizzle ORM | PostgreSQL 17 |
Supabase Auth | Long-running container
```

---

## Verificação externa (fontes oficiais consultadas nesta etapa)

```text
registry.npmjs.org/class-validator — latest: 0.15.1, sem peer dependency de TypeScript declarada
  explicitamente (tipagem própria incluída, sem piso mínimo imposto).
registry.npmjs.org/class-transformer — latest: 0.5.1 (mesma já usada no legacy, doc55/56).
registry.npmjs.org/zod — latest: 4.4.3 — CONFIRMA o achado já registrado no doc55 (zod@4.4.3 presente
  no lockfile atual como versão adicional, consumidor não identificado naquela etapa): é de fato o
  major mais recente e estável do pacote, não um resíduo transitório. Testado oficialmente contra
  TypeScript 5.5+ (piso bem abaixo do TS 6.0.3 já selecionado, doc63 — sem incompatibilidade).
registry.npmjs.org/nestjs-zod — latest: 5.5.0, ativamente mantido (build recente com Node 24.18.0,
  NestJS 11.1.5, TypeScript 5.9.3 nas próprias dependências de desenvolvimento do pacote) — peer
  dependencies: zod "^3.25.0 || ^4.0.0" e @nestjs/common "^10.0.0 || ^11.0.0" (compatibilidade EXATA
  com a versão de NestJS já fechada nesta stack, doc59) + @nestjs/swagger "^7.4.2 || ^8.0.0 || ^11.0.0"
  (cobre o @nestjs/swagger 11.4.6 já mapeado no doc59) — integração Zod↔NestJS 11 madura e não-artesanal,
  diferente do pipe manual construído à mão no legacy (zod-validation.pipe.ts, doc44).
Busca sobre Zod v4: reescrita interna com ganhos de performance (parsing de string ~14x mais rápido,
  bundle ~57% menor no core) e API de customização de erro unificada — adoção do ecossistema já madura
  (tRPC, Prisma, resolvers de react-hook-form, geradores OpenAPI já compatíveis com v4 no momento desta
  consulta).
```

---

## Comparação nos 18 critérios pedidos

```text
1. Integração com NestJS 11
A (class-validator): nativa via ValidationPipe do próprio @nestjs/common — zero dependency adicional.
B (Zod): via nestjs-zod 5.5.0, maduro, peer range exato para NestJS 11.1.28 (verificação externa acima)
  — não é mais "artesanal" como no legacy.
Diferenciador: leve vantagem de A (zero dependency extra) — mas B fecha essa lacuna com uma biblioteca
  de integração real e ativamente mantida, não um workaround.

2. Compatibilidade com TypeScript 6.0.3
A: compatível — mas depende de emitDecoratorMetadata (reflect-metadata) para os decorators de
  validação funcionarem, o MESMO mecanismo que o doc63 tratou com cautela adicional pelo contexto da
  transição TypeScript 7/tsgo (que remove a API clássica de compilador da qual ferramentas
  decorator-dependentes derivam parte de seu funcionamento hoje).
B: compatível, testado oficialmente contra TS 5.5+ (piso bem abaixo do 6.0.3 selecionado) — E não
  introduz NENHUMA dependência adicional de decorators/reflect-metadata além da que o próprio NestJS já
  exige inevitavelmente para DI (doc63, seção 5) — ou seja, escolher Zod não elimina a necessidade de
  emitDecoratorMetadata no projeto (o NestJS sempre vai precisar), mas evita adicionar uma SEGUNDA
  biblioteca que também dependeria desse mecanismo especificamente para validação de DTO.
Diferenciador: B — ponto genuinamente novo desta reavaliação, que não existia com a mesma clareza no
  doc44 (escrito antes da investigação da transição TS 6→7 do doc63).

3. DTOs HTTP
A: classe TypeScript com decorators (@IsString(), etc.) — 2 fontes de verdade coexistindo (a
  declaração de tipo da propriedade + os decorators de validação), que podem divergir sem erro de
  compilação (ex.: campo tipado `string` mas decorator esquecido).
B: o schema Zod É o tipo (via z.infer<typeof schema>) — 1 única fonte de verdade, impossível divergir
  entre "o que valida" e "o tipo que o TypeScript enxerga".
Diferenciador: B.

4. ValidationPipe
A: NestJS ValidationPipe nativo.
B: ZodValidationPipe do nestjs-zod (ou equivalente global), com API de configuração análoga.
Diferenciador: nenhum funcional — ambos suportam pipe global; ver seção dedicada abaixo.

5. Transformação de query/path/body
A: via "transform: true" + class-transformer, incluindo "enableImplicitConversion" (conversão
  IMPLÍCITA e GLOBAL de string→number/boolean/etc. em todo DTO, sem declaração por campo).
B: via z.coerce.number()/z.coerce.date()/etc., declarado EXPLICITAMENTE por campo — nenhuma conversão
  acontece "por padrão global", só onde o schema pede.
Diferenciador: B — o próprio prompt pede para "evitar coerções silenciosas perigosas"; a abordagem
  explícita por campo do Zod atende a esse requisito estruturalmente, enquanto o flag global do
  class-validator é exatamente o tipo de mecanismo que o prompt pede para evitar.

6. Validação nested
A: exige @ValidateNested() + @Type(() => NestedDto) em conjunto — padrão conhecido por ser fácil de
  esquecer (@Type() ausente é um bug silencioso documentado extensivamente na comunidade NestJS: o
  nested object não é transformado na classe certa e a validação nested simplesmente não roda).
B: z.object({ nested: OutroSchema }) — aninhamento é a forma natural de compor schemas, sem decorator
  paralelo que precise ser lembrado.
Diferenciador: B.

7. Arrays
A: @IsArray() + @ValidateNested({ each: true }) + @Type(() => ItemDto) — mesma composição de 3
  decorators coordenados do item 6.
B: z.array(ItemSchema) — nativo, uma única expressão.
Diferenciador: B.

8. Enums
A: @IsEnum(MeuEnum).
B: z.enum([...]) ou z.nativeEnum() (Zod v4 recomenda z.enum() unificado, conforme verificação externa).
Diferenciador: nenhum — ambos diretos e equivalentes em ergonomia.

9. Optional/null
A: @IsOptional() (decorator) distinto de tratamento de null explícito.
B: .optional()/.nullable()/.nullish() — vocabulário mais granular e explícito sobre a diferença entre
  "ausente" e "presente como null", relevante à mesma distinção que o doc63 avaliou (e decidiu não
  habilitar globalmente via exactOptionalPropertyTypes) — aqui a granularidade fica a cargo do autor do
  schema, caso a caso, sem depender de uma flag global do compilador.
Diferenciador: leve vantagem de B pela granularidade nativa, não decisivo isoladamente.

10. Mensagens de erro
A: mensagem por decorator/constraint, formato "campo deve satisfazer X" (default do NestJS/
  class-validator) — já o formato citado no doc50 (array de strings, um item por violação).
B: mensagem por schema/refinamento, com a API de customização de erro unificada da v4 (verificação
  externa) — igualmente capaz de produzir um array de mensagens por campo.
Diferenciador: nenhum — ambos compatíveis com o formato "message: string[]" já fixado no doc50 (ver
  seção Compatibilidade com o Modelo de Erro abaixo).

11. Validação cross-field
A: exige @ValidatorConstraint customizado — ferramenta pesada para um caso relativamente comum,
  cerimônia real (já era exatamente o motivo pelo qual o legacy usou Zod como escape hatch no domínio
  de transações, doc44, evidência já registrada e não invalidada por esta reavaliação).
B: .refine()/.superRefine() nativos, expressão direta de qualquer regra entre campos.
Diferenciador: B — critério onde o próprio histórico deste projeto (doc44) já demonstrou a fraqueza de
  A na prática, não uma preferência teórica.

12. Validação condicional
A: mesma cerimônia de @ValidatorConstraint, ou @ValidateIf() (mais limitado, cobre só alguns casos).
B: .refine()/.superRefine() com lógica arbitrária, ou z.discriminatedUnion() para formas condicionais
  bem definidas.
Diferenciador: B.

13. Type inference
A: tipo vem da declaração da classe, independente dos decorators de validação (2 fontes, item 3).
B: tipo inferido diretamente do schema (z.infer) — alinhado com a política de strictness já fixada no
  doc63 (strict, noUncheckedIndexedAccess) sem exigir manutenção paralela de decorator + tipo.
Diferenciador: B.

14. Decorators/reflection
A: depende de reflect-metadata + decorators para funcionar (mesmo mecanismo do NestJS, mas uma camada
  de uso ADICIONAL sobre ele).
B: não depende de decorators/reflection para a validação em si — reduz a superfície total de código
  decorator-dependente do projeto ao mínimo já inevitável (o próprio NestJS).
Diferenciador: B — mesmo raciocínio do critério 2, reforçado.

15. Performance
A: overhead de reflection + instanciação de classe por request.
B: Zod v4 documentado como significativamente mais rápido que v3 no parsing (verificação externa) e não
  paga custo de reflection.
Diferenciador: B, ainda que não seja o critério mais decisivo isoladamente para o volume desta API.

16. Testabilidade
A: testável via @nestjs/testing, maduro.
B: schemas são funções puras (schema.parse/safeParse) — testáveis isoladamente sem nenhuma
  infraestrutura de DI/Nest, ainda mais simples que A.
Diferenciador: leve vantagem de B, não decisivo isoladamente.

17. OpenAPI/Swagger
A: @nestjs/swagger lê os decorators de class-validator quase diretamente (@ApiProperty() e
  @IsString() convivendo na mesma classe) — integração historicamente mais "out of the box".
B: nestjs-zod declara peer compatível com @nestjs/swagger (verificação externa) e gera schema OpenAPI a
  partir do próprio schema Zod — funcional, mas uma camada de geração a mais que o padrão nativo de A.
Diferenciador: leve vantagem de A — único critério, junto do 1, onde A mantém uma vantagem real e não
  neutralizada por completo.

18. Manutenção
A: 1 única fonte de verdade por DTO viola-se facilmente (tipo da classe vs. decorators) ao longo do
  tempo conforme o time cresce/muda — risco de manutenção de médio prazo.
B: 1 única fonte de verdade estrutural (schema = tipo) — mudança em um schema Zod propaga
  automaticamente o tipo TypeScript correspondente, reduzindo divergência silenciosa ao longo da vida
  do projeto.
Diferenciador: B.
```

---

## Síntese

Dos 18 critérios, 2 favorecem A isoladamente (integração nativa sem dependency extra — critério 1;
Swagger "out of the box" — critério 17), 12 favorecem B claramente (critérios 2, 3, 5, 6, 7, 9, 11, 12,
13, 14, 15, 18), e 4 são equivalentes/não decisivos isoladamente (4, 8, 10, 16). Os 2 critérios NOVOS
introduzidos pela stack já fechada nos docs 59/63 — critério 2 (TypeScript 6, contexto de cautela com
decorators por causa da transição TS7 já investigada) e a reafirmação do critério 11/12 pela própria
experiência já documentada do legacy (doc44) — são exatamente o tipo de informação que não estava
disponível quando o doc44 foi escrito, conforme a própria premissa desta etapa.

---

## Regra de camadas (reafirmada, não reaberta)

```text
Validação HTTP (seja qual for a biblioteca escolhida) NÃO substitui validação de negócio — Use
Cases/Domain continuam responsáveis por invariantes e regras de negócio (doc47, não reaberto). DTO
HTTP nunca vira entidade de domínio — mesma fronteira já fixada no doc48 (DTOs em presentation/dto/,
Domain object em domain/entities|value-objects/, sempre tipos distintos mesmo quando os campos
coincidem). Trocar a biblioteca de validação de request não move essa fronteira.
```

---

## Hybrid — avaliado e rejeitado

```text
O modelo híbrido aceitável (class-validator+class-transformer para DTOs normais, Zod só para payloads
externos/dinâmicos que realmente justifiquem) foi considerado — mas, uma vez que Zod cobre igualmente
bem ou melhor TODOS os 18 critérios exceto 2 (integração nativa sem dependency extra, e Swagger
out-of-the-box), não existe mais uma fronteira técnica inequívoca que justifique manter 2 bibliotecas:
a escolha entre "usar A ou B neste DTO" se tornaria uma decisão subjetiva por complexidade percebida,
não uma separação estrutural de responsabilidade — exatamente o padrão que o próprio prompt pede para
não aceitar. Rejeitado.
```

---

## Versionamento

```text
CLASS_VALIDATOR_VERSION:
NONE

CLASS_TRANSFORMER_VERSION:
NONE

ZOD_VERSION:
4.4.3
```

---

## Validation Pipe (política global — usando Zod/nestjs-zod, equivalente conceitual a cada opção pedida)

```text
transform → equivalente nativo: schema.parse()/safeParse() já retorna o objeto totalmente tipado e
  transformado conforme o schema — não é uma flag à parte, é o comportamento padrão do parse.

whitelist → equivalente: comportamento padrão do Zod para z.object() já REMOVE chaves não declaradas
  no schema (strip implícito), a menos que .passthrough() seja usado explicitamente (não é o padrão
  desta política).

forbidNonWhitelisted → equivalente: uso explícito de .strict() no schema de nível superior de cada DTO
  — rejeita a requisição (em vez de só remover silenciosamente) quando uma propriedade não declarada
  está presente.

forbidUnknownValues → equivalente: coberto estruturalmente — safeParse() contra um schema de objeto
  falha naturalmente para qualquer valor que não seja um objeto do formato esperado, sem necessidade de
  uma flag dedicada.

validationError.target → política: o valor original da requisição NUNCA é anexado ao erro devolvido ao
  cliente (mesmo princípio de segurança do doc50 — SAFE_CLIENT_MESSAGE nunca inclui o payload bruto).

validationError.value → política: o valor inválido específico de cada campo também não é serializado
  de volta ao cliente por padrão — apenas o caminho do campo (path) e uma mensagem segura,
  consistente com a mesma regra de segurança do doc50 (nunca vazar dado potencialmente sensível — ex.:
  um valor de senha/token que falhou validação nunca deveria ecoar de volta na resposta de erro).
```

---

## Transformação implícita

```text
GLOBAL_IMPLICIT_CONVERSION:
NÃO

Nenhuma flag global de conversão implícita é usada — cada coerção necessária (ex.: query param string →
number) é declarada EXPLICITAMENTE por campo via z.coerce.*() no schema correspondente. Isso atende ao
requisito funcional (critério 5: transformação de query/path/body) sem o risco de "coerção silenciosa
perigosa" que uma flag global (enableImplicitConversion) aplicaria a TODOS os campos de TODOS os DTOs
indiscriminadamente — exatamente a distinção que o prompt pede para tornar explícita.
```

---

## Domain

```text
DOMAIN_DEPENDS_ON_VALIDATION_LIBRARY:
NÃO

Nenhum domain object (entidade/value object, doc47) importa class-validator, class-transformer, Zod ou
o ValidationPipe do NestJS — a fronteira já fixada no doc47/48 permanece: Zod (como qualquer biblioteca
de validação HTTP) vive exclusivamente em presentation/dto/, nunca em domain/. Trocar a biblioteca não
move essa fronteira, apenas troca o que ocupa o mesmo lugar já delimitado.
```

---

## Decisão final

```text
SELECTED:
ZOD

CHANGE_FROM_PREVIOUS_API_V2_DECISION:
SIM — o doc44 havia selecionado class-validator+class-transformer como padrão, com Zod como escape
  hatch excepcional. Esta reavaliação inverte essa decisão: Zod passa a ser o padrão único para
  validação de request HTTP na apps/api-v2, motivada por informação genuinamente nova desde o doc44
  (NestJS 11.1.28 e TypeScript 6.0.3 já fechados, com o contexto de cautela sobre decorators do doc63) e
  por uma reavaliação honesta dos 18 critérios pedidos, onde Zod venceu em 12 e empatou em 4, perdendo
  apenas em integração nativa sem dependency extra e em geração Swagger out-of-the-box — nenhum dos 2
  suficiente para justificar manter 2 bibliotecas ou reverter a escolha.
```

---

## Compatibilidade com o modelo de erro (doc50, não reaberto)

```text
ERROR_MODEL_COMPATIBLE: SIM — o Envelope HTTP definido no doc50 (statusCode/error/message/details/
timestamp/path/requestId/correlationId/traceId, formato PLANO) é inteiramente agnóstico de qual
biblioteca de validação populou "message"/"details" — o próprio doc50 já definiu "details.fields:
Record<string, string[]>" como formato de detalhamento por campo, compatível diretamente com a saída
estruturada de um ZodError.issues mapeado por path. Nenhuma mudança no doc50 foi necessária ou feita.
```

---

## Resumo

```text
UNRESOLVED_VALIDATION_DECISIONS:
0
```

## Cobertura

18 critérios pedidos comparados individualmente entre class-validator+class-transformer e Zod, com
versões verificadas em fontes primárias (registry.npmjs.org) incluindo a integração NestJS-Zod madura
(nestjs-zod 5.5.0, peer range exato para NestJS 11.1.28). Híbrido avaliado e rejeitado por ausência de
fronteira técnica inequívoca restante. Política de ValidationPipe global mapeada campo a campo
(transform/whitelist/forbidNonWhitelisted/forbidUnknownValues/validationError.target/value) para seus
equivalentes Zod. Conversão implícita global explicitamente desabilitada, substituída por coerção
explícita por campo. Regra de camadas (validação HTTP ≠ validação de negócio, DTO ≠ entidade de domínio)
reafirmada sem alteração. Domain confirmado independente de qualquer biblioteca de validação.
Compatibilidade com o modelo de erro do doc50 confirmada sem necessidade de alteração. Nenhum código/
DTO/ValidationPipe foi criado. Nenhuma dependência foi instalada. `apps/api-v2` não foi criado.
`apps/web`, `apps/api` (legacy) e modelo de erro não foram alterados. Nenhuma outra parte da stack foi
reavaliada. Nenhum documento anterior foi modificado.
