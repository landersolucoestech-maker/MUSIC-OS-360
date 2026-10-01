> Historical record. Kept as recorded; not the current contract.

# 52 — Estratégia de Observabilidade da `apps/api-v2`

Definição read-only de logging, correlação de requests, métricas e tracing, sobre a arquitetura em camadas já aprovada ([`47`](./47-api-v2-layered-architecture.md)), o RequestContext já aprovado ([`49`](./49-auth-tenant-request-context.md)), o modelo de erros já aprovado ([`50`](./50-api-v2-error-model.md)) e a estratégia de transações já aprovada ([`51`](./51-api-v2-transaction-strategy.md)). Nenhum logger, interceptor, middleware, health endpoint, OpenTelemetry ou métrica foi configurado/instalado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e o deployment não foram alterados.

## Decisões fixas (não reabertas)

```text
requestId/correlationId faz parte do contexto da request (doc49/doc50)
erros precisam ser correlacionáveis (doc50)
tenantId deve permanecer consistente durante a operação (doc49/doc51)
detalhes sensíveis não podem vazar em erros (doc50)
```

## Evidência usada (mecanismo já provado no legacy — mesma lógica de aderência do doc49/50: reaproveitado por não haver exigência técnica que justifique um mecanismo diferente)

```text
apps/api/src/core/middleware/correlation.middleware.ts
  → já resolve exatamente REQUEST_ID_SOURCE/PROPAGATION: lê "traceparent" (W3C Trace Context),
  "x-trace-id", "x-correlation-id" (nesta ordem de prioridade), sanitiza qualquer ID externo via
  regex /^[A-Za-z0-9._:-]{1,128}$/ antes de aceitar, gera UUID se nada válido for recebido, propaga
  via AsyncLocalStorage (CorrelationContext) e ecoa em X-Trace-ID/X-Correlation-ID de resposta.

apps/api/src/core/interceptors/logging.interceptor.ts
  → log estruturado JSON já em produção, exatamente com os campos pedidos por este prompt
  (requestId, correlationId, traceId, tenantId condicional, userId condicional, method, url,
  statusCode, latency_ms) + metadata de serviço (service/env/version); nível derivado do status
  (>=500 error, >=400 warn, resto info) — mesmo critério que esta etapa adota para NÍVEIS.

apps/api/src/modules/health/health.controller.ts
  → já distingue liveness (/health/live, público, sempre "up", sem checar dependência alguma) de
  readiness (/health/ready, público, checa banco) de um health completo protegido (memória+banco) e
  de um estado de circuit breaker de integrações — base direta para a seção Health e Readiness.

apps/api/src/core/metrics/metrics.service.ts
  → prom-client já em uso, com um achado documentado explicitamente no próprio código (comentário
  "METRICS-01"): tenantId NUNCA deve virar label de métrica Prometheus (cardinalidade
  efetivamente ilimitada — 1 série temporal nova por tenant, por métrica, para sempre); a
  granularidade por tenant pertence a logs/traces, não a métricas — decisão direta reaproveitada
  na seção Métricas abaixo.
```

---

## Logging

```text
FORMATO: STRUCTURED_LOGGING (JSON), sem exceção — nenhum log de texto livre não estruturado.

CAMPOS MÍNIMOS (por entrada de log):
- timestamp     (ISO 8601, sempre presente)
- level          (DEBUG|INFO|WARN|ERROR, sempre presente)
- message         (sempre presente — texto curto e fixo por tipo de evento, não interpolado com
                  dado de negócio livre)
- requestId        (sempre presente — todo log emitido durante o ciclo de vida de uma request carrega
                  o mesmo requestId, mesmo em operações sem usuário/tenant)
- tenantId          (presente SOMENTE quando o RequestContext da doc49 já resolveu um tenant — nunca
                  obrigatório; ausente em rotas @Public()/@AuthBootstrap() e em qualquer log emitido
                  antes do TenantGuard resolver o contexto)
- userId             (presente SOMENTE quando há identidade resolvida — mesma condição de tenantId,
                  nunca obrigatório em operação pública)
- module              (qual camada/domínio emitiu o log — ex.: nome do módulo NestJS ou do domínio
                  doc38, para permitir filtrar logs por área do sistema)
- operation            (nome da operação/use case em execução, quando aplicável — nunca obrigatório
                  para logs puramente técnicos de infraestrutura sem operação de negócio associada)
- durationMs             (presente quando o log representa a conclusão de uma unidade de trabalho
                  medível — request HTTP, query, chamada de integração, transação; ausente em logs
                  pontuais/instantâneos, ex.: um aviso de configuração no boot)

Nenhum destes campos é forçado quando não existe um valor real para preenchê-lo — logar um campo
vazio/null propositalmente é pior do que omiti-lo (regra explícita do prompt para userId/tenantId,
generalizada aqui para module/operation/durationMs pela mesma razão técnica).
```

---

## Níveis

```text
DEBUG:
Detalhe de diagnóstico verboso, útil só em desenvolvimento/investigação pontual — desabilitado por
padrão em produção (nível mínimo configurável). Nunca usado para o fluxo normal de uma request.

INFO:
Operação normal concluída com sucesso — o nível PADRÃO da esmagadora maioria dos logs de uma API
saudável (ex.: request HTTP 2xx/3xx concluída, use case executado com sucesso, transação comitada).
Mesmo critério já usado pelo LoggingInterceptor do legacy (statusCode < 400 → info).

WARN:
Condição anômala mas esperada/recuperável, sem indicar falha do sistema em si — ex.: request HTTP 4xx
(erro do cliente, doc50), retry de transação por serialization failure/deadlock (doc51), circuit
breaker de integração externa acionado. Mesmo critério já usado pelo legacy (400 ≤ statusCode < 500 →
warn).

ERROR:
Falha real do sistema, não esperada como parte do fluxo normal — ex.: request HTTP 5xx, exceção não
tratada, falha de infraestrutura (doc50: INTEGRATION_ERROR/INFRASTRUCTURE_ERROR/INTERNAL_ERROR),
esgotamento de retries de transação (doc51). Mesmo critério já usado pelo legacy (statusCode ≥ 500 →
error).

Regra geral: nenhuma operação bem-sucedida e esperada é logada como ERROR — reservado estritamente
para os casos onde algo realmente quebrou ou se comportou fora do esperado pelo próprio design do
sistema.
```

---

## Request Correlation

```text
REQUEST_ID_SOURCE:
Combinação — aceito de um header confiável quando presente e válido (ver validação abaixo), gerado
pela API quando ausente ou inválido. Mesma estratégia de 3 fontes com prioridade decrescente já
provada no legacy: "traceparent" (W3C Trace Context, extrai o trace-id do formato padrão) → "x-trace-id"
→ "x-correlation-id" → gerado (UUID).

REQUEST_ID_HEADER:
"X-Correlation-ID" (aceito na entrada; "X-Trace-ID" e "traceparent" também aceitos como fontes
alternativas do mesmo identificador, conforme prioridade acima).

REQUEST_ID_PROPAGATION:
Resolvido uma única vez, o mais cedo possível (antes de qualquer Guard, na borda HTTP) e propagado
através de todas as camadas via 2 mecanismos complementares: (1) como parte explícita do RequestContext
(doc49, campo correlationId) para Application/Use Case; (2) via contexto assíncrono (equivalente a
AsyncLocalStorage, já provado no legacy via CorrelationContext) para que qualquer código — inclusive
Persistence/Integrations, que não recebem RequestContext diretamente — consiga anexar o mesmo
identificador a um log sem precisar recebê-lo como parâmetro explícito em toda assinatura de função.
Repositories e Integration Adapters incluem o mesmo requestId em qualquer log/métrica que emitirem.

REQUEST_ID_VALIDATION_SANITIZATION (quando aceito do cliente):
Um valor recebido só é aceito se casar com um padrão restrito de caracteres seguros e comprimento
limitado (mesmo padrão já usado no legacy: alfanumérico + ".", "_", ":", "-", 1 a 128 caracteres) — um
valor recebido que não casa com esse padrão é DESCARTADO silenciosamente e um novo ID é gerado; nunca é
refletido de volta ou logado sem essa validação (superfície de injeção de log/log forging evitada).

REQUEST_ID_RESPONSE_HEADER:
SIM — ecoado em toda resposta (sucesso ou erro) via "X-Request-ID"/"X-Correlation-ID"/"X-Trace-ID",
mesmo padrão já usado pelo GlobalExceptionFilter e pela CorrelationMiddleware do legacy (doc50).
```

---

## Tenant e user context

```text
PODEM aparecer em log:
- tenantId (identificador do tenant já resolvido pelo RequestContext — não é segredo, é metadado
  operacional necessário para filtrar/investigar logs por cliente)
- internalUserId (identificador interno do usuário — mesmo raciocínio)
- authUserId (claim "sub" do JWT do Supabase Auth — identificador, não segredo)

NÃO PODEM aparecer em log, em nenhuma circunstância (verbatim do prompt):
JWT (nenhum token de acesso/refresh, mesmo truncado), senha, API secret, provider token, header
Authorization completo.

Regra prática: um log pode dizer QUEM fez a operação (authUserId/internalUserId/tenantId) mas nunca
CARREGAR a credencial que provou essa identidade.
```

---

## HTTP Logging

```text
REGISTRO MÍNIMO POR REQUEST (sempre, sucesso ou erro):
method, route (padrão da rota, não a URL com valores de path param interpolados — ex.: "/contracts/:id",
não "/contracts/8f2a..." — para permitir agregação por rota sem explosão de cardinalidade), statusCode,
durationMs, requestId, tenantId (quando disponível).

REQUEST BODY / RESPONSE BODY:
Política restritiva por padrão — NÃO logados indiscriminadamente. Um payload de request/response pode
conter dado sensível de negócio (dados de contrato, dados financeiros, PII de artista/cliente) que não
tem relação com o propósito de um log operacional. Logging de corpo completo só é aceitável de forma
EXPLÍCITA e OPT-IN por rota/operação específica (nunca um padrão global "logar tudo"), aplicando a
mesma REDACTION definida abaixo antes de qualquer registro, e reservado a cenários de depuração
pontual, nunca como comportamento padrão de produção.
```

---

## Database

```text
QUERY DURATION:
Medida por query (ou por transação, conforme doc51), registrada como métrica (ver Métricas) e incluída
como durationMs em log quando a query/transação for o assunto do log (ex.: aviso de slow query).

SLOW QUERIES:
Uma query cuja duração excede um limiar é logada como WARN (não ERROR — é uma condição de performance
a investigar, não uma falha) com contexto técnico (nome da tabela/operação, requestId, tenantId), mas
sem o texto completo da query quando ela contiver valores de parâmetro potencialmente sensíveis (ver
regra de SQL abaixo).

TRANSACTION FAILURES / DEADLOCKS:
Correlacionados com a política já definida no doc51 — serialization_failure/deadlock_detected retentado
automaticamente (até 3 vezes) é logado como WARN a cada tentativa (condição recuperável); se esgotar as
tentativas, vira ERROR (mapeado para INFRASTRUCTURE_ERROR no modelo de erro do doc50).

CONNECTION POOL ERRORS:
Logados como ERROR (falha de infraestrutura, não do cliente) — nunca incluem a connection string real,
só metadados operacionais (nome do pool, contagem de conexões ativas/máximas no momento da falha).

SQL EM PRODUÇÃO:
Por padrão, NÃO é logado o texto completo de SQL contendo valores de parâmetro em produção (risco de
vazar dado sensível de negócio via log) — quando um log de banco precisa de contexto de qual operação
falhou, usa uma descrição estruturada (tabela, tipo de operação, nome da query/repository method), não
o SQL literal com valores. Habilitar SQL bruto é, na melhor das hipóteses, uma opção explícita de
ambiente de desenvolvimento, nunca o padrão de produção.

SLOW_QUERY_THRESHOLD:
Configurável (variável de ambiente), não um número rígido — não há base de dados de produção real da
apps/api-v2 ainda para calibrar um valor com confiança (regra explícita do prompt). Os buckets de
latência HTTP já usados pelo legacy (5/10/25/50/100/250/500/1000/2500/5000 ms) servem de referência de
ORDEM DE GRANDEZA para uma calibração futura, não como o valor escolhido aqui.
```

---

## Integrações externas

```text
REGISTRO MÍNIMO POR CHAMADA A PROVIDER EXTERNO:
provider (nome do provider — ex.: "stripe", "acrcloud", "spotify"), operation (nome da operação lógica,
não o path bruto do provider), requestId, tenantId (quando disponível), durationMs, result
(success|failure), providerStatusCode (quando o provider expõe um status HTTP/código próprio).

NUNCA REGISTRADO (verbatim do prompt):
access token, refresh token, client secret, senha, header Authorization bruto — mesma regra de
Segurança já fixada no doc50 (SAFE_CLIENT_MESSAGE/INTERNAL_LOG_CONTEXT), estendida aqui explicitamente
a credenciais de provider externo, não só a credenciais do próprio usuário/tenant.

Todo erro de integração externa é normalizado para INTEGRATION_ERROR antes de sair da camada
Integrations (doc47/doc50) — o log técnico completo (incluindo o corpo de erro cru do provider, exceto
qualquer segredo) fica em INTERNAL_LOG_CONTEXT; o requestId do log de integração é o MESMO requestId da
request HTTP que originou a chamada (correlação de ponta a ponta, doc51 seção Request Correlation).
```

---

## Métricas

```text
MÍNIMAS DA API:
- request count (contador, por method+route+status — nunca por tenantId, ver justificativa abaixo)
- request latency (histograma, por method+route)
- HTTP 4xx (derivável do contador acima filtrado por faixa de status, ou contador dedicado)
- HTTP 5xx (idem)
- database errors (contador, por categoria de erro — RESOURCE_CONFLICT vs INFRASTRUCTURE_ERROR, doc50)
- integration errors (contador, por provider)
- transaction failures (contador, por tipo — serialization_failure/deadlock_detected/esgotamento de
  retry, doc51)

SE APLICÁVEL, TAMBÉM:
- active requests (gauge — requests em andamento no momento, útil para saturação/capacidade)
- timeouts (contador, distinto de erro genérico — sinal específico de degradação de dependência)
- rate-limit events (contador, correlacionado com a categoria RATE_LIMITED do doc50)

REGRA DE CARDINALIDADE (achado do legacy, reaproveitado): tenantId NUNCA é usado como label de métrica
Prometheus — cardinalidade efetivamente ilimitada (1 série nova por tenant, por métrica, para sempre).
Investigação por tenant específico pertence a logs/traces (que já carregam tenantId por entrada),
não a séries temporais de métricas agregadas. route (padrão de rota, não interpolada) e method têm
cardinalidade limitada e conhecida — seguros como labels.

Nenhum dashboard é definido nesta etapa (fora de escopo, proibido pelo prompt).
```

---

## Tracing

```text
DISTRIBUTED_TRACING:
PREPARED_BUT_DISABLED — a estratégia de propagação de identificador (W3C Trace Context via header
"traceparent", já reconhecido na seção Request Correlation) é compatível com tracing distribuído futuro,
mas nenhum exportador de spans/backend de tracing é configurado nesta etapa (proibido pelo próprio
prompt: "Não configurar OpenTelemetry"). Decisão também informada pelo deployment target já documentado
(doc42/43): a apps/api-v2 roda tanto como servidor long-running (Docker) quanto como function serverless
na Vercel — o segundo modo tem uma restrição real e conhecida para tracing (spans precisam ser
exportados/flushados antes da function suspender entre invocações, adicionando complexidade e risco de
perda de spans se mal configurado) — não há, nesta etapa, justificativa técnica comprovada para assumir
esse risco antes de qualquer medição real de necessidade.

TRACE_PROPAGATION:
W3C Trace Context (header "traceparent") como formato de entrada/saída reconhecido — mesmo mecanismo já
parcialmente entendido pela correlação de request (extração do trace-id do traceparent já é um caso
tratado na lógica de resolução de ID, ver Request Correlation) — pronto para, no futuro, alimentar um
exportador de spans real sem precisar redesenhar a propagação de identificador.

EXTERNAL_INTEGRATION_SPANS:
NÃO (nesta etapa) — chamadas a provider externo são correlacionáveis por requestId em log (seção
Integrações Externas), o que já cobre a necessidade imediata de "consigo saber quais chamadas externas
pertencem a esta request", sem exigir um backend de tracing.

DATABASE_SPANS:
NÃO (nesta etapa) — mesma lógica: query duration e correlação por requestId já cobertos via log/métrica
(seção Database), sem depender de spans de tracing distribuído.
```

---

## Health e Readiness

```text
LIVENESS:
Responde "este processo está rodando e capaz de responder a uma requisição HTTP simples?" — não checa
NENHUMA dependência externa (banco, cache, provider). Uma falha de liveness significa "reinicie o
processo", não "aguarde a dependência voltar". Mesmo conceito já provado no legacy (/health/live —
sempre "up", sem checar dependência alguma).

READINESS:
Responde "este processo está pronto para receber tráfego de produção agora?" — checa as dependências
CRÍTICAS sem as quais o serviço não consegue operar corretamente. Uma falha de readiness significa
"não envie tráfego para esta instância agora", sem necessariamente reiniciá-la — a instância pode voltar
a ficar pronta sozinha quando a dependência se recuperar.

DEPENDÊNCIAS QUE PODEM IMPACTAR READINESS:
- database (Postgres/Supabase inalcançável ou não respondendo — sem banco, a esmagadora maioria dos
  250 endpoints não consegue operar; mesmo critério já usado pelo legacy, que inclui apenas o banco
  na checagem de /health/ready, deliberadamente mais enxuta que o /health completo)
- configuration crítica (variáveis de ambiente obrigatórias ausentes/inválidas no boot — se a
  configuração crítica nunca validou com sucesso, o processo nunca deveria ter sido considerado pronto)

Memória/disco (indicadores adicionais já vistos no /health completo do legacy) são tratados como
diagnóstico geral, não como critério de readiness — degradação de memória não significa
necessariamente "pare de rotear tráfego para esta instância" da mesma forma que "banco inacessível"
significa.

Nenhum endpoint é criado nesta etapa (proibido pelo prompt) — apenas os 2 conceitos e o critério de
quais dependências participam de qual checagem.
```

---

## Redaction

```text
POLÍTICA: qualquer campo cujo NOME (não o conteúdo) corresponda a um dos padrões abaixo é
automaticamente redigido (substituído por um marcador fixo, ex.: "[REDACTED]") antes de qualquer log
ser emitido — nunca depende de um desenvolvedor lembrar de fazer isso manualmente em cada call site:

authorization, cookie, password, token, secret, apiKey, refreshToken, accessToken

E campos equivalentes por variação de nome (case-insensitive; variações com underscore/hífen/camelCase
— ex.: "api_key", "API-Key", "apiKey" tratados como o mesmo padrão; "client_secret", "provider_token",
"session_token" tratados como variações de "secret"/"token").

A redaction se aplica tanto a logs de aplicação (seção Logging) quanto a logs HTTP (headers de
request/response, quando logados) quanto a qualquer payload eventualmente logado sob a política
restritiva da seção HTTP Logging — é uma camada final, aplicada sempre, independentemente de qual
camada gerou o log.
```

---

## Logging de erros

```text
CLIENT_SAFE_ERROR:
Exatamente o que o cliente recebe no Envelope HTTP já definido no doc50 (statusCode/error/message/
details/timestamp/path/requestId/correlationId/traceId) — nunca stack trace, SQL, connection string,
secret, ou qualquer um dos campos listados em Redaction.

INTERNAL_ERROR_CONTEXT:
O que vai para o log interno (e, para 5xx, para o rastreador de exceções) — pode incluir stack trace
completo, o objeto de exceção original, contexto técnico adicional (nome da query/repository method,
provider e operação de integração, estado da transação) — mas NUNCA os campos de Redaction, mesmo em
contexto interno (a política de Redaction não tem exceção "porque é log interno"; segredo nunca é
logado, ponto — só o NÍVEL DE DETALHE técnico difere entre client-safe e internal, não a política de
segredo).

A separação entre as duas é feita na mesma fronteira já definida no doc50 (Exception Filter global, na
borda HTTP/Controllers) — o log interno completo é sempre emitido, independentemente do que acaba
sendo devolvido ao cliente.
```

---

## Validação (respostas objetivas exigidas pelo prompt)

```text
Logs são estruturados?
SIM

Toda request possui requestId?
SIM

JWT pode aparecer em log?
NÃO

Request body é logado indiscriminadamente?
NÃO

Erros 5xx são correlacionáveis?
SIM

Integrações externas possuem correlationId?
SIM

Health e readiness foram diferenciados?
SIM
```

---

## Resumo

```text
UNRESOLVED_OBSERVABILITY_DECISIONS:
0
```

## Cobertura

Formato de log estruturado com campos mínimos definido, sem exigir tenantId/userId em operação pública. Níveis DEBUG/INFO/WARN/ERROR definidos com critério objetivo (mesmo já provado no legacy). Correlação de request (fonte, header, propagação cross-layer, validação/sanitização de ID externo, header de resposta) definida. Dados de tenant/user permitidos vs. proibidos em log definidos. Logging HTTP mínimo e política restritiva de body definidos. Observabilidade de banco (duração, slow query configurável sem número rígido, falhas de transação/deadlock, pool, proibição de SQL bruto com dado sensível) definida. Observabilidade de integrações externas (registro mínimo, proibições de segredo) definida. Métricas mínimas definidas, incluindo a regra de cardinalidade que proíbe tenantId como label. Tracing distribuído definido como PREPARED_BUT_DISABLED com justificativa ligada ao deployment target dual já documentado. Liveness/Readiness conceitualmente diferenciados, com as dependências que impactam cada um. Política de redaction por nome de campo definida. Separação CLIENT_SAFE_ERROR vs INTERNAL_ERROR_CONTEXT definida, reaproveitando a fronteira já fixada no doc50. Nenhum logger, interceptor, middleware, health endpoint, OpenTelemetry ou métrica foi configurado/instalado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e o deployment não foram alterados. Nenhum documento anterior foi modificado.
