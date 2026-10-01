> Historical record. Kept as recorded; not the current contract.

# 61 — Decisão Final: Modelo de Deployment da `apps/api-v2`

Definição read-only de onde e como a futura `apps/api-v2` roda em produção, reavaliando genuinamente as 3 opções pedidas sem herdar automaticamente o modelo dual do legacy. Stack já fechada (Node 24, NestJS 11.1.28, Express 5.2.1, Drizzle, PostgreSQL 17/Supabase — docs 58/59/60) não reaberta. Nenhum Dockerfile/config Vercel/nginx/workflow foi criado ou alterado, nenhum worker/queue foi criado, nenhuma dependência foi instalada. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e infraestrutura não foram alterados.

## Estado atual (contexto, não herdado automaticamente)

```text
Backend legacy: Docker/long-running + Vercel/serverless (dual, doc42/43)
Frontend: nginx / conteúdo estático
Regra desta etapa: a API v2 NÃO herda os dois modelos automaticamente — a decisão é reavaliada do zero.
```

---

## Verificação externa (fontes oficiais)

```text
Vercel — vercel.com/docs/functions/runtimes (limites de execução) e vercel.com/changelog (Node 20
  deprecation, já citado no doc60): funções serverless na Vercel têm um limite máximo de duração de
  execução por invocação (variável por plano, mas sempre finito, na casa de segundos a poucos minutos,
  nunca "indefinido") — confirma estruturalmente que a plataforma não é desenhada para processos que
  precisam sobreviver além do ciclo de vida de uma única requisição HTTP.
NestJS — docs.nestjs.com (Application shutdown / lifecycle events): NestJS expõe hooks nativos de
  graceful shutdown (enableShutdownHooks(), OnApplicationShutdown) desenhados para um processo Node
  persistente que recebe um sinal do sistema operacional (SIGTERM) — mecanismo sem equivalente útil
  numa function serverless, cujo ciclo de vida é controlado pela plataforma, não pelo processo em si.
Supabase — supabase.com/docs (Connection pooling / Supavisor): o pooler gerenciado do Supabase oferece
  2 modos — "session" (conexão dedicada por cliente, mais previsível para transações multi-statement) e
  "transaction" (conexão reciclada por transação, desenhado especificamente para cenários de muitas
  conexões efêmeras e curtas, como serverless) — a própria documentação distingue os 2 modos por esse
  motivo, base direta da seção Database Connections abaixo.
Drizzle — orm.drizzle.team (Postgres connection docs): Drizzle documenta explicitamente que drivers
  baseados em pool persistente (node-postgres Pool) são adequados a ambientes long-running, enquanto
  ambientes serverless tipicamente exigem um driver/estratégia adaptada a conexões de vida curta —
  confirma que a escolha de deployment tem impacto direto e documentado na forma de conectar ao banco.
```

---

## A — LONG_RUNNING_CONTAINER

```text
Connection pooling: pool Drizzle/pg estabelecido UMA VEZ no boot do processo, reutilizado por toda a
  vida do container — sem overhead de reconexão por requisição.

Startup: sequência única — configuração validada uma vez (doc53, fail-fast), pool de conexão
  inicializado uma vez, health checks ativos após inicialização completa.

Health/readiness: encaixe natural — liveness (processo vivo, sem checar dependência) e readiness
  (banco alcançável) exatamente como já desenhado conceitualmente no doc52 (não reaberto, só confirmado
  compatível) — um processo persistente é o modelo que probes de liveness/readiness de orquestração de
  container pressupõem por design.

Graceful shutdown: suportado nativamente — NestJS expõe hooks para reagir a SIGTERM, drenar requisições
  em andamento, fechar o pool de conexão de forma limpa antes de encerrar.

Background jobs / queues / cron: suportado — um processo persistente pode hospedar um consumidor de
  fila continuamente (long-polling), sem o requisito artificial de reempacotar cada unidade de trabalho
  como uma invocação HTTP isolada.

Observabilidade: métricas pull-based (ex.: endpoint /metrics estilo Prometheus, já usado no legacy,
  doc52/54) pressupõem um processo estável para ser raspado periodicamente — encaixe direto.

WebSockets: NÃO USADO COMO ARGUMENTO (Supabase Realtime permanece separado, instrução explícita desta
  etapa) — irrelevante para a decisão.

Uploads: idêntico em qualquer modelo — via URL pré-assinada (padrão já estabelecido, doc48/53), o
  processo da API nunca recebe o arquivo em si.

Integrações externas: sem restrição — chamadas HTTP de saída a partir de um processo persistente, sem
  limite de tempo total de execução por request além do que a própria integração impuser.

Escalabilidade horizontal: réplicas de container atrás de um balanceador — padrão maduro e conhecido,
  sem exigir escolha de provedor nesta etapa (proibido pelo prompt).

Deployment operacional: exige gestão de infraestrutura de container (não decidida aqui — provedor fica
  em aberto) — é o único custo real deste modelo frente à alternativa serverless.
```

---

## B — VERCEL SERVERLESS

```text
Cold start: real, mitigável (padrão de cache de app entre invocações "warm" já usado no legacy,
  doc42/43) mas não eliminável — adiciona variância de latência.

Lifecycle efêmero: cada invocação pode rodar num container novo ou reaproveitado, SEM garantia de
  persistência entre invocações — incompatível por definição com um consumidor de fila que precisa
  ficar continuamente escutando/processando além do ciclo de uma única requisição.

Conexão PostgreSQL: exige estratégia de pooling amigável a muitas conexões curtas/efêmeras
  (Supavisor modo "transaction", já usado pelo legacy — doc42/45) — funcional, mas uma restrição
  adicional que o modelo long-running não precisa carregar.

Pooling: dependente de um pooler externo gerenciado (não pode confiar em manter um pool próprio de
  longa duração dentro do processo, dado o lifecycle efêmero).

Timeout: limite de duração de execução por invocação, confirmado na documentação oficial da Vercel
  (verificação externa acima) — restrição direta e real contra o requisito explícito desta etapa de
  "operações potencialmente demoradas".

Jobs / queues: NÃO suportado de forma nativa e contínua — o próprio legacy já demonstra essa limitação
  (BullMQ explicitamente desabilitado em modo serverless, doc42/51/54, comentário do próprio código-
  fonte). Um consumidor de fila real exigiria, na prática, um processo persistente à parte — ou seja,
  "Vercel serverless" isoladamente NÃO é uma resposta completa aos requisitos desta etapa, precisaria
  de um segundo runtime de qualquer forma.

Cron: Vercel Cron cobre bem tarefas agendadas CURTAS (disparo HTTP pontual, já usado pelo legacy para
  isso) — não cobre processamento contínuo/long-polling.

Processamento longo: mau encaixe, risco direto de timeout.

Uploads: idêntico ao modelo A (URL pré-assinada).

Observabilidade: métricas pull-based tradicionais (prom-client /metrics) não funcionam bem contra um
  processo que pode ser reciclado a qualquer momento entre raspagens — exigiria uma estratégia
  push-based ou um serviço de métricas hospedado, complexidade adicional não presente no modelo A.

Compatibilidade com Node.js 24: CONFIRMADA (doc60 — Vercel já suporta e recomenda Node 24 hoje).

Limitações reais atuais da plataforma: timeout de execução por invocação + lifecycle efêmero são as 2
  restrições estruturais, verificadas em documentação oficial, mais relevantes frente aos requisitos
  desta etapa (jobs/queues/cron contínuo/processamento longo).
```

---

## C — DUAL TARGET

```text
Avaliação honesta: para o modelo dual ser justificado, Docker e Vercel precisariam ter
  responsabilidades CLARAMENTE distintas — não é o caso nem no legacy (onde ambos executam exatamente a
  mesma API, com o modo serverless apenas desabilitando partes dela — BullMQ/filas — por limitação
  estrutural, não por design deliberado de separação de responsabilidade) nem haveria motivo novo para
  ser diferente na v2.

Custo real de manter os 2 lifecycles simultâneos para a v2:
- 2 modelos de conexão a banco (pool persistente vs. pooler transaction-mode) precisando ser mantidos
  e testados em paralelo
- 2 perfis de timeout (sem limite prático vs. limite de execução da Vercel) que o código precisaria
  respeitar simultaneamente, complicando qualquer decisão de "isso pode ser síncrono no request?"
- 2 comportamentos de shutdown (graceful real vs. nenhum conceito equivalente)
- observabilidade duplicada (pull-based funcionando só num dos dois, exigindo uma segunda estratégia
  para o outro)
- configuração duplicada (2 conjuntos de env vars/flags específicas de ambiente, doc53)
- risco real de bugs específicos por ambiente (o próprio legacy já precisa de comentários explícitos no
  código para lembrar "isto não roda em serverless", doc42/43 — fonte de erro recorrente, não
  hipotética)
- carga de teste adicional (qualquer funcionalidade nova precisaria ser validada nos 2 modos)

CONCLUSÃO: nenhuma responsabilidade distinta e genuína foi encontrada para justificar DUAL_TARGET na
  v2 — é exatamente o caso que o próprio prompt já qualifica como "opção injustificada" ("se ambos
  executarem exatamente a mesma API sem necessidade técnica distinta"). Rejeitado.
```

---

## Decisão

```text
SELECTED:
LONG_RUNNING_CONTAINER

PRIMARY_RUNTIME:
LONG_RUNNING_CONTAINER

WHY:
Os requisitos explícitos desta etapa (jobs, queues, cron contínuo, processamento assíncrono, webhook
processing, operações potencialmente demoradas) são estruturalmente incompatíveis com o lifecycle
efêmero e o timeout de execução por invocação da Vercel Serverless, confirmados em documentação oficial
(seção Verificação Externa) — o próprio legacy já demonstra essa incompatibilidade de forma concreta
(BullMQ desabilitado em modo serverless). Escolher Vercel Serverless como único modelo obrigaria, na
prática, a introduzir um SEGUNDO runtime só para as responsabilidades de background processing — o que
tornaria "serverless-only" uma resposta incompleta, não uma alternativa real ao container. O modelo
long-running, por outro lado, cobre nativamente TODOS os requisitos listados (HTTP síncrono, jobs,
queues, cron, webhooks, processamento longo) num único runtime coerente, com conexão de banco mais
simples e previsível para o padrão de transação já definido nos docs 45/47/51 (SET LOCAL de RLS combina
melhor com um pool de conexão estável do que com pooling transaction-mode agressivo).

REJECTED:
VERCEL_SERVERLESS — rejeitado porque não cobre, sozinho, os requisitos de background processing/jobs/
  queues/processamento longo explicitamente listados nesta etapa (limitação estrutural confirmada em
  documentação oficial, não apenas teórica); adotá-lo exigiria um segundo runtime de qualquer forma,
  o que já o descarta como resposta única e suficiente.
DUAL_TARGET — rejeitado por ausência de responsabilidade tecnicamente distinta entre os 2 alvos (seção
  C acima) — mantê-lo duplicaria custo operacional (2 lifecycles, 2 modelos de conexão, 2 perfis de
  timeout, 2 estratégias de observabilidade, configuração duplicada, risco de bug específico por
  ambiente) sem nenhum requisito desta etapa que só a Vercel pudesse atender e o container não.

CHANGE_FROM_CURRENT_BACKEND_DEPLOYMENT:
SIM — o legacy roda em ambos os modelos (Docker + Vercel); a apps/api-v2 roda apenas em modelo
  long-running/container. Isso não altera o deployment do legacy em si (não reaberto, não alterado).
```

---

## Long-running — esclarecimentos obrigatórios

```text
VERCEL_API_V2_RUNTIME:
NÃO

CONTAINERIZED:
SIM

GRACEFUL_SHUTDOWN_REQUIRED:
SIM

HEALTH_READINESS_SUPPORTED:
SIM

BACKGROUND_WORKERS_SUPPORTED:
SIM
```

Nenhum provedor de container/hosting foi escolhido nesta etapa (proibido pelo prompt) — apenas o
modelo de execução (long-running/containerizado) foi decidido.

---

## Database Connections

```text
DATABASE_CONNECTION_MODEL:
Conexão de runtime única e persistente por processo — o pool Drizzle/pg é criado uma vez no boot do
  container e reutilizado por toda a vida útil do processo, fechado de forma limpa no graceful
  shutdown. Distinta e nunca compartilhada com a conexão de migration.

POOLING_MODEL:
Pool nativo do driver (pg Pool, dimensionado por réplica de container, tamanho moderado e fixo),
  opcionalmente atrás do pooler gerenciado do Supabase (Supavisor) em modo SESSION — não modo
  "transaction" — porque o modelo long-running não tem a mesma pressão de conexões efêmeras que
  justificaria o modo transaction (esse modo é otimizado especificamente para o cenário
  serverless/muitas conexões curtas, conforme a própria documentação do Supabase distingue, seção
  Verificação Externa) — e porque o padrão de transação já definido no doc51 (SET LOCAL para RLS,
  possivelmente multi-statement dentro de uma mesma transação de negócio) é mais previsível em modo
  session do que sob as restrições de prepared statement/transaction-scoping do modo transaction.

runtime connection vs. migration direct connection:
Mantidas como 2 valores de configuração distintos, exatamente como já fixado no doc46 (não reaberto) —
  a conexão de runtime (pooled, seção acima) nunca é usada para aplicar migrations; a conexão direta/
  sem pooler (DIRECT_DATABASE_URL, já convenção existente no projeto) é usada exclusivamente pela
  ferramenta de migration (Drizzle Kit, doc46), num passo de deploy explícito e separado da execução
  normal do processo da API — o modelo long-running não introduz nenhuma mudança nessa separação já
  aprovada, apenas confirma que ela se encaixa sem atrito.
```

---

## Background Processing

```text
O modelo long-running/containerizado permite, futuramente, sem obrigar o processo HTTP a executar tudo
de forma síncrona:
- workers: processo(s) adicional(is) compartilhando a mesma base de código, rodando continuamente
- queues: consumidor de fila com long-polling real, sem necessidade de reempacotar cada job como uma
  invocação HTTP
- scheduled jobs: agendamento in-process (biblioteca a decidir em etapa futura) ou externo, ambos
  viáveis num processo persistente
- webhook processing: recepção síncrona via HTTP + processamento assíncrono desacoplado (padrão outbox
  já definido no doc51, sem obrigar a resposta HTTP do webhook a esperar o processamento completo)
- outbox consumers: processo de leitura contínua da tabela de outbox (doc51), natural num modelo
  long-running, estruturalmente incompatível com lifecycle efêmero

Nenhum worker/queue foi criado nesta etapa (proibido pelo prompt) — apenas confirmado que o modelo
escolhido não impede nenhuma dessas necessidades futuras.
```

---

## Resumo

```text
UNRESOLVED_DEPLOYMENT_DECISIONS:
0
```

## Cobertura

As 3 opções (LONG_RUNNING_CONTAINER, VERCEL_SERVERLESS, DUAL_TARGET) foram avaliadas com evidência de
documentação oficial (Vercel, NestJS, Supabase, Drizzle) para os pontos pedidos em cada uma. DUAL_TARGET
foi rejeitado com justificativa concreta de ausência de responsabilidade distinta, não por default.
Modelo de conexão de banco e pooling definidos especificamente para Drizzle+PostgreSQL/Supabase no
modelo escolhido, sem alterar a separação runtime/migration já aprovada no doc46. Background processing
confirmado como suportado sem forçar tudo pelo processo HTTP. Nenhum Dockerfile/config Vercel/nginx/
workflow foi criado ou alterado. Nenhum worker/queue foi criado. Nenhuma dependência foi instalada.
`apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e infraestrutura não foram alterados.
Node.js, NestJS e Drizzle não foram reavaliados. Nenhum documento anterior foi modificado.
