> Historical record. Kept as recorded; not the current contract.

# 70 — Stack Final de Segurança HTTP e Rate Limiting da `apps/api-v2`

Definição read-only das bibliotecas e políticas de segurança HTTP da futura `apps/api-v2`, com verificação de versões em fontes primárias. Fluxo de auth/tenant (doc49), modelo de erro (doc50), configuração/secrets (doc53), versão NestJS (doc59), deployment (doc61), stack de auth/JWT (doc66) e observabilidade (doc68) não reabertos. Nenhum pacote foi instalado, nenhum `main.ts`/Helmet/CORS/throttler/middleware foi criado ou configurado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), deployment e Git não foram alterados.

## Stack já fechada (contexto, não reaberta)

```text
Node.js 24 | TypeScript 6.0.3 | NestJS 11.1.28 + @nestjs/platform-express 11.1.28 + Express 5.2.1 |
Zod 4.4.3 | PostgreSQL 17/Supabase | Drizzle ORM 0.45.2 | pg 8.22.0 | Supabase Auth | jose 6.2.8 |
pg-boss 12.27.0 | @nestjs/schedule 6.1.3 | Pino | Prometheus/OpenMetrics | OpenTelemetry |
NestJS Terminus | Sentry | Deployment: LONG_RUNNING_CONTAINER
```

## Verificação externa (versões confirmadas via registry.npmjs.org nesta etapa)

```text
helmet: 8.3.0 | engines: Node >= 18.0.0 (Node 24 satisfeito)
@nestjs/throttler: 6.5.0 | peer: @nestjs/core/@nestjs/common "^7.0.0...^11.0.0" (NestJS 11.1.28
  satisfeito), reflect-metadata "^0.1.13 || ^0.2.0"
compression: 1.8.1 (mesma versão já confirmada em uso no legacy, doc55/57)
Busca dedicada por storage de throttler compatível com PostgreSQL: NENHUM pacote pronto encontrado —
  apenas implementações Redis (@nest-lab/throttler-storage-redis, nestjs-throttler-storage-redis,
  @nestjs-redis/throttler-storage). O próprio @nestjs/throttler documenta que qualquer storage
  customizado só precisa implementar a interface pública "ThrottlerStorage" (import de
  @nestjs/throttler) — não há atalho de pacote pronto para Postgres, confirmado por esta consulta,
  não presumido.
```

---

## 1. Security headers

```text
SECURITY_HEADERS_ENABLED:
SIM

Tecnologia: helmet 8.3.0 — pacote oficial de referência do ecossistema Express/NestJS para headers de
segurança HTTP, já usado no legacy (doc54/55/57) e reavaliado aqui como adequado por critério próprio,
não por continuidade: helmet aplica um conjunto de headers desenhado especificamente para APIs HTTP
(Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.) sem
depender de políticas exclusivas de frontend (ex.: Content-Security-Policy elaborada para renderização
de página HTML não é o foco de uma API JSON pura — a política aplicada deve refletir isso, não uma CSP
copiada de configuração de app de frontend).
```

---

## 2. CORS

```text
CORS_ORIGIN_ALLOWLIST:
SIM

CORS_FROM_ENV_CONFIG:
SIM

CORS_DYNAMIC_OPEN_ORIGIN:
NÃO

Estratégia: origens permitidas configuradas explicitamente por ambiente, reaproveitando a mesma
categoria de configuração já definida no doc53 (DEPLOYMENT_CONFIG — FRONTEND_URL/APP_URL/API_URL/
CORS_ORIGINS, mesma convenção já usada pelo legacy, doc42) — nunca "Access-Control-Allow-Origin: *" em
produção, já que toda rota protegida da API v2 opera em contexto autenticado/multi-tenant (doc49),
incompatível com uma origem aberta irrestrita. O frontend existente continua funcionando sem mudança de
comportamento porque a mesma origem já configurada hoje (doc42/53) permanece na allowlist da v2 — não é
uma mudança de política, é a mesma política já em vigor, apenas reafirmada como requisito explícito
desta camada.
```

---

## 3. Rate limiting

```text
Tecnologia: @nestjs/throttler 6.5.0 — pacote oficial do ecossistema NestJS para rate limiting, com
peer compatível confirmado com NestJS 11.1.28 (verificação externa acima). Nenhuma alternativa com
justificativa superior foi identificada — é o padrão de fato do próprio framework já escolhido (doc59),
evitando reimplementar manualmente o que o legacy já precisou construir do zero (RateLimitGuard/
RateLimitService próprios, doc54/55, por não haver essa opção adotada naquele momento).

RATE_LIMIT_PACKAGE:
@nestjs/throttler

RATE_LIMIT_VERSION:
6.5.0
```

---

## 4. Rate limiting em ambiente horizontal

```text
A apps/api-v2 pode ter múltiplas réplicas do container (doc61 — escalabilidade horizontal já prevista
conceitualmente). O storage IN_MEMORY default do @nestjs/throttler é por processo — 2 réplicas com
contadores independentes NÃO produzem um limite global consistente (reconhecido explicitamente, não
ignorado).

RATE_LIMIT_STORAGE_MODEL:
HÍBRIDO — in-memory (default do @nestjs/throttler, por réplica) para a maioria dos endpoints +
storage compartilhado em PostgreSQL (implementação PRÓPRIA da interface pública "ThrottlerStorage" do
@nestjs/throttler, sobre a mesma infraestrutura pg/Drizzle já estabelecida, doc58/65) para os
ENDPOINTS SENSÍVEIS listados na seção 7, onde um limite preciso e consistente entre réplicas
efetivamente importa. Nenhum pacote pronto de storage Postgres existe (verificação externa acima) —
esta seria uma implementação própria sobre a interface já documentada e pública do próprio
@nestjs/throttler, não uma "fila artesanal" arriscada, apenas a interface de extensão oficialmente
suportada pelo pacote.

RATE_LIMIT_STORAGE_PACKAGE:
NONE (storage in-memory é o comportamento default do próprio @nestjs/throttler, sem pacote adicional;
storage Postgres-backed para endpoints sensíveis é implementação própria sobre a interface pública do
pacote, não um pacote de terceiros)

MULTI_REPLICA_CONSISTENT:
SIM — não pelo storage in-memory default isoladamente (que sozinho NÃO seria consistente entre
réplicas, reconhecido acima), mas pela combinação de 2 camadas: proteção volumétrica global na camada
de Ingress (seção 5, naturalmente consistente por agregar tráfego antes de chegar às réplicas) +
storage compartilhado em PostgreSQL especificamente para os endpoints sensíveis onde a consistência
exata entre réplicas é funcionalmente necessária. Nenhum Redis foi introduzido (reafirma o doc67, não
reaberto) — a persistência compartilhada, quando necessária, reaproveita a infraestrutura Postgres já
decidida, conforme a própria orientação do prompt.
```

---

## 5. Camadas de rate limiting

```text
EDGE/INGRESS_RATE_LIMIT:
Responsabilidade: proteção volumétrica/global — limites amplos contra abuso/varredura/DDoS de baixo
nível, aplicados ANTES do tráfego alcançar qualquer réplica da aplicação. Naturalmente consistente
entre réplicas por operar num ponto único de agregação de tráfego. Nenhum provedor de ingress concreto
é escolhido nesta etapa (mesma categoria de decisão já deliberadamente deferida no doc61 — "não
escolher provedor de container/hosting").

APPLICATION_RATE_LIMIT:
Responsabilidade: limites SEMÂNTICOS — por endpoint, por usuário, por tenant, refletindo regra de
negócio (ex.: quantas operações de IA um tenant pode disparar por minuto) que só a própria aplicação
tem contexto para decidir corretamente (o Ingress não sabe o que é um "tenant" ou uma "operação de IA").
Implementado via @nestjs/throttler (seção 3/4).

As 2 camadas são complementares, não redundantes — Ingress protege a infraestrutura como um todo;
Application protege regras de negócio específicas que dependem de identidade/contexto já resolvido
(doc49).
```

---

## 6. Identidade para throttling

```text
Estratégia de chave por contexto:
- Requests não-autenticados (rotas públicas, doc49): IP.
- Requests autenticados: identidade JÁ VALIDADA pelo backend (userId/tenantId resolvidos pelo
  TenantGuard a partir do JWT verificado, doc49/66) — nunca um valor lido diretamente de header
  controlado pelo cliente.
- Combinações por endpoint quando fizer sentido (ex.: tenantId + endpoint, para limitar uma operação
  cara por tenant independentemente de qual usuário daquele tenant a disparou).

CLIENT_SUPPLIED_USER_ID_TRUSTED:
NÃO

CLIENT_SUPPLIED_TENANT_ID_TRUSTED:
NÃO

Mesma regra crítica já fixada no doc49 (X-Tenant-ID é indício, nunca prova) — reafirmada aqui
especificamente para a chave de rate limiting: throttling nunca é construído sobre um valor que o
cliente poderia manipular para escapar de um limite (ex.: variar um header para "resetar" a contagem).
```

---

## 7. Endpoints sensíveis

```text
Categorias que poderão possuir política de rate limiting específica (números concretos NÃO definidos
nesta etapa, por instrução explícita do prompt):
- endpoints relacionados a auth (login/reset de senha/troca de senha — superfície clássica de
  brute-force, doc49/66)
- webhooks (endpoints que recebem callback de provider externo, seção 10)
- uploads (mesmo endpoint de presign já mapeado nos docs 48/53)
- relatórios caros (geração de relatório financeiro/exportação, doc37 A.18)
- sincronização de integração (chamadas que disparam trabalho pesado contra um provider externo)
- operações de IA/provider externo (doc37 A.20 — custo direto por chamada, candidato natural a limite
  mais estrito e a storage consistente entre réplicas, seção 4)
```

---

## 8. 429

```text
RATE_LIMIT_HTTP_STATUS:
429

RATE_LIMIT_ERROR_MODEL_COMPATIBLE:
SIM

O envelope de erro já aprovado no doc50 (statusCode/error/message/details/timestamp/path/requestId/
correlationId/traceId, formato plano) cobre 429 sem necessidade de alteração — a categoria RATE_LIMITED
já estava registrada no doc50 (cai hoje no branch default/IntegrationError do frontend congelado, sem
case dedicado, mas com o status preservado). Retry-After é suportado quando tecnicamente aplicável — o
próprio @nestjs/throttler already inclui esse header na resposta 429 por padrão, alinhado à
recomendação HTTP para status 429 (indicar ao cliente quando é seguro tentar novamente).
```

---

## 9. Request size limits

```text
REQUEST_BODY_LIMIT_DEFINED:
SIM

JSON body / urlencoded body: limite explícito, com evidência concreta já existente no próprio
código-fonte do legacy (não um número inventado nesta etapa) — o GlobalExceptionFilter do legacy já
trata explicitamente o caso de payload excedendo "o limite permitido (1MB)" (PayloadTooLargeException,
doc50) — mesma ordem de grandeza reaproveitada como ponto de partida evidenciado para a v2, sujeita a
ajuste por endpoint específico no futuro, não uma invenção sem base.

Uploads: NÃO herdam o limite de JSON/urlencoded — estruturalmente, o processo da API nunca recebe o
arquivo em si (padrão de upload via URL pré-assinada direto ao Cloudflare R2, já fixado nos docs 48/53)
— o corpo da requisição que a API efetivamente processa num fluxo de upload é só a solicitação de
presign (um JSON pequeno), não o arquivo. O "limite de upload" real (tamanho máximo do arquivo) é
imposto pelos parâmetros da própria URL pré-assinada/política do bucket R2, não pelo body-parser da
API — separação estrutural, não apenas uma configuração numérica diferente.

Webhooks: corpo de requisição de webhook também é limitado explicitamente (mesma ordem de grandeza de
um payload JSON comum de provider), mas tratado com raw body preservado quando aplicável (seção 10),
antes de qualquer parsing.

UPLOAD_LIMIT_SEPARATE:
SIM
```

---

## 10. Raw body / webhooks

```text
WEBHOOK_RAW_BODY_SUPPORTED:
SIM

Estratégia: preservação do corpo bruto da requisição (bytes originais, antes de qualquer parsing JSON)
é habilitada SELETIVAMENTE, apenas nas rotas de webhook que efetivamente precisam de validação
criptográfica de assinatura sobre os bytes exatos recebidos (Stripe — já mapeado como integração ativa,
doc65/67; Autentique — AUTENTIQUE_WEBHOOK_SECRET já inventariado no doc42/53; qualquer outro provider
com o mesmo requisito) — via um parser de raw body aplicado somente àquelas rotas específicas, antes do
parser JSON global. Nunca habilitado indiscriminadamente para toda a API (regra explícita do prompt) —
todas as demais rotas continuam usando o parsing JSON estruturado normal.
```

---

## 11. Proxy

```text
TRUST_PROXY_POLICY_DEFINED:
SIM

Como a apps/api-v2 roda como container long-running (doc61) atrás de alguma infraestrutura HTTP
externa (provedor não escolhido, mesma categoria já deferida), a aplicação NÃO confia cegamente em
X-Forwarded-For/X-Forwarded-Proto vindos de qualquer origem — a configuração "trust proxy" do Express é
fixada para um número EXATO e limitado de hops confiáveis (correspondente à topologia real de
proxy/ingress, uma vez que essa topologia for escolhida), nunca um "confiar em tudo" (true) genérico —
evita que um cliente malicioso spoofe X-Forwarded-For para escapar de rate limiting por IP (seção 6) ou
spoofe X-Forwarded-Proto para burlar a exigência de HTTPS (seção 12). O número exato de hops é uma
decisão dependente do provedor de ingress final (deferida, mesma categoria do doc61), mas o PRINCÍPIO
(nunca confiança irrestrita) é fixado aqui.
```

---

## 12. HTTPS

```text
HTTPS_REQUIRED_IN_PRODUCTION:
SIM

TLS pode terminar no ingress/reverse proxy (padrão comum e aceitável para um container long-running
atrás de um balanceador/ingress, doc61) — a aplicação, nesse caso, considera corretamente o protocolo
original via X-Forwarded-Proto, mas SOMENTE quando esse header vem do hop confiável já configurado na
política de trust proxy (seção 11) — nunca aceito de uma origem não verificada. Em produção, uma
requisição que não possa ser confirmada como originalmente HTTPS (direta ou via proxy confiável) não é
tratada como seguramente autenticável.
```

---

## 13. CSRF

```text
CSRF_PROTECTION:
NOT_REQUIRED_FOR_CURRENT_AUTH_MODEL

O modelo de auth já fixado (Authorization: Bearer <JWT>, docs 49/66) não usa cookie de sessão
autenticado — CSRF explora especificamente credenciais ambiente (cookies) que o navegador anexa
automaticamente a requisições cross-site; um Bearer token não é anexado automaticamente pelo navegador
a uma requisição forjada por um site de terceiros (precisaria ser lido explicitamente do storage do
frontend por JavaScript malicioso, cenário de XSS, não de CSRF, e mitigado por controles distintos, não
por proteção CSRF). Se cookies autenticados forem introduzidos no futuro (não planejado, não decidido
aqui), esta decisão precisa ser reavaliada explicitamente — registrado como condição de revisão, não
como possibilidade ignorada.
```

---

## 14. Compression

```text
HTTP_COMPRESSION_LAYER:
APPLICATION

Como nenhum provedor de ingress foi escolhido ainda (doc61, deferido) e não há garantia de que o
ingress eventualmente escolhido já comprima respostas por padrão, a camada de aplicação assume essa
responsabilidade como baseline garantido — via o middleware "compression" (Express, versão já
confirmada em uso comprovado no legacy, doc55/57, reavaliado e mantido por adequação técnica direta,
não por inércia). Se um ingress/CDN especificamente compressivo for confirmado no futuro, a duplicação
pode ser eliminada então (decisão de infraestrutura futura, fora do escopo desta etapa) — mas não se
assume isso agora, evitando um "buraco" de compressão caso o provedor final não comprima por padrão.
```

---

## 15. Input security

```text
RAW_SQL_PARAMETERIZATION_REQUIRED:
SIM

Zod (doc64, não reaberto) valida ESTRUTURA do payload HTTP — nunca tratado como defesa suficiente
contra SQL injection, bypass de autorização, bypass de tenant ou mass assignment, que são categorias de
ataque em camadas DIFERENTES (persistência, autorização, binding de campo) da simples validação de
forma. Drizzle (doc45/58/65) já usa queries parametrizadas por design em todo acesso normal a dado;
qualquer SQL cru permitido (doc51/65 — primitivo de sessão RLS via helper `sql` do Drizzle) permanece
sempre parametrizado, nunca concatenação de string com valor de entrada do usuário. Bypass de
autorização/tenant é responsabilidade das camadas já fixadas nos docs 47/49 (Guards + enforcement de
aplicação + RLS como defesa em profundidade), não da validação HTTP. Mass assignment é mitigado pela
própria fronteira DTO↔Domain já fixada no doc47/48/64 (um DTO Zod nunca vira uma entidade de domínio
diretamente — campos não esperados não atravessam essa fronteira).
```

---

## 16. Error security

```text
Reafirmado sem reabertura do modelo de erro (doc50): nenhuma resposta HTTP da apps/api-v2 expõe stack
trace, SQL, tokens, secrets, connection strings, paths internos ou credenciais de provider — mesma
distinção SAFE_CLIENT_MESSAGE/INTERNAL_LOG_CONTEXT já fixada no doc50, agora também alinhada à política
de redaction já definida na stack de observabilidade (doc68).
```

---

## 17. Dependências

```text
HELMET_PACKAGE:
helmet

HELMET_VERSION:
8.3.0

RATE_LIMIT_PACKAGE:
@nestjs/throttler

RATE_LIMIT_VERSION:
6.5.0

RATE_LIMIT_STORAGE_PACKAGE:
NONE (in-memory default do próprio @nestjs/throttler; storage Postgres-backed para endpoints sensíveis
é implementação própria sobre a interface pública do pacote, não um pacote de terceiros — nenhum
pacote de storage Redis foi considerado, mantendo a decisão já fixada no doc67)

OTHER_HTTP_SECURITY_PACKAGES:
- compression 1.8.1 (response compression, camada de aplicação, seção 14)

Nenhum pacote redundante foi adicionado onde NestJS/Express já resolvem a responsabilidade
adequadamente (ex.: nenhuma biblioteca extra de CORS — o suporte nativo do NestJS/Express já cobre a
necessidade, seção 2).
```

---

## 18. Verificação externa (fontes)

```text
registry.npmjs.org — helmet, @nestjs/throttler, compression (versões e peerDependencies/engines
consultados diretamente, não inferidos de blog/tutorial).
Busca dedicada por storage de throttler compatível com PostgreSQL — confirmando ausência de pacote
pronto, decisivo para a escolha de implementação própria (seção 4/17).
Node.js 24 / NestJS 11.1.28 / Express 5.2.1 — compatibilidade confirmada via engines/peerDependencies
de cada pacote selecionado (não presumida).
```

---

## 19. Resultado final

```text
API V2 — HTTP SECURITY STACK

Security headers:
helmet 8.3.0

CORS:
NestJS/Express explicit allowlist (por ambiente, via configuração já definida no doc53)

Rate limiting:
@nestjs/throttler 6.5.0

Rate-limit storage:
híbrido — in-memory default (por réplica) + PostgreSQL compartilhado (implementação própria da
interface ThrottlerStorage) para endpoints sensíveis

Request limits:
configurados por tipo de endpoint (JSON/urlencoded com base evidenciada no legacy — ordem de 1MB;
uploads estruturalmente separados via presign direto ao R2; webhooks com raw body seletivo)

Webhook raw body:
suportado seletivamente (Stripe, Autentique, e demais providers com requisito de assinatura
criptográfica sobre bytes originais)

HTTPS:
obrigatório em produção

Trust proxy:
configuração explícita, número limitado de hops confiáveis (não "confiar em tudo")

CSRF:
NOT_REQUIRED_FOR_CURRENT_AUTH_MODEL (Bearer JWT, sem cookie de sessão autenticado)

Raw SQL:
sempre parametrizado (via Drizzle, doc45/51/65)
```

---

## Resumo

```text
UNRESOLVED_HTTP_SECURITY_DECISIONS:
0
```

## Cobertura

19 seções pedidas cobertas com versões exatas verificadas em fonte primária (registry.npmjs.org),
incluindo uma busca dedicada que confirmou a ausência de um pacote pronto de storage Postgres-backed
para @nestjs/throttler, decisiva para a escolha de implementação própria sobre a interface pública já
documentada do pacote, evitando Redis (doc67 reafirmado, não reaberto). Rate limiting em ambiente
horizontal endereçado com honestidade sobre a limitação do storage in-memory isolado, resolvida via
arquitetura híbrida de 2 camadas (Ingress + storage compartilhado seletivo). CORS, request size limits,
raw body de webhook, trust proxy, HTTPS, CSRF, compressão e parametrização de SQL definidos de forma
concreta e justificada, sem números arbitrários sem evidência (limite de 1MB citado com base no próprio
código do legacy, não inventado). Nenhum pacote foi instalado, nenhum `main.ts`/Helmet/CORS/throttler/
middleware foi criado ou configurado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy),
deployment e Git não foram alterados. Nenhuma decisão arquitetural anterior foi reaberta. Nenhum
documento anterior foi modificado.
