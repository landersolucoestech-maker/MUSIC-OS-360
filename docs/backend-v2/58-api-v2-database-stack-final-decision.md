> Historical record. Kept as recorded; not the current contract.

# 58 — Decisão Final: TypeORM vs. Drizzle para a `apps/api-v2`

Reavaliação genuína e independente da camada de acesso ao PostgreSQL da futura `apps/api-v2`, conforme exigido pelo prompt ("não escolher TypeORM apenas porque já existe, não escolher Drizzle apenas porque já foi decidido anteriormente"). Esta etapa reabre deliberadamente a decisão do doc45 — não reafirma por inércia; os 15 critérios pedidos foram reavaliados do zero, e 1 deles mudou de conclusão em relação ao doc45 (migrations — ver seção própria). Nenhum código foi escrito, nenhuma dependência foi instalada/atualizada, nenhum schema/migration foi criado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), banco, Supabase e Git não foram alterados.

## Stack atual confirmada (contexto, não reaberta como fato — apenas a DECISÃO de v2 é reaberta)

```text
Node.js 20 | NestJS 10.4.22 | PostgreSQL 17 / Supabase | TypeORM 0.3.31 | @nestjs/typeorm 10.0.2 | pg 8.20.0
Hoje: TypeORM = camada principal | pg direto = SQL/RLS específico | Supabase JS = Auth/Realtime
Drizzle existe apenas arquivado, não participa do runtime atual (doc55/57).
```

Como a `apps/api-v2` é nova, com schema novo e consolidado (doc46 — "banco v2: schema novo e consolidado"), **compatibilidade com o backend legacy não é requisito arquitetural** — nenhuma entidade TypeORM legacy precisa ser preservada, nenhuma migration legacy precisa ser herdada. A pergunta é estritamente: qual camada serve melhor a `apps/api-v2` em si.

---

## Comparação nos 15 critérios pedidos

```text
1. Compatibilidade com PostgreSQL 17
TypeORM: SIM — driver `pg` por baixo, protocolo wire do Postgres é retrocompatível; TypeORM 0.3.x não
  trava em nenhuma versão específica de servidor.
Drizzle: SIM — mesmos drivers (`pg`/`postgres.js`), mesma compatibilidade de protocolo.
DIFERENCIADOR: NENHUM — ambos plenamente compatíveis com PG17.

2. Integração com NestJS
TypeORM: Integração OFICIAL do time NestJS (@nestjs/typeorm) — @InjectRepository, DI nativo,
  documentação de primeira classe.
Drizzle: SEM integração oficial — requer um provider customizado (instância do client Drizzle exposta
  via DI), ~10-20 linhas de wiring, sem fricção estrutural (já desenhado no doc47/48).
DIFERENCIADOR: TypeORM tem vantagem real de "menos código de integração", mas o custo do lado Drizzle é
  pequeno e conhecido, não um risco.

3. Suporte a transactions
TypeORM: QueryRunner/EntityManager.transaction() — controle explícito, já comprovado em produção no
  padrão RLS do legacy.
Drizzle: db.transaction(async (tx) => {...}) — controle explícito equivalente, mapeamento direto para
  transação real do driver.
DIFERENCIADOR: NENHUM em capacidade bruta — a diferença real está no critério 5 (ver abaixo).

4. Controle de SQL
TypeORM: raw SQL via .query()/QueryBuilder — funcional, mas QueryBuilder é uma abstração mais pesada
  quando se quer fugir dela; .query() é raw puro mas sem nenhuma tipagem.
Drizzle: o helper `sql` (template tag parametrizado) é cidadão de primeira classe do próprio design da
  biblioteca, não uma via de escape secundária.
DIFERENCIADOR: Drizzle — controle de SQL é mais direto e idiomático, não uma fuga da abstração principal.

5. RLS e SQL específico do PostgreSQL
TypeORM: tecnicamente capaz (mesmo padrão QueryRunner.query() já provado no legacy) — MAS o próprio
  código do legacy documenta que isso ficou OPT-IN em 130+ call sites "para evitar um refactor
  descontrolado", porque o padrão Repository/Active-Record do TypeORM não impede uma query de usar um
  manager/repository fora do contexto de transação certo.
Drizzle: dentro de db.transaction(async (tx) => {...}), o parâmetro `tx` é a ÚNICA via de acesso ao
  banco disponível naquele escopo — não existe um manager global paralelo que uma query possa usar por
  engano para escapar do contexto de tenant.
DIFERENCIADOR: Drizzle — este continua sendo o critério mais decisivo e o mais específico deste
  projeto (multi-tenancy desde a primeira migration é requisito explícito desta etapa), reafirmado após
  reavaliação, não apenas herdado do doc45 sem novo exame.

6. Migrations
TypeORM: sistema de migration embutido, TODA migration é 100% SQL cru por padrão (queryRunner.query()
  dentro de up()/down()) — não há etapa de diff/DSL entre a migration e o SQL final; é, na prática, tão
  direto para RLS/extensions/functions/triggers quanto SQL manual puro.
Drizzle: Drizzle Kit gera migrations por diff de schema TypeScript; RLS/extensions/functions/triggers
  exigem o modo --custom (arquivo vazio para SQL manual) — um passo a mais que o TypeORM não tem.
DIFERENCIADOR: TypeORM — CORREÇÃO EXPLÍCITA frente ao doc45/46: uma reavaliação honesta deste critério
  isoladamente favorece TypeORM, não Drizzle. O doc46 já havia escolhido corretamente um modelo híbrido
  (Drizzle Kit + SQL manual controlado) precisamente PORQUE o modo puramente automático do Drizzle não
  bastava para RLS — o que já era, na prática, um reconhecimento indireto de que TypeORM não precisaria
  desse contorno. Este achado NÃO reverte a decisão final (ver Síntese), mas é registrado com
  honestidade: não é um ponto a favor de Drizzle.

7. Constraints e indexes compostos
TypeORM: suportado via @Unique(['a','b'])/@Index(['a','b']) em Entity, ou SQL cru em migration.
Drizzle: suportado via unique().on(t.a,t.b)/index().on(t.a,t.b) no schema TypeScript.
DIFERENCIADOR: NENHUM — capacidade equivalente.

8. Type safety
TypeORM: entities tipadas via decorators + reflect-metadata (runtime); QueryBuilder e .query() raw
  retornam `any` sem tipagem adicional manual.
Drizzle: tipos inferidos DIRETAMENTE do schema TypeScript, sem etapa de geração de código separada e
  sem depender de reflection em runtime — o schema TS já É o tipo, incluindo para a maioria das queries.
DIFERENCIADOR: Drizzle — vantagem real e não ligada a legacy, relevante especificamente por a v2 ser um
  código novo que pode se apoiar integralmente em tipagem estática desde o primeiro dia.

9. Performance/overhead
TypeORM: reflect-metadata + construção do grafo de decorators tem custo de boot mensurável — relevante
  para o alvo de deployment serverless já confirmado (doc42/43, não reaberto aqui, apenas citado como
  fato ainda válido) onde cold start importa.
Drizzle: sem reflect-metadata, biblioteca mais fina — menor overhead de boot.
DIFERENCIADOR: Drizzle — vantagem mensurável, mesma lógica do doc45, não invalidada por nada nesta
  reavaliação.

10. Testabilidade
TypeORM: @nestjs/testing + TypeORM já maduro, amplamente documentado.
Drizzle: queries são funções simples sobre um schema — testável com Postgres real sem nenhuma
  infraestrutura de DI adicional; igualmente maduro para este propósito específico.
DIFERENCIADOR: NENHUM relevante — ambos plenamente testáveis, apenas estilos distintos.

11. Complexidade operacional
TypeORM: ecossistema maior, mais anos de mercado, mais Stack Overflow/exemplos de terceiros.
Drizzle: ecossistema mais novo mas maduro para os casos de uso deste projeto (schema relacional Postgres
  padrão); documentação oficial direta e específica de Postgres.
DIFERENCIADOR: leve vantagem de TypeORM em volume de conhecimento de mercado; não decisiva por si só.

12. Risco arquitetural
TypeORM: risco de REPETIR o mesmo padrão que o próprio legacy já identificou como problemático (RLS
  opt-in por ser caro de aplicar sistematicamente sobre Repository/Active-Record) — desta vez sem a
  desculpa de ser um sistema legado sendo migrado, já que a v2 nasceria sabendo do problema.
Drizzle: risco de introduzir uma dependência nova ao ecossistema do projeto — mitigado parcialmente
  pelo fato de a equipe já ter tido exposição direta a este exato pacote (drizzle-kit, doc45/54/55, ainda
  que descontinuado por motivo de migration tooling, não de capacidade de query).
DIFERENCIADOR: Drizzle — o risco de repetir um padrão já comprovadamente problemático NESTE MESMO
  projeto pesa mais do que o risco de uma dependência nova e já parcialmente conhecida pela equipe.

13. Dependência de decorators/reflection
TypeORM: dependência estrutural — entities exigem experimentalDecorators/emitDecoratorMetadata,
  reflect-metadata como dependency runtime obrigatória.
Drizzle: nenhuma dependência de decorators/reflection — schema é TypeScript puro (funções/objetos).
DIFERENCIADOR: Drizzle — tsconfig da v2 fica mais simples (doc47 já exige Domain sem dependência de
  framework; um schema sem decorators reduz a superfície de acoplamento a infraestrutura mesmo na
  camada de Persistence).

14. Facilidade de manter repository adapters isolados (Port/Adapter, doc47)
TypeORM: Repository do TypeORM já É, por design, uma classe acoplada a decorators/DataSource — o
  Adapter da arquitetura em camadas (doc47) precisa envolver essa classe para isolar o Port; funciona,
  mas é uma camada de indireção sobre outra abstração já pesada.
Drizzle: consultas são funções que recebem `db`/`tx` — encaixam diretamente como corpo de um Persistence
  Adapter sem precisar encapsular uma segunda camada de abstração por baixo.
DIFERENCIADOR: Drizzle — menos indireção para chegar ao mesmo resultado arquitetural já decidido no
  doc47.

15. Custo de introduzir uma tecnologia nova no projeto
TypeORM: custo zero de introdução (já é dependency do monorepo) — mas não custo zero de RISCO (critério
  12).
Drizzle: custo real de introdução — nova dependency, novo padrão de schema, mitigado por: (a) não
  precisar reinstalar/reconfigurar nada agora (esta etapa não instala nada), (b) exposição prévia já
  registrada da equipe ao pacote via o histórico drizzle-kit.
DIFERENCIADOR: TypeORM tem vantagem literal de custo-zero-de-introdução; é o único critério onde a
  resposta "seria mais barato manter o que já existe" é tecnicamente verdadeira — mas o prompt já
  instrui explicitamente a não deixar esse fator decidir sozinho ("não escolher TypeORM apenas porque
  já existe").
```

---

## Síntese

Dos 15 critérios, 2 favorecem claramente TypeORM (migrations — critério 6, achado NOVO desta
reavaliação; custo de introdução — critério 15, esperado e já desqualificado pelo próprio prompt como
critério decisório isolado), 6 favorecem claramente Drizzle (RLS/SQL específico — critério 5, controle
de SQL — critério 4, type safety — critério 8, performance/overhead — critério 9, risco arquitetural —
critério 12, dependência de decorators/isolamento de Adapter — critérios 13/14), e 7 são equivalentes ou
sem diferenciador decisivo (PG17, transactions em capacidade bruta, constraints/indexes, testabilidade,
integração NestJS via wiring simples, complexidade operacional).

O critério 5 (RLS/SQL específico do PostgreSQL) permanece o mais determinante especificamente porque a
etapa exige multi-tenancy DESDE A PRIMEIRA MIGRATION (requisito explícito deste prompt) — e é o único
critério, entre os 15, com evidência CONCRETA e ESPECÍFICA DESTE PROJETO de que a alternativa rejeitada
(TypeORM/Repository pattern) já falhou em ser aplicada de forma sistemática no legacy, não por
limitação teórica genérica, mas por um fato documentado no próprio código-fonte deste repositório.

A correção do critério 6 (migrations) não muda a conclusão porque migrations são um evento pontual e
auditável por revisão de código (cada arquivo de migration é revisado individualmente antes de aplicar,
doc46), enquanto o risco do critério 5 é um risco DISTRIBUÍDO por centenas de pontos de código de query
cotidiana ao longo de toda a vida útil da aplicação — a natureza do risco (pontual e revisável vs.
distribuído e silencioso) pesa mais do que a contagem de critérios a favor de cada lado.

---

## Decisão

```text
SELECTED:
DRIZZLE

WHY:
Entre os 15 critérios reavaliados do zero, o único com evidência concreta e específica deste projeto
(não genérica de mercado) é o critério 5: o próprio código-fonte do legacy documenta que o padrão
Repository/Active-Record do TypeORM tornou caro garantir que toda query rode dentro do contexto
transacional de RLS, a ponto de o time ter deixado esse controle como opt-in em vez de universal. Como
esta etapa exige multi-tenancy desde a PRIMEIRA migration da v2 (não como retrofit), a camada escolhida
precisa tornar estruturalmente difícil — não apenas convencionalmente desencorajado — que uma query
escape do contexto de tenant. O modelo de transação do Drizzle (parâmetro `tx` como única via de acesso
dentro do callback) atende a esse requisito por construção; o TypeORM atende por disciplina de equipe,
que já falhou uma vez neste mesmo projeto. Os demais critérios favoráveis a Drizzle (controle de SQL
mais direto, type safety sem reflection, menor overhead em ambiente serverless já confirmado, menos
indireção para isolar Repository Adapters) reforçam a escolha sem serem, isoladamente, decisivos.

REJECTED:
TypeORm — rejeitado apesar de vantagens reais e reconhecidas (integração NestJS oficial, migrations
100% SQL puro sem etapa de diff, custo zero de introdução, maior volume de conhecimento de mercado) —
nenhuma delas neutraliza o risco concreto e já observado neste projeto do critério 5. Híbrido (2 ORMs
competindo pela mesma responsabilidade) — rejeitado explicitamente pela regra do próprio prompt: não há
separação de responsabilidade que justifique TypeORM e Drizzle executando CRUD sobre os mesmos
domínios; o modelo "ORM + SQL manual controlado para RLS/migrations" já é, por definição, o design
interno de QUALQUER um dos dois ORMs escolhidos isoladamente (Drizzle+SQL manual via doc46, ou
TypeORM+SQL manual via migrations 100% raw) — não constitui um "híbrido" de 2 tecnologias de acesso
competindo, é o mesmo padrão de 1 ORM + escape hatch de SQL que ambas as alternativas já compartilham.

CHANGE_FROM_CURRENT_STACK_REQUIRED:
SIM — a stack atual do projeto (TypeORM, seção "Stack atual confirmada" acima) usa TypeORM; a
apps/api-v2 usará Drizzle. Isso é uma mudança de tecnologia entre o legacy e a v2, não uma continuidade
— mas não é uma "mudança da stack atual" no sentido de alterar o que já está em produção (apps/api
legacy continua em TypeORM, não reaberto, não alterado).
```

---

## Esclarecimentos (Drizzle selecionado)

```text
TYPEORM_IN_API_V2:
NÃO

PG_DIRECT_ALLOWED:
SIM — via o helper `sql` do próprio Drizzle (não pg cru fora do Drizzle) para os casos que exigem SQL
literal (RLS SET LOCAL, doc45/47/51), sempre dentro do mesmo Transaction Context já definido no doc51 —
mesma resposta já dada no doc45, reafirmada após reavaliação completa.

PG_DIRECT_PURPOSE:
Primitivo de sessão RLS (SET LOCAL app.current_tenant_id/org_id/role, doc45/47/49/51) e qualquer
operação PostgreSQL específica que a DSL de schema do Drizzle não represente (extensions, functions,
triggers, doc46) — nunca para CRUD comum de domínio, que usa o query builder do Drizzle normalmente.

DRIZZLE_MIGRATIONS:
Drizzle Kit + SQL manual controlado (híbrido) — decisão já fixada e não reaberta no doc46
(schema relacional gerado automaticamente via `drizzle-kit generate`; RLS/extensions/functions/triggers
via `drizzle-kit generate --custom`, SQL explícito).

MANUAL_SQL:
Permitido e esperado nos casos já listados no doc46/51 — sempre versionado como migration explícita
(RLS) ou como uso do helper `sql` dentro de um Transaction Context (queries operacionais que precisam de
controle fino) — nunca como SQL solto fora desses 2 mecanismos já definidos.
```

---

## Validação cruzada com requisitos obrigatórios da etapa

```text
PostgreSQL 17: SIM (critério 1)
Supabase: SIM (mesmo driver pg/postgres.js compatível com Postgres gerenciado pelo Supabase, sem
  dependência de nenhum SDK Supabase para a camada de dado em si — Supabase JS permanece só para
  Auth/Realtime, doc57)
multi-tenancy desde a primeira migration: SIM (critério 5 é exatamente a razão da escolha)
RLS: SIM (critério 5)
composite unique constraints: SIM (critério 7)
composite indexes: SIM (critério 7)
transactions: SIM (critério 3)
SQL manual quando necessário: SIM (PG_DIRECT_ALLOWED acima)
repository ports/adapters: SIM (critério 14 — Drizzle reduz indireção para o modelo já aprovado no doc47)
Domain sem dependência do ORM: SIM (nenhuma mudança em relação ao doc47 — Drizzle nunca é importado por
  Domain, só por Persistence)
NestJS: SIM (critério 2 — integração via provider customizado, sem fricção estrutural)
TypeScript: SIM (critério 8 — inclusive reforçado, tipos sem reflection)
schema novo e limpo: SIM (doc46, não reaberto)
sem necessidade de preservar entidades TypeORM legacy: SIM (premissa da própria etapa, confirmada —
  nenhuma entidade legacy é reaproveitada)
```

---

## Resumo

```text
UNRESOLVED_DATABASE_STACK_DECISIONS:
0
```

## Cobertura

Os 15 critérios pedidos foram reavaliados individualmente e do zero, sem assumir a conclusão do doc45
como ponto de partida — 1 critério (migrations) mudou de conclusão em relação ao doc45 e foi registrado
com essa correção explícita, sem que isso alterasse a decisão final, cuja justificativa central
permanece o critério 5 (RLS/SQL específico), o único com evidência concreta e específica deste projeto
entre os 15. Híbrido (2 ORMs competindo) foi explicitamente considerado e rejeitado conforme a regra do
próprio prompt. Nenhuma implementação foi feita. Nenhuma dependência foi instalada/atualizada/removida.
`package.json`/lockfile não foram alterados. Nenhum schema/migration foi criado. `apps/api-v2` não foi
criado. `apps/web`, `apps/api` (legacy), banco, Supabase e Git não foram alterados. Nenhum outro aspecto
da stack foi reavaliado. Nenhum documento anterior foi modificado.
