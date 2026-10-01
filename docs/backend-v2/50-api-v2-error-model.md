> Historical record. Kept as recorded; not the current contract.

# 50 — Modelo de Erros e Exceptions da `apps/api-v2`

Definição read-only do modelo único de erros, aplicando a arquitetura em camadas já aprovada ([`47`](./47-api-v2-layered-architecture.md)) e o fluxo de auth/tenant já aprovado ([`49`](./49-auth-tenant-request-context.md)) sobre os contratos reais já mapeados em [`13`](./13-http-error-contracts.md)/[`14`](./14-http-error-final-resolution.md)/[`37`](./37-canonical-frontend-contract-final.md). Nenhuma exception class, filter, controller ou middleware foi criado. `apps/api-v2` não foi criado. Nenhuma dependência foi instalada. `apps/web` e `apps/api` (legacy) não foram alterados.

## Conflito real encontrado e resolvido antes de definir o envelope

O "exemplo conceitual" do próprio prompt (`{"error": {"code": ..., "message": ..., "details": {}, "requestId": ...}}`, formato ANINHADO) **é incompatível com o consumo real do frontend congelado** — evidência direta:

```text
apps/web/src/shared/lib/api-client.ts:102-129 (mapError())
  → body: { message?: string | string[]; error?: string } — AMBOS os campos são lidos como
  PRIMEIRO NÍVEL do corpo JSON, não aninhados sob "error". body.error é comparado por
  IGUALDADE ESTRITA de string ("MUST_CHANGE_PASSWORD") — se "error" fosse um objeto (formato
  aninhado do exemplo do prompt), essa comparação NUNCA seria verdadeira, e o fluxo real de
  troca de senha obrigatória (PasswordChangeRequiredError) quebraria silenciosamente.
```

A instrução do próprio prompt resolve esse conflito explicitamente: *"O formato final deve respeitar os contratos já exigidos pelo frontend. Não inventar campos incompatíveis com o consumo existente."* — o "exemplo conceitual" é, por definição do próprio enunciado, apenas um exemplo, não uma exigência; a exigência real é a compatibilidade com `mapError()`. Adicionalmente, o legacy já tem um `GlobalExceptionFilter` real, testado e em produção, que emite exatamente o formato PLANO que `mapError()` espera — usado como base (mesma lógica do doc49: "ajuste somente se houver exigência técnica comprovada", e não há nenhuma aqui contra o formato já provado):

```text
apps/api/src/core/filters/global-exception.filter.ts:70-79 (errorBody)
  → { statusCode, message, error, timestamp, path, requestId, correlationId, traceId } — plano,
  não aninhado. error é um código string simples (nome da exceção por padrão, OU um código de
  máquina explícito quando o guard o define, ex.: "MUST_CHANGE_PASSWORD" — comentário no próprio
  arquivo linha 37-41 confirma que este código "PRECISA sobreviver até o cliente").
```

---

## Envelope HTTP (formato final)

```json
{
  "statusCode": 404,
  "error": "RESOURCE_NOT_FOUND",
  "message": "Contract not found",
  "details": {},
  "timestamp": "2026-08-08T12:00:00.000Z",
  "path": "/api/v1/contracts/123",
  "requestId": "6e2f...-uuid",
  "correlationId": "6e2f...-uuid",
  "traceId": "6e2f...-uuid"
}
```

```text
ERROR_ENVELOPE:
Plano (não aninhado) — mesma forma já provada pelo GlobalExceptionFilter do legacy e já consumida
pelo mapError() do frontend congelado. "details" é a ÚNICA adição nova em relação ao que o legacy já
emite — ver seção VALIDAÇÃO abaixo sobre por que é aditiva e não quebra nada.

REQUIRED_FIELDS:
- statusCode  (número HTTP — redundante com o status da resposta em si, mas preservado no corpo
  porque o legacy já o inclui e nada no contrato proíbe)
- error        (código de máquina, string — ver seção CÓDIGOS DE ERRO)
- message       (string ou string[] — texto seguro para exibição; array = múltiplos erros de campo)
- timestamp      (ISO 8601)
- path            (path da requisição que falhou)
- requestId        (ver seção REQUEST ID)
- correlationId     (ver seção REQUEST ID)
- traceId            (ver seção REQUEST ID)

OPTIONAL_FIELDS:
- details  (objeto — presente apenas quando há detalhamento estruturado adicional, ex.: mapa
  campo→mensagem para VALIDATION_ERROR; ver seção VALIDAÇÃO. Campo NOVO, não lido por nenhum
  consumidor real hoje — aditivo, não quebra o contrato existente, e dá caminho de evolução futura
  para a capacidade já desenhada e hoje órfã de ValidationError.fields no frontend, doc13)
```

---

## Categorias, códigos de erro e status HTTP

```text
CATEGORIA                    CÓDIGO (error)              HTTP STATUS   OBSERVAÇÃO
erro de validação             VALIDATION_ERROR             400          OBRIGATÓRIO ser 400, não 422 —
                                                                          mapError() só reconhece
                                                                          ValidationError no case 400
                                                                          (evidência acima); usar 422
                                                                          quebraria essa checagem.
erro de autenticação            AUTH_TOKEN_MISSING            401          token ausente
                                 AUTH_TOKEN_INVALID             401          assinatura/issuer/audience
                                                                          inválidos
                                 AUTH_TOKEN_EXPIRED               401          expiração — código distinto
                                                                          para o frontend futuramente
                                                                          poder acionar refresh
                                                                          automaticamente (hoje ele só
                                                                          reage ao status 401 em si,
                                                                          doc13 — ver nota abaixo)
erro de tenant                    TENANT_NOT_FOUND                   403          NUNCA 404 — 404 é reservado
                                   TENANT_INACTIVE                     403          para recurso de negócio,
                                   TENANT_ACCESS_DENIED                  403          não identidade de tenant;
                                                                          mapError() já trata TODO 403
                                                                          via TenantError, doc13
erro de autorização (permission)     PERMISSION_DENIED                    403          mesmo status 403, código
                                                                          distinto do de tenant para
                                                                          quem processa o campo "error"
recurso não encontrado                 RESOURCE_NOT_FOUND                    404          mapError() case 404 →
                                                                          NotFoundError
conflito                                RESOURCE_CONFLICT                     409          mapError() case 409 →
                                                                          ConflictError
regra de negócio                          BUSINESS_RULE_VIOLATION                422          sem case dedicado no
                                                                          frontend hoje — cai no branch
                                                                          default (IntegrationError com
                                                                          statusCode preservado, doc13);
                                                                          escolhido por correção semântica
                                                                          (entidade sintaticamente válida,
                                                                          mas viola invariante de negócio),
                                                                          sem quebrar nada existente
rate limit                                RATE_LIMITED                            429          idem — cai no branch default
                                                                          hoje, sem case dedicado
integração externa                          INTEGRATION_ERROR                        502 | 503     502 = provider respondeu com
                                                                          erro/shape inesperado; 503 =
                                                                          provider inalcançável/timeout —
                                                                          mapError() já trata 503
                                                                          explicitamente em 2 call sites
                                                                          reais (TenantContext.tsx,
                                                                          useUploadToR2.ts, doc13)
erro de infraestrutura                        INFRASTRUCTURE_ERROR                       503 | 500     503 = falha de conectividade/
                                                                          timeout (Postgres/Drizzle/
                                                                          Supabase inalcançável); 500 =
                                                                          qualquer outra falha de infra
                                                                          não classificável como
                                                                          conectividade
erro interno inesperado                         INTERNAL_ERROR                             500          catch-all — mesmo default do
                                                                          GlobalExceptionFilter legacy
                                                                          ("Erro interno do servidor")

422 (Unprocessable Entity):
Usado APENAS para BUSINESS_RULE_VIOLATION — deliberadamente NÃO usado para VALIDATION_ERROR (que
permanece 400), para não quebrar o único case status-específico que mapError() já implementa para
erro de validação.
```

**Nota sobre o código literal `MUST_CHANGE_PASSWORD`:** é um requisito antigo preservado, não uma
nova convenção — `mapError()` compara `body.error` a essa string exata (evidência citada acima). A
`apps/api-v2` deve continuar emitindo esse código literal, inalterado, sempre que a mesma condição de
negócio (troca de senha obrigatória) ocorrer, mesmo que ele não siga o padrão de categoria genérico
desta tabela (ex.: `AUTH_PASSWORD_CHANGE_REQUIRED`) — a compatibilidade com o frontend congelado
prevalece sobre a consistência estética da nomenclatura.

**Nota sobre `R2_NOT_CONFIGURED`:** `useUploadToR2.ts` já verifica hoje a substring `"R2_NOT_CONFIGURED"`
na mensagem OU `statusCode === 503` (doc13) — a `apps/api-v2` deve preservar ambos os sinais para este
cenário específico (upload indisponível por integração R2 não configurada): status 503 E a substring
`"R2_NOT_CONFIGURED"` presente em `message` (ou em `error`, já que o frontend também aceita casar por
`.message`).

---

## Convenção de códigos de erro

```text
FORMATO: SCREAMING_SNAKE_CASE, sem aninhamento hierárquico obrigatório no nome (ex.: "RESOURCE_NOT_FOUND",
não "RESOURCE.NOT_FOUND" nem "resource:not_found").

ESTABILIDADE: as 11 CATEGORIAS e seu mapeamento para HTTP status (tabela acima) são a parte ESTÁVEL do
contrato — não deve crescer nem mudar sem nova auditoria de compatibilidade com o frontend.

EXTENSIBILIDADE: dentro de cada categoria, novos códigos de erro ESPECÍFICOS de domínio podem ser
adicionados livremente ao longo do tempo (ex.: "CONTRACT_ALREADY_SIGNED", "ARTIST_HAS_ACTIVE_RELEASES"
sob a categoria BUSINESS_RULE_VIOLATION/422) sem exigir uma nova categoria nem um novo status HTTP — o
código específico vai no campo "error", a categoria/status permanecem fixos. Esta etapa não lista os
futuros códigos de erro de domínio (fora de escopo, por instrução explícita do prompt).

EXCEÇÃO REGISTRADA: "MUST_CHANGE_PASSWORD" é mantido verbatim por compatibilidade com o frontend
congelado (ver nota acima), mesmo não seguindo o prefixo de categoria "AUTH_"/"PERMISSION_" — novos
códigos não devem repetir esse padrão sem a mesma evidência forte de dependência do frontend.
```

---

## Validação (class-validator / class-transformer / ValidationPipe)

```text
COMPORTAMENTO:
O ValidationPipe global (whitelist+forbidNonWhitelisted+transform, já fixado no doc44) rejeita a
requisição com HTTP 400 quando class-validator encontra 1+ violação de constraint num DTO. O
comportamento nativo do NestJS já produz um array de mensagens (uma por constraint violada,
tipicamente "campo deve satisfazer X") — compatível diretamente com o "message: string[]" que
mapError() já sabe interpretar (Array.isArray → join("; ")), sem necessidade de nenhuma transformação
adicional para preservar compatibilidade.

MÚLTIPLOS ERROS DE CAMPO — FORMATO DETERMINÍSTICO:
- message: string[] — cada elemento no formato "{campo}: {violação}" (determinístico, 1 elemento por
  constraint violada, ordem estável = ordem de declaração dos decorators no DTO)
- details.fields: Record<string, string[]> (NOVO campo opcional, aditivo) — mesma informação
  reestruturada como mapa campo→lista de violações daquele campo especificamente, dando caminho de
  evolução futura para a capacidade ValidationError.fields já desenhada e hoje órfã no frontend
  (doc13), sem depender dela para o funcionamento atual.
- error: sempre "VALIDATION_ERROR" para este caso — nunca variável por tipo de constraint.
```

---

## Domain errors — independência de transporte

```text
REGRA:
Erros originados em Domain/Application (doc47) são classes TypeScript puras, cada uma com uma
categoria fixa (uma das 11 desta tabela) + um código específico + uma mensagem seguro para cliente +
um "details" opcional — NUNCA estendem HttpException, NUNCA importam @nestjs/common, NUNCA importam
Express. Um Domain/Application error é indistinguível, em sua própria definição, de um erro que
rodaria num script Node puro sem nenhum framework.

CONVERSÃO PARA HTTP:
Ocorre exclusivamente na borda HTTP/Controllers (doc47) — um Exception Filter global (equivalente
funcional ao GlobalExceptionFilter já provado no legacy) intercepta qualquer erro que escape do
Controller, mapeia a categoria do erro de Domain/Application para o HTTP status fixo da tabela acima,
monta o Envelope HTTP, anexa requestId/correlationId/traceId, e só então escreve a resposta. Nenhuma
camada abaixo de HTTP/Controllers conhece HttpException, status HTTP, ou o shape do Envelope.
```

---

## Infrastructure errors — normalização antes de cruzar a fronteira

```text
REGRA:
Erros de PostgreSQL, Drizzle, Supabase, timeouts e falhas de rede são CAPTURADOS e TRADUZIDOS na
própria camada de Persistence/Integrations (doc47) — nunca propagados crus para Application/Domain,
e MUITO MENOS para o Controller/HTTP.

MAPEAMENTO TÍPICO (categoria de destino, não exaustivo — regra, não lista de códigos):
- Violação de constraint única/composta (Postgres) → RESOURCE_CONFLICT (409)
- Timeout/conexão recusada (Postgres, Drizzle, Supabase) → INFRASTRUCTURE_ERROR (503)
- Erro de schema/query mal formada (bug interno, não erro do cliente) → INTERNAL_ERROR (500)
- Erro de SDK de provider externo (Stripe, ACRCloud, Spotify, R2, Resend, provedores de IA) →
  INTEGRATION_ERROR (502, se o provider respondeu com erro; 503, se inalcançável/timeout)

O objeto de erro cru do driver/SDK (com stack trace, texto de SQL, payload do provider) fica
disponível SOMENTE em INTERNAL_LOG_CONTEXT (ver seção Segurança) — nunca no Envelope HTTP.
```

---

## Segurança

```text
PROIBIDO em qualquer resposta HTTP (verbatim do prompt, sem exceção):
stack trace, SQL, connection string, API secret, token, senha, internal filesystem path, raw provider
secret.

SAFE_CLIENT_MESSAGE:
O texto que efetivamente vai em "message"/"error"/"details" do Envelope. Para as categorias
"esperadas"/4xx (VALIDATION_ERROR, AUTH_*, TENANT_*, PERMISSION_DENIED, RESOURCE_NOT_FOUND,
RESOURCE_CONFLICT, BUSINESS_RULE_VIOLATION, RATE_LIMITED) pode ser específico e detalhado — é
copy pensada para o usuário/desenvolvedor cliente, nunca um valor bruto de exceção interna.
Para INTEGRATION_ERROR/INFRASTRUCTURE_ERROR/INTERNAL_ERROR (5xx), a mensagem é SEMPRE um texto fixo e
genérico por categoria (ex.: "Erro interno do servidor" — mesma string já usada como default pelo
GlobalExceptionFilter do legacy), independentemente da causa real.

INTERNAL_LOG_CONTEXT:
O erro real e completo (stack trace, objeto de exceção original, payload de request quando relevante,
identificadores de tenant/usuário) — vai exclusivamente para o log estruturado da camada Observability
(doc47) e, para 5xx/erros inesperados, para o rastreador de exceções (Sentry, já usado no legacy) —
NUNCA é serializado no corpo da resposta HTTP. A mesma distinção que já existe hoje no
GlobalExceptionFilter (branch de erro genérico loga stack trace via Logger.error e reporta ao Sentry,
mas o corpo HTTP devolvido ao cliente usa a string fixa "Erro interno do servidor") é o padrão adotado.
```

---

## Request ID

```text
Todo erro (e toda resposta, não só erro) inclui requestId — gerado (ou propagado de um header de
entrada, se já presente) por um middleware de borda antes de qualquer Guard/Controller rodar, mesmo
mecanismo já provado no legacy (RequestIdMiddleware + fallback para X-Request-ID recebido + fallback
final para um UUID gerado). correlationId e traceId acompanham o requestId (podem coincidir com ele
quando não há um valor de entrada distinto) — mesmos 3 campos já emitidos pelo GlobalExceptionFilter
do legacy, tanto no corpo JSON quanto como headers de resposta (X-Request-ID/X-Correlation-ID/
X-Trace-ID). O mesmo requestId/correlationId é o valor que alimenta o campo "correlationId" do
RequestContext já definido no doc49 — um único identificador de ponta a ponta (Guards → Use Case →
log → resposta de erro), não gerado de forma independente em cada camada.
```

---

## Logging

```text
DEBUG: nenhuma categoria de erro é logada como DEBUG — erro nunca é "mero debug".

INFO: VALIDATION_ERROR, RESOURCE_NOT_FOUND — categorias de altíssima frequência esperada, causadas
pelo cliente, não acionáveis operacionalmente por si só (um 404 isolado não indica problema de sistema).

WARN: AUTH_TOKEN_MISSING/INVALID/EXPIRED, TENANT_NOT_FOUND/INACTIVE/ACCESS_DENIED, PERMISSION_DENIED,
RESOURCE_CONFLICT, BUSINESS_RULE_VIOLATION, RATE_LIMITED — causadas pelo cliente, mas com valor de
observação (possível tentativa de acesso indevido, possível bug de sincronismo de estado no frontend,
possível abuso).

ERROR: INTEGRATION_ERROR, INFRASTRUCTURE_ERROR, INTERNAL_ERROR — sempre logadas com stack
trace/contexto completo (INTERNAL_LOG_CONTEXT) e reportadas ao rastreador de exceções. Mesma regra já
comprovada no legacy é preservada: 4xx NUNCA são reportados ao rastreador de exceções (são esperados,
não "erros de sistema"), só 5xx/exceções não tratadas o são.
```

---

## Integrações externas

```text
REGRA:
Todo erro vindo de um SDK/provider externo (Stripe, ACRCloud, Spotify, Meta, TikTok, Google, DocuSign,
Resend, provedores de IA, Cloudflare R2) é normalizado para a categoria única INTEGRATION_ERROR na
própria camada Integrations (doc47) antes de propagar — o frontend não recebe o código de erro nativo
do provider, o shape de erro nativo do SDK, nem qualquer identificador interno do provider, EXCETO
quando o contrato canônico já aprovado (doc37) explicitamente documenta um shape de sucesso/erro
próprio para aquele endpoint específico (nenhuma exceção desse tipo foi encontrada nos 250 endpoints já
mapeados — apenas o caso já registrado de R2_NOT_CONFIGURED, tratado como nota de compatibilidade
acima, não como uma exceção geral à regra).
```

---

## Validação (respostas objetivas exigidas pelo prompt)

```text
Domain error depende de NestJS?
NÃO

Erro interno pode expor stack trace ao cliente?
NÃO

Erro de autenticação usa 401?
SIM

Erro de permission usa 403?
SIM

Recurso inexistente usa 404?
SIM

Conflito de estado/unique pode usar 409?
SIM

Erros de validação possuem formato determinístico?
SIM

Todo erro pode ser correlacionado por requestId?
SIM
```

---

## Resumo

```text
UNRESOLVED_ERROR_MODEL_DECISIONS:
0
```

## Cobertura

Envelope HTTP definido com evidência direta de conflito resolvido entre o exemplo conceitual do prompt
(aninhado) e o consumo real do frontend congelado (plano) — resolvido a favor da compatibilidade real,
usando o `GlobalExceptionFilter` já provado no legacy como base. As 11 categorias exigidas foram
mapeadas a códigos e status HTTP, com 2 desvios deliberados e justificados do exemplo do prompt
(VALIDATION_ERROR fixado em 400, não 422; BUSINESS_RULE_VIOLATION usando 422). Validação,
independência de transporte do Domain, normalização de erros de infraestrutura/integrações externas,
regras de segurança (SAFE_CLIENT_MESSAGE vs INTERNAL_LOG_CONTEXT), requestId e níveis de logging foram
definidos. Nenhuma exception class, filter, controller, middleware, banco ou migration foi criado.
`apps/api-v2` não foi criado. Nenhuma dependência foi instalada. `apps/web` e `apps/api` (legacy) não
foram alterados. Nenhum documento anterior foi modificado.
