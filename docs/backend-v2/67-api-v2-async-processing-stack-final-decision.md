> Historical record. Kept as recorded; not the current contract.

# 67 — Decisão Final: Stack de Filas, Jobs e Processamento Assíncrono da `apps/api-v2`

Definição read-only da stack de queues/background jobs/workers/scheduled jobs/retries/delayed jobs da futura `apps/api-v2`, reavaliando genuinamente frente ao legacy (BullMQ+Redis), com verificação de versões em fontes primárias (npm registry). Estratégia transacional (doc51), observabilidade (doc52), deployment long-running (doc61) e regras de preservação de comportamento (doc62) não reabertos. Nenhuma dependência foi instalada, nenhum worker/queue/cron/outbox foi criado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), banco e deployment não foram alterados.

## Stack já fechada (contexto, não reaberta)

```text
Node.js 24 | TypeScript 6.0.3 | NestJS 11.1.28 | Express 5.2.1 | Zod 4.4.3 | PostgreSQL 17/Supabase |
Drizzle ORM 0.45.2 | pg 8.22.0 | Supabase Auth | jose 6.2.8 | Long-running container
```

## Estado atual do legacy (auditado só para entender o existente, doc54/57 — não reaberto)

```text
BullMQ 5.76.8 + @nestjs/bullmq 10.2.3 + ioredis 5.10.1 + @bull-board/* 7.1.5 — ATIVO só em modo Docker/
long-running; explicitamente desabilitado em modo serverless Vercel (comentário do próprio código-fonte
legacy, já citado nos docs 42/51/61).
```

---

## Verificação externa (versões atuais confirmadas via registry.npmjs.org nesta etapa)

```text
pg-boss: 12.27.0 | engines: Node.js >= 22.12.0 (satisfeito por Node 24) | dependency "pg": "^8.22.0"
  — EXATAMENTE a mesma versão de pg já selecionada no doc65, sem necessidade de uma segunda instância
  ou versão distinta do driver.
bullmq: 6.0.9 | engines: Node.js >= 14.17.0 (satisfeito).
@nestjs/bullmq: 11.0.5 | peer: bullmq "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0", @nestjs/common
  "^10.0.0 || ^11.0.0" — compatível com a stack já fechada (NestJS 11.1.28).
@nestjs/schedule: 6.1.3 | peer: @nestjs/common "^10.0.0 || ^11.0.0" — compatível.
```

---

## Comparação nos 18 critérios pedidos

```text
1. NestJS 11
A (BullMQ+Redis): SIM, via @nestjs/bullmq 11.0.5 (peer range confirma compatibilidade exata).
B (Postgres-backed, pg-boss): SIM, via provider customizado (mesmo padrão já usado para Drizzle,
  doc47/58/65) — sem pacote de integração NestJS dedicado necessário, nem prejuízo por isso.
C (local only): SIM, via @nestjs/schedule 6.1.3.
Diferenciador: nenhum — as 3 rodam sob NestJS 11 sem fricção.

2. Node.js 24
A: SIM (bullmq >=14.17.0). B: SIM (pg-boss >=22.12.0, Node 24 satisfaz). C: SIM (@nestjs/schedule sem
  piso próprio relevante).
Diferenciador: nenhum.

3. Retries
A: nativo, configurável por job (attempts + backoff).
B: nativo em pg-boss (retryLimit, retryDelay, retryBackoff) — mesma capacidade.
C: não aplicável nativamente — @nestjs/schedule é um agendador in-process, sem semântica própria de
  retry de unidade de trabalho.
Diferenciador: A/B equivalentes, C insuficiente sozinho.

4. Exponential backoff
A: suportado nativamente (backoff: {type: 'exponential', delay}).
B: suportado nativamente (retryBackoff: true em pg-boss).
C: não aplicável.
Diferenciador: A/B equivalentes.

5. Delayed jobs
A: suportado nativamente (delay ao enfileirar).
B: suportado nativamente (startAfter em pg-boss).
C: não aplicável de forma durável (um timeout in-process não sobrevive a restart).
Diferenciador: A/B equivalentes, C insuficiente.

6. Scheduled jobs
A: suportado via repeatable jobs (cron-like) do próprio BullMQ.
B: suportado nativamente — pg-boss depende de "cron-parser" (verificação externa) especificamente para
  sua própria API de agendamento durável (schedule()).
C: suportado via decorators @Cron()/@Interval() do @nestjs/schedule — mas NÃO durável (perde o tick se
  o processo reiniciar exatamente na janela).
Diferenciador: A/B equivalentes e duráveis; C é complementar, não substituto (ver seção Scheduler).

7. Concurrency
A: controle nativo de concorrência por worker/queue (concurrency option).
B: controle nativo de concorrência por worker em pg-boss, coordenado via SELECT ... FOR UPDATE SKIP
  LOCKED no Postgres (padrão maduro e bem estabelecido para dequeue concorrente seguro).
Diferenciador: nenhum — ambos resolvem concorrência de forma segura e nativa.

8. Idempotency
A: responsabilidade do handler do job, mecanismo de deduplicação (jobId único) disponível.
B: mesma responsabilidade do handler, mas pg-boss adiciona singletonKey nativo para deduplicação de
  enfileiramento (evita 2 jobs logicamente idênticos coexistindo na fila).
Diferenciador: leve vantagem de B pelo singletonKey nativo; ver seção Idempotência dedicada abaixo.

9. Dead-letter/failure handling
A: job "failed" state, inspecionável via Bull Board ou API própria.
B: job "failed" state, inspecionável via SQL/Drizzle comum (mesma tabela/schema do próprio banco já
  usado para dado de negócio, sem ferramenta externa dedicada obrigatória).
Diferenciador: leve vantagem de B pela inspeção via a mesma stack de dados já usada (Drizzle/SQL),
  sem exigir uma segunda ferramenta de visualização (Bull Board) desde o início.

10. Observability
A: exige instrumentação própria (métricas Bull Board, ou custom via eventos do BullMQ) — infraestrutura
  de observabilidade PARALELA à do banco principal.
B: estado da fila é uma tabela Postgres comum — a MESMA infraestrutura de observabilidade já definida no
  doc52 (logging estruturado, métricas sobre queries) cobre a fila sem desenho adicional.
Diferenciador: B — reaproveita diretamente a estratégia de observabilidade já aprovada, sem uma segunda
  trilha de instrumentação paralela.

11. Horizontal scaling
A: múltiplos workers consumindo a mesma fila Redis — padrão maduro e testado em larga escala.
B: múltiplos workers consumindo a mesma fila Postgres via SKIP LOCKED — padrão igualmente maduro e
  testado (usado por outras ferramentas de fila Postgres consolidadas no mercado), com throughput
  suficiente para o volume esperado desta aplicação (webhooks/relatórios/notificações/sincronizações
  por tenant — não um sistema de streaming de altíssimo volume).
Diferenciador: leve vantagem teórica de A em throughput bruto máximo (Redis é in-memory) — não decisivo
  para o perfil de carga real desta aplicação, conforme o próprio contexto funcional desta etapa.

12. Graceful shutdown
A: métodos de close() documentados, drena jobs ativos.
B: mesma capacidade — encerrar o polling do worker e aguardar o job em andamento concluir antes de
  fechar a conexão do pool (mesmo pool pg já definido no doc65).
Diferenciador: nenhum.

13. Deployment em container
A: exige um SERVIÇO ADICIONAL (Redis) provisionado, monitorado e mantido separadamente do container da
  API — uma peça de infraestrutura nova que a stack já fechada da v2 (docs 58-66) não inclui em nenhum
  outro ponto.
B: nenhum serviço adicional — reaproveita o MESMO PostgreSQL/Supabase já provisionado para todo o resto
  do sistema.
Diferenciador: B — critério concreto e específico desta etapa (a v2, até aqui, não tem nenhuma outra
  razão para depender de Redis).

14. Custo operacional
A: custo de operar/monitorar/fazer backup de um serviço Redis adicional, com sua própria estratégia de
  persistência (AOF/RDB) para não perder jobs em um crash do próprio Redis.
B: custo zero adicional de infraestrutura — a durabilidade da fila herda diretamente as mesmas garantias
  de backup/replicação já aplicadas ao banco de dados de negócio (não é uma segunda politica de
  durabilidade a manter).
Diferenciador: B.

15. Dependência externa adicional
A: Redis (nova categoria de infraestrutura) + bullmq + @nestjs/bullmq (+ opcionalmente @bull-board/*
  para visualização).
B: 1 pacote (pg-boss), zero infraestrutura nova (reaproveita PostgreSQL já presente).
Diferenciador: B.

16. Integração com outbox pattern
A: exige uma tabela de outbox PRÓPRIA no Postgres (para atomicidade com a escrita de negócio) mais um
  processo relay separado que leia essa tabela e publique na fila Redis — 2 sistemas de durabilidade
  distintos a manter sincronizados (Postgres para a escrita de negócio + outbox, Redis para a fila em
  si), com uma janela real de inconsistência entre o commit no Postgres e a publicação no Redis.
B: o enfileiramento PODE ocorrer na MESMA transação Drizzle que a escrita de negócio (mesmo Transaction
  Context já definido no doc51) — o job de fila JÁ É, estruturalmente, o registro durável que sobrevive
  a falha após commit — não precisa de uma tabela de outbox SEPARADA da fila, porque a fila em si já
  está no mesmo banco/transação.
Diferenciador: B — vantagem arquitetural concreta e direta, não genérica, para os requisitos de
  atomicidade/rastreabilidade financeira já fixados no doc51/62.

17. Processamento cross-domain
A/B: equivalentes — um job de fila pode chamar o Public Application Service de qualquer domínio (mesma
  regra de cross-domain do doc47, não reaberta), independentemente de qual tecnologia de fila o
  disparou.
Diferenciador: nenhum.

18. Recuperação após crash
A: jobs sobrevivem a um crash do CONTAINER da API (persistidos no Redis), mas só se o próprio Redis
  também estiver configurado com persistência adequada — uma segunda superfície de possível perda de
  dado a considerar.
B: jobs sobrevivem tanto a um crash do container da API quanto herdam diretamente a mesma garantia de
  durabilidade já confiada para os dados financeiros/de negócio (mesmo Postgres, mesmo backup) — uma
  única superfície de durabilidade a raciocinar sobre, não duas.
Diferenciador: B.
```

---

## Síntese

Dos 18 critérios, a maioria das capacidades funcionais brutas (retries, backoff, delayed/scheduled
jobs, concorrência, idempotência, graceful shutdown, cross-domain) é equivalente entre BullMQ+Redis e
uma fila Postgres madura (pg-boss) — a diferença decisiva está nos critérios 13, 14, 15, 16 e 18, todos
girando em torno do MESMO fato concreto: a stack já fechada da apps/api-v2 (docs 58-66) não tem, até
este ponto, NENHUMA outra razão para depender de Redis — introduzi-lo agora seria adicionar uma
categoria inteira de infraestrutura nova só para filas, enquanto uma fila Postgres reaproveita a
infraestrutura de banco já decidida e se integra estruturalmente ao padrão de outbox transacional que o
doc51 já havia antecipado como necessidade futura (write + outbox/event persistence).

---

## Fila não pode virar fonte de verdade

```text
QUEUE_IS_SOURCE_OF_TRUTH:
NÃO

Dados de negócio continuam persistidos exclusivamente nas tabelas de domínio via Drizzle (doc45/47/58).
A tabela de estado da fila (mesmo estando fisicamente no mesmo banco PostgreSQL, no caso da opção
selecionada) é um schema/conjunto de tabelas PRÓPRIO de coordenação de processamento — nunca uma
segunda cópia ou fonte alternativa de um fato de negócio já registrado (mesmo princípio de Source of
Truth já fixado no doc62, aplicado aqui explicitamente à infraestrutura de fila).
```

---

## Financeiro

```text
Operações financeiras (transaction/accounting/profit & loss, doc62) nunca dependem EXCLUSIVAMENTE de
um job assíncrono para sua consistência imediata — a escrita da Transacao em si e qualquer efeito
local que precise ser atômico com ela (ex.: audit log obrigatório, doc51) continuam dentro da mesma
transação síncrona do Use Case, respeitando a estratégia transacional já aprovada. A fila é usada para
efeitos SECUNDÁRIOS e desacoplados (ex.: notificar, sincronizar, gerar relatório a partir do dado já
persistido) — nunca como o único caminho pelo qual um fato financeiro passa a existir.
```

---

## Outbox

```text
TRANSACTIONAL_OUTBOX_SUPPORTED:
SIM

Suportado estruturalmente pela própria escolha de fila (pg-boss, seção 16 acima) — o enfileiramento de
um job pode ocorrer dentro da MESMA transação Drizzle da escrita de negócio que o originou (mesmo
Transaction Context do doc51), eliminando a janela de inconsistência entre "commit da escrita de
negócio" e "job publicado" que uma fila em sistema externo (Redis) exigiria resolver com uma tabela de
outbox e um processo relay separados. Não implementado nesta etapa — apenas confirmado como suportado
pela arquitetura escolhida.
```

---

## Worker

```text
SEPARATE_WORKER_PROCESS_SUPPORTED:
SIM

A HTTP API e o(s) processo(s) worker são responsabilidades separáveis — um worker pg-boss pode rodar
como um processo Node adicional (mesma base de código, container separado ou replica dedicada) que
apenas consome a fila, sem precisar aceitar tráfego HTTP, OU como um listener dentro do mesmo processo
da API (decisão de topologia não tomada aqui). Nenhum segundo serviço é criado nesta etapa — apenas
confirmado que o modelo escolhido não impede essa separação futura, consistente com o Background
Processing já registrado no doc61.
```

---

## Scheduler

```text
QUEUE SCHEDULER / DELAYED JOBS (pg-boss):
Papel: agendamento DURÁVEL e relevante ao negócio — qualquer tarefa que precise sobreviver a um restart/
  crash do processo e cuja perda seria um problema real (ex.: retry de entrega de webhook, envio de
  notificação agendada, geração periódica de relatório financeiro). Usa a API nativa de schedule do
  pg-boss (baseada em cron-parser, verificação externa) para recorrência, e startAfter/retryDelay para
  atraso pontual.

NESTJS SCHEDULE (@nestjs/schedule 6.1.3):
Papel: agendamento LEVE e NÃO-durável, in-process — tarefas onde perder um tick pontual (por reinício
  do processo) é inconsequente e não há necessidade de persistência/retry (ex.: atualizar um valor em
  cache in-memory periodicamente, emitir uma métrica de heartbeat). Nunca usado para nada que o
  requisito funcional já liste como sensível (webhooks, processamentos financeiros, sincronizações que
  não podem simplesmente ser puladas).

CRON EXTERNO:
Não utilizado — o modelo de deployment já aprovado é long-running container (doc61, não Vercel
  serverless), então não há necessidade arquitetural de um disparo HTTP externo (tipo Vercel Cron) para
  suprir a ausência de um processo persistente — o próprio processo já pode se auto-agendar via os 2
  mecanismos acima. Evita a duplicidade explicitamente advertida pelo prompt (2 soluções fazendo o
  mesmo tipo de agendamento sem necessidade).
```

---

## Redis

```text
REDIS_REQUIRED:
NÃO

(Redis não é necessário — decisão pela opção B, seção Decisão Final abaixo — nenhum fornecedor de
Redis é escolhido, nem seria aplicável)
```

---

## Postgres queue

```text
Ferramenta concreta: pg-boss 12.27.0 (biblioteca madura, ativamente mantida, publicada especificamente
  para "queueing jobs in Postgres from Node.js" — verificação externa) — não uma fila artesanal
  construída à mão sobre uma tabela própria (justificativa explícita já exigida pelo prompt): pg-boss
  já resolve dequeue concorrente seguro (SELECT ... FOR UPDATE SKIP LOCKED), retries com backoff,
  scheduling via cron-parser, e deduplicação via singletonKey, sem precisar reimplementar nenhuma dessa
  lógica.
```

---

## Idempotência

```text
RETRYABLE_JOB_MUST_BE_IDEMPOTENT:
SIM

Estratégia conceitual (não implementada nesta etapa):
- idempotency key: um identificador determinístico derivado do dado de negócio (ex.: combinação de
  tenantId + entidade + tipo de operação), usado como singletonKey nativo do pg-boss no momento do
  enfileiramento — evita 2 jobs logicamente idênticos coexistindo na fila.
- deduplication: dupla camada — (1) no enfileiramento, via singletonKey acima; (2) na execução, o
  próprio handler do job verifica se o efeito já foi aplicado antes de repeti-lo (ex.: checar se um
  webhook já foi confirmadamente entregue antes de reenviar), defesa em profundidade contra
  reprocessamento mesmo que a deduplicação de enfileiramento seja contornada por algum caminho.
- retry safety: reforça diretamente a regra já fixada no doc51 (side effects externos irreversíveis
  nunca dentro do bloco de trabalho de uma transação retentável) — um job de fila retentável nunca
  dispara um efeito externo não-idempotente sem antes verificar/registrar que ainda não foi feito.
```

---

## Failure Policy

```text
MAX_ATTEMPTS_POLICY:
Configurável por tipo de job (retryLimit do pg-boss) — sem um número global rígido, já que a
tolerância a falha varia por natureza do job (ex.: um webhook para um provider externo instável pode
justificar mais tentativas que uma tarefa interna determinística).

BACKOFF_POLICY:
Exponencial (retryBackoff nativo do pg-boss), evitando reprocessamento imediato e agressivo contra uma
dependência externa já degradada.

PERMANENT_FAILURE_HANDLING:
Após esgotar as tentativas configuradas, o job transiciona para estado "failed", permanecendo
inspecionável via SQL/Drizzle comum (mesma stack de dado já usada para negócio, critério 9/10 acima) —
não é silenciosamente descartado; requer decisão explícita futura (reprocessamento manual, alerta,
ou ação compensatória, doc51) sobre o que fazer com uma falha permanente, não decidida nesta etapa.

FAILED_JOB_OBSERVABILITY:
SIM — reaproveitando diretamente a estratégia de observabilidade já aprovada no doc52 (logging
estruturado + métricas), sem uma segunda trilha de instrumentação paralela dedicada só à fila.
```

---

## Decisão final

```text
SELECTED:
POSTGRES_QUEUE

QUEUE_LIBRARY:
pg-boss

QUEUE_LIBRARY_VERSION:
12.27.0
```

Justificativa: dos 18 critérios avaliados, a maior parte é equivalente entre BullMQ+Redis e uma fila
Postgres madura — a decisão foi por Postgres especificamente porque a stack já fechada da apps/api-v2
(docs 58-66) não depende de Redis em NENHUM outro ponto, e introduzi-lo agora seria adicionar uma
categoria inteira de infraestrutura nova só para esta responsabilidade. Mais decisivo ainda: pg-boss se
integra estruturalmente ao padrão de outbox transacional que o próprio doc51 já havia antecipado como
necessidade futura (write + outbox/event persistence como critério de atomicidade obrigatória) — o
enfileiramento pode ocorrer na mesma transação Drizzle da escrita de negócio, eliminando a janela de
inconsistência entre 2 sistemas de durabilidade (Postgres + Redis) que a opção A exigiria resolver com
peças adicionais (tabela de outbox própria + processo relay). Não foi escolhido "porque o legacy usa
Redis" (foi o oposto — o legacy foi auditado só para contexto, não copiado) nem BullMQ foi descartado
por incapacidade técnica (ambos cobrem os requisitos funcionais igualmente bem) — a decisão foi por
menor custo operacional e melhor encaixe arquitetural específico com os requisitos financeiros/de
atomicidade já fixados nos docs 51/62.

---

## Resumo

```text
UNRESOLVED_ASYNC_STACK_DECISIONS:
0
```

## Cobertura

18 critérios pedidos comparados entre BullMQ+Redis, fila Postgres (pg-boss) e agendamento local
(@nestjs/schedule), com versões exatas confirmadas via registry.npmjs.org (incluindo a compatibilidade
exata de pg-boss com a mesma versão de `pg` já selecionada no doc65). Regra de fila-não-é-fonte-de-
verdade, princípio financeiro de não-dependência exclusiva de job assíncrono, suporte a outbox
transacional, separabilidade de worker/HTTP API, divisão de papel entre scheduler durável (pg-boss) e
agendamento leve não-durável (@nestjs/schedule) sem duplicidade, ausência de necessidade de Redis,
ferramenta Postgres concreta e madura (não artesanal), política de idempotência (chave determinística +
dupla camada de deduplicação) e política de falha (tentativas/backoff configuráveis por job, falha
permanente inspecionável, observabilidade reaproveitada do doc52) — todos definidos. Nenhuma dependência
foi instalada, nenhum worker/queue/cron/outbox foi criado. `apps/api-v2` não foi criado. `apps/web`,
`apps/api` (legacy), banco e deployment não foram alterados. Nenhuma parte já fechada da stack foi
reavaliada. Nenhum documento anterior foi modificado.
