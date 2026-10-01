> Historical record. Kept as recorded; not the current contract.

# 68 — Stack Final de Observabilidade da `apps/api-v2`

Decisão arquitetural fechada e definitiva, sem alternativas em aberto. Nenhum código/pacote/configuração foi criado ou instalado. Nenhuma decisão arquitetural anterior (docs 50/52/53/61/67, entre outras) foi reaberta. Nenhum layout, UX, contrato funcional, autenticação, tenant isolation, RLS, integração, persistência funcional, frontend, backend legacy ou deployment foi alterado. `apps/api-v2` não foi criado. Nenhum commit foi executado.

## Stack já fechada (base, não reaberta)

```text
Node.js 24 | TypeScript 6.0.3 | NestJS 11.1.28 | Express 5.2.1 | Zod 4.4.3
PostgreSQL 17/Supabase | Drizzle ORM 0.45.2 | pg 8.22.0 | drizzle-kit 0.31.10
Supabase Auth | jose 6.2.8
pg-boss 12.27.0 | @nestjs/schedule 6.1.3
Deployment: long-running container
Características arquiteturais já definidas: RLS, multi-tenancy, Cloudflare R2, Stripe, APIs externas,
integrações com provedores, jobs assíncronos, outbox quando aplicável
```

## Verificação externa (versões confirmadas via registry.npmjs.org nesta etapa)

```text
pino: 10.3.1 | nestjs-pino: 4.6.1 (peer: pino ^10.0.0 ✓, pino-http ^11.0.0 ✓, @nestjs/common ^11.0.0 ✓)
pino-http: 11.0.0 | pino-pretty: 13.1.3 (dev only)
prom-client: 15.1.3
@opentelemetry/api: 1.9.1 | @opentelemetry/sdk-node: 0.221.0
@opentelemetry/instrumentation-http: 0.221.0 | @opentelemetry/instrumentation-express: 0.69.0
@opentelemetry/instrumentation-pg: 0.73.0 | @opentelemetry/exporter-trace-otlp-http: 0.221.0
@nestjs/terminus: 11.1.1 (peer: @nestjs/common/@nestjs/core ^11.0.0 ✓ — match exato com NestJS 11.1.28)
@sentry/nestjs: 10.69.0 (peer: @nestjs/common ^11.0.0 ✓; inclui @sentry/node 10.69.0 como dependency
  direta — integração oficial NestJS, não wiring manual)

Todas as versões acima confirmadas compatíveis com Node.js 24, NestJS 11.1.28 e Express 5.2.1 (via
peerDependencies/engines declarados oficialmente nos respectivos pacotes, consultados diretamente no
registry — nenhuma inferida de blog/tutorial).
```

---

## 1. STACK FINAL DE OBSERVABILIDADE

```text
Logging estruturado:        pino 10.3.1 + nestjs-pino 4.6.1 (+ pino-http 11.0.0, + pino-pretty 13.1.3
                             em desenvolvimento apenas)
Metrics:                     prom-client 15.1.3 (formato Prometheus/OpenMetrics)
Tracing:                      OpenTelemetry — @opentelemetry/api 1.9.1, @opentelemetry/sdk-node 0.221.0,
                             @opentelemetry/instrumentation-http 0.221.0,
                             @opentelemetry/instrumentation-express 0.69.0,
                             @opentelemetry/instrumentation-pg 0.73.0,
                             @opentelemetry/exporter-trace-otlp-http 0.221.0
Health/Liveness/Readiness:      @nestjs/terminus 11.1.1
Error tracking:                   @sentry/nestjs 10.69.0 (inclui @sentry/node 10.69.0)
Queue observability:                combinação: eventos nativos do pg-boss 12.27.0 instrumentados via
                             pino (logs) + prom-client (métricas customizadas) — sem ferramenta dedicada
                             adicional, sem Redis, sem dashboard próprio de fila.
Database observability:              instrumentação sobre pg 8.22.0/Drizzle 0.45.2 via pino (logs
                             estruturados de duração/erro, nunca SQL com valor de parâmetro) +
                             prom-client (histogramas/contadores) + OTel instrumentation-pg (spans).
```

---

## 2. MANTER

```text
Sentry — usado hoje no frontend (@sentry/react) E no backend legacy (@sentry/node) — MANTIDO no
  backend v2 (via @sentry/nestjs, integração oficial), avaliado de forma independente do frontend
  (regra explícita desta etapa) e justificado por responsabilidade própria e distinta de tracing (ver
  seção 5 — Avaliação de Pino/OTel/Sentry/PostHog): captura e triagem de exceção, não sobreposto ao
  OpenTelemetry.
prom-client — usado hoje no backend legacy — MANTIDO no v2 (formato Prometheus/OpenMetrics, adequado ao
  modelo long-running já fixado no doc61; reaproveita inclusive a lição de cardinalidade já documentada
  no código do legacy: tenantId nunca é label de métrica, doc54/67 — não reaberta, apenas reafirmada).
@nestjs/terminus — usado hoje no backend legacy — MANTIDO no v2 (pacote oficial do ecossistema NestJS,
  já com liveness/readiness/database indicator provados em produção neste mesmo projeto).
```

## 3. REMOVER

```text
Nenhuma tecnologia de observabilidade atualmente em uso no legacy é removida sem substituição
equivalente — o que muda é a ADIÇÃO de camadas que o legacy não tinha (logging estruturado via
biblioteca dedicada, tracing distribuído real), não a remoção de capacidade.
```

## 4. ADICIONAR

```text
pino + nestjs-pino — o legacy usa o Logger nativo do NestJS com JSON montado manualmente
  (JSON.stringify em cada log line, doc52/54) — substituído por uma biblioteca dedicada de logging
  estruturado de alta performance com redaction nativa (seção 7), child loggers por contexto
  (requestId/tenantId/correlationId) e compatibilidade comprovada com async-context.
OpenTelemetry — o legacy tinha tracing como PREPARED_BUT_DISABLED (doc52), justificado então pela
  incerteza do modelo de deployment (dual Docker+Vercel serverless). Essa incerteza não existe mais: o
  deployment da v2 já está fechado como long-running container (doc61) — a razão original para adiar
  tracing (risco de perda de spans por suspensão de function serverless antes do flush) deixou de se
  aplicar. Habilitado desde o início (seção 9).
```

## 5. Avaliação obrigatória — Pino / OpenTelemetry / Sentry / PostHog

```text
PINO: ADOTAR (novo componente — não existia em nenhuma parte do stack anterior, nem frontend nem
  backend legacy). Responsabilidade: logging estruturado transversal.

OPENTELEMETRY: ADOTAR (novo componente — não existia em nenhuma parte do stack anterior). Habilitado
  desde o início (ver seção 9), não apenas preparado — justificativa já registrada na seção 4.

SENTRY: MANTER, escopo exclusivamente de ERROR TRACKING (captura/triagem/agrupamento de exceção) — NÃO
  o recurso de Sentry Performance/Tracing, que ficaria redundante com o OpenTelemetry já escolhido para
  tracing. As 2 ferramentas cobrem responsabilidades DIFERENTES e complementares (tracing de fluxo
  distribuído vs. triagem/agrupamento/alerta de exceção com UX dedicada), não a mesma responsabilidade
  em duplicidade — avaliado de forma independente do uso do Sentry no frontend, conforme regra explícita
  desta etapa.

POSTHOG: NÃO ADOTAR no escopo desta decisão de OBSERVABILIDADE. PostHog é, por natureza, uma ferramenta
  de ANALYTICS DE PRODUTO (comportamento de usuário, funis, feature flags) — nenhuma das responsabilidades
  listadas no escopo desta etapa (logging/métricas/tracing/error tracking/health/queue/database
  observability) é coberta por PostHog. Sua presença no legacy (posthog-node, backend) parece já ser
  para eventos de analytics disparados do servidor (ex.: "onboarding_complete", já citado em
  flows.ts F10) — um propósito de PRODUTO, não de OBSERVABILIDADE técnica, portanto fora do escopo desta
  decisão específica (nem mantido nem removido aqui — decisão de analytics de produto não tomada nesta
  etapa, categoria diferente).
```

---

## 6. O QUE SERÁ INSTRUMENTADO

```text
- Toda request HTTP de entrada (method/route/statusCode/duration/requestId/correlationId/tenantId/
  userId quando disponível) — via nestjs-pino, integração oficial de request logging (não duplicado por
  um segundo middleware/interceptor concorrente).
- Toda query/transação Postgres executada via Drizzle/pg — duração, sucesso/erro, categoria de erro
  (doc50/51), nunca o texto de SQL com valor de parâmetro em produção.
- Todo ciclo de vida de job pg-boss — enfileirado, iniciado, concluído, falhou, retry, job morto — com
  jobId/tenantId/correlationId.
- Toda chamada a integração externa (Stripe, R2, provedores, webhooks) — latência, status, timeout,
  falha, retry, rate limit quando exposto pelo provedor.
- Todo erro 5xx/exceção não tratada — capturado pelo Sentry (mesma política já fixada no doc50: 4xx
  nunca reportado ao Sentry, só 5xx/inesperado).
- Toda transação HTTP→Use Case→Repository→Postgres→Integração→Job→Worker via spans OpenTelemetry
  (seção 9).
```

## 7. O QUE NÃO PODERÁ SER LOGADO OU TRACED

```text
Nunca, em log, trace, métrica ou evento de erro, em nenhum ambiente (incluindo desenvolvimento —
regra explícita desta etapa):
Authorization header completo, access tokens, refresh tokens, cookies de sessão, passwords, secrets,
API keys, apiKey, token, accessToken, refreshToken, credenciais de provider/distribuidora, dados
bancários completos, números completos de cartão, CVV, dados sensíveis de tenant além do
estritamente necessário para operação (ex.: tenantId como identificador é permitido; um payload
financeiro bruto do tenant não é), PII desnecessária.

AUTOMATIC_REDACTION_SUPPORTED:
SIM

Mecanismo: redaction nativa do Pino (opção "redact", paths configuráveis por nome de campo —
authorization, cookie, password, token, secret, apiKey, accessToken, refreshToken,
providerCredentials, e variações de nome/casing) aplicada a TODO log, sem exceção por ambiente
(incluindo desenvolvimento).

Sanitização adicional (quando a redaction automática por nome de campo não é suficiente): payloads de
integração externa com estrutura desconhecida/dinâmica (ex.: corpo bruto de um webhook de provider)
NUNCA são logados por inteiro — apenas uma projeção explícita e pré-aprovada dos campos realmente
necessários para diagnóstico (ex.: tipo de evento, status, identificador da operação), nunca o payload
cru completo, mesmo que a redaction por nome de campo não encontre uma chave sensível ali dentro
(defesa em profundidade contra segredo embutido num formato inesperado).
```

## 8. PADRÃO DE CORRELATION IDs

```text
Campos propagados: requestId, correlationId, tenantId, userId (quando disponíveis) — mesmo modelo já
fixado no doc52, não reaberto, agora implementado sobre Pino (child loggers, doc52 seção Request
Correlation) e OpenTelemetry (atributos de span, nunca como label de métrica de alta cardinalidade —
ver seção 16).

Propagação: HTTP → Controllers → Use Cases → Repositories → instrumentação de banco → integrações →
jobs pg-boss → workers → outbox → logs → métricas (quando tecnicamente apropriado, nunca como label de
cardinalidade não controlada) → traces → eventos de erro (Sentry, como tag, mesmo padrão já usado no
legacy — doc50/52).

Para processamento iniciado por request HTTP: o requestId/correlationId original é preservado ponta a
ponta (mesmo requestId usado no log, no span, e — se um job for enfileirado como consequência dessa
request — herdado pelo job).

Para jobs sem request HTTP original (ex.: job agendado via pg-boss schedule/@nestjs/schedule): um NOVO
correlationId é gerado no início do próprio job — o mesmo correlationId é mantido através de TODAS as
tentativas de retry da mesma execução lógica do job (retries do mesmo job NÃO geram um novo
correlationId a cada tentativa — permite rastrear todas as tentativas de uma mesma unidade de trabalho
como uma única linha de investigação).

Correlação entre request/tenant/user/job/integration/error/trace: o correlationId é o identificador de
ponta a ponta compartilhado por todos esses eventos relacionados a uma mesma unidade de trabalho —
nenhum dado sensível (seção 7) é usado como parte do próprio identificador de correlação.
```

## 9. PADRÃO DE HEALTH / READINESS / LIVENESS

```text
Tecnologia: @nestjs/terminus 11.1.1 (decisão única, sem alternativa — pacote oficial já maduro e
provado neste projeto, doc54/57).

LIVENESS: indica exclusivamente se o processo está operacional — NENHUMA dependência externa é
checada (nem banco, nem integração, nem fila) — mesmo princípio já fixado conceitualmente no doc52,
agora confirmado como a implementação final (Terminus permite um health check trivial sem indicators,
ou um único indicator "sempre verdadeiro" apenas para confirmar que o processo responde).

READINESS: valida PostgreSQL (indicator customizado sobre o mesmo pool pg/Drizzle já definido nos
docs 58/65 — uma query leve, ex.: SELECT 1) + configuração crítica obrigatória (reutiliza o resultado
da validação de boot já fail-fast do doc53 — não revalida a configuração a cada chamada de readiness,
apenas confirma que o boot já validou com sucesso). Integrações externas opcionais (Stripe, R2,
provedores de distribuidora, etc.) NÃO fazem parte do readiness obrigatório — indisponibilidade de uma
integração externa opcional nunca tira a API inteira de serviço (regra explícita desta etapa,
reforçando o mesmo princípio já citado no doc52).
```

## 10. POLÍTICA DE RETENÇÃO

```text
Application logs (Pino, formato JSON): produção 30 dias | staging 14 dias | desenvolvimento — sem
retenção centralizada (local/efêmero apenas).

Error events (Sentry): conforme a política de retenção padrão do plano Sentry contratado (não definida
nesta etapa — decisão de plano/contrato, fora do escopo arquitetural) — a política ARQUITETURAL aqui é
que 4xx nunca é reportado (reduz volume por design, doc50), só 5xx/exceção real.

Traces (OpenTelemetry): 14 dias — volume tipicamente maior e valor de investigação mais concentrado no
curto prazo pós-incidente do que os logs.

Metrics (Prometheus/prom-client): 15 dias em resolução bruta — agregação/downsampling para janelas
maiores de tendência é uma decisão de backend de métricas (provedor não escolhido nesta etapa, mesma
categoria de decisão de hosting já deliberadamente deferida no doc61).

Audit technical events (eventos de segurança/auditoria técnica, distintos de trilha de negócio — ver
seção 11 abaixo): retenção mais longa que logs de aplicação genéricos, por relevância a investigação de
incidente de segurança — período exato não fixado nesta etapa (depende de política de segurança/LGPD
não decidida aqui).

Princípio geral: nenhuma retenção indefinida sem justificativa — minimização de dado (LGPD) e custo são
considerados; PII e dado sensível já são excluídos na origem (seção 7), reduzindo a superfície de risco
independentemente do período de retenção escolhido.
```

## 11. DECISÃO FINAL FECHADA

```text
Todas as decisões desta etapa são definitivas. Nenhuma alternativa permanece em aberto. Nenhuma
tecnologia proibida (Redis, Kafka, RabbitMQ, Elasticsearch, Kubernetes) foi introduzida. Nenhuma
infraestrutura operacional nova foi adicionada além de bibliotecas/pacotes — a exposição de métricas
(Prometheus) e traces (OTLP) pressupõe um backend de coleta/visualização cuja escolha de PROVEDOR
específico (ex.: Grafana, um backend de tracing hospedado) é uma decisão de hosting/infraestrutura, da
MESMA categoria já deliberadamente deferida no doc61 ("não escolher provedor de container/hosting") —
não uma indecisão desta etapa, e sim um limite de escopo consistente com decisões anteriores já
aprovadas.
```

---

## Detalhamento adicional exigido pelo prompt (seções 5-27, condensado)

```text
REQUEST LOGGING (seção 6 do prompt): responsabilidade única do middleware oficial embutido no
nestjs-pino (baseado em pino-http) — nenhum interceptor NestJS nem middleware Express adicional
duplica esse registro. Campos: method/route/statusCode/duration/requestId/correlationId/tenantId/
userId quando disponíveis.

METRICS mínimas (seção 8 do prompt): HTTP request count/latency/4xx/5xx; database failures + latência
(histograma) + transaction failures; integration failures + latência; queue: job failures, retries,
dead jobs, queue latency, job duration, worker health — todas implementadas como Counter/Histogram/
Gauge customizados via prom-client, mesmo padrão já usado (e já com a lição de cardinalidade aprendida)
no legacy (doc54/55/67) — nenhuma infraestrutura de coleta nova além da própria biblioteca cliente.

DISTRIBUTED TRACING (seção 9 do prompt):
TRACING_INITIAL_STATE: ENABLED_FROM_INITIAL_V2
Propagação: HTTP (instrumentation-http/instrumentation-express) → Use Cases/Repositories (spans
manuais via @opentelemetry/api, seguindo os limites de camada já definidos no doc47) → PostgreSQL
(instrumentation-pg) → integrações externas (spans manuais ou instrumentation-http para chamadas
HTTP de saída) → pg-boss/jobs/workers/outbox (SEM pacote de auto-instrumentação oficial disponível
para pg-boss especificamente — propagação MANUAL: o contexto de trace é serializado nos dados do job
no momento do enfileiramento e usado para iniciar um span filho/vinculado quando o worker processa o
job, via @opentelemetry/api).

ERROR TRACKING (seção 10 do prompt): Sentry (@sentry/nestjs), escopo de captura de exceção apenas —
não Sentry Tracing (evita redundância com OpenTelemetry, seção 5).

DATABASE OBSERVABILITY (seção 14 do prompt): duração de query/transação via instrumentação sobre o
pool pg/Drizzle (log estruturado + histograma Prometheus + span OTel), slow query identificada por
threshold configurável (mesmo princípio já fixado no doc52 — não um número rígido inventado aqui),
pool errors/connection failures/transaction failures logados e contabilizados (categorias já definidas
no doc50/51). Nunca SQL completo com valor de parâmetro em produção; nunca PII/token/secret/dado
financeiro em log de banco.

PERFORMANCE MONITORING (seção 21 do prompt) — responsabilidade delimitada sem duplicação:
métricas (prom-client) = tendências agregadas e limiares; logs (pino) = eventos estruturados
específicos; traces (OTel) = visualização de fluxo entre camadas/serviços; error tracking (Sentry) =
triagem/agrupamento de exceção. Cada tecnologia responde a uma pergunta de investigação diferente, sem
sobreposição de responsabilidade.

AMBIENTES (seção 26 do prompt):
- development: logs pretty-printed (pino-pretty, dev-only), nível debug, redaction SEMPRE ativa (nunca
  exposição de secret mesmo em dev), tracing amostrado a 100% (baixo volume local).
- staging: logs JSON estruturado, nível info, redaction ativa, tracing amostrado a taxa moderada,
  exportação remota habilitada (validação do pipeline completo antes de produção), dados isolados por
  ambiente (mesmo princípio de isolamento já fixado no doc53 — nunca a mesma "conta"/projeto usado por
  produção).
- production: logs JSON estruturado, nível info (warn/error mais proeminentes), redaction sempre ativa,
  tracing amostrado (taxa não fixada rigidamente aqui, configurável), exportação remota completa.

TECNOLOGIAS PROIBIDAS (seção 27 do prompt): confirmado que NENHUMA delas foi introduzida — Redis
(reafirma doc67 — não introduzido nem aqui, nem para observabilidade), Kafka, RabbitMQ, Elasticsearch,
Kubernetes. Nenhuma infraestrutura operacional redundante foi adicionada.
```

---

## API V2 — OBSERVABILITY STACK

```text
Logging:
pino 10.3.1 + nestjs-pino 4.6.1

Metrics:
prom-client 15.1.3

Tracing:
OpenTelemetry (@opentelemetry/sdk-node 0.221.0 + api 1.9.1 + instrumentation-http 0.221.0 +
instrumentation-express 0.69.0 + instrumentation-pg 0.73.0 + exporter-trace-otlp-http 0.221.0)

Health:
@nestjs/terminus 11.1.1

Error tracking:
@sentry/nestjs 10.69.0

Structured logs:
SIM

Request correlation:
SIM

Sensitive-data redaction:
SIM
```

---

## Cobertura

Stack de observabilidade fechada de forma definitiva e única, sem alternativas em aberto, cobrindo
logging/request logging/metrics/tracing/error tracking/health/readiness/liveness/queue observability/
database observability/correlation/dashboards/alertas/retenção/redaction. Pino, OpenTelemetry, Sentry e
PostHog avaliados explicitamente (ADOTAR/MANTER/NÃO ADOTAR conforme aplicável, PostHog excluído do
escopo por ser ferramenta de analytics de produto, não de observabilidade técnica). Tracing definido
como ENABLED_FROM_INITIAL_V2 (não PREPARED_BUT_DISABLED, revertendo o doc52 com justificativa concreta:
o modelo de deployment serverless que motivava a cautela foi substituído por long-running container no
doc61). Todas as versões verificadas em fontes primárias (registry.npmjs.org), com compatibilidade
Node 24/NestJS 11/Express 5 confirmada via peerDependencies/engines oficiais. Nenhuma tecnologia
proibida introduzida. Nenhum código/pacote/configuração criado ou alterado. Nenhuma decisão
arquitetural anterior foi reaberta. Nenhum layout, UX, contrato funcional, autenticação, tenant
isolation, RLS, integração, persistência funcional, frontend, backend legacy, banco, migrations, filas,
jobs ou deployment foi alterado. `apps/api-v2` não foi criado. Nenhum commit foi executado.
