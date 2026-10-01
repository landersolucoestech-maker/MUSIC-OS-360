> Historical record. Kept as recorded; not the current contract.

# 69 — Stack Final de Testes e Quality Gates da `apps/api-v2`

Definição read-only da stack de testes e gates obrigatórios da futura `apps/api-v2`, com verificação de versões em fontes primárias (npm registry). Arquitetura em camadas (doc47), modelo de erro (doc50), estratégia transacional (doc51), regras de preservação comportamental (doc62), stack assíncrona (doc67) e observabilidade (doc68) não reabertas. Nenhum teste/config Jest/banco de teste/CI foi criado ou alterado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e Git não foram alterados.

## Stack já fechada (contexto, não reaberta)

```text
Node.js 24 | TypeScript 6.0.3 | NestJS 11.1.28 | Express 5.2.1 | Zod 4.4.3 | PostgreSQL 17/Supabase |
Drizzle ORM 0.45.2 | pg 8.22.0 | drizzle-kit 0.31.10 | Supabase Auth | jose 6.2.8 | pg-boss 12.27.0 |
@nestjs/schedule 6.1.3 | Pino | Prometheus/OpenMetrics | OpenTelemetry | NestJS Terminus | Sentry
```

---

## 1. Test runner — verificação externa e decisão

```text
Fontes: registry.npmjs.org (consultadas nesta etapa)
jest: 30.4.2 | engines: Node "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0" (Node 24 satisfeito)
ts-jest: 29.4.12 | peer: typescript ">=4.3 <7" (TS 6.0.3 já fechado no doc63 cai exatamente dentro
  desta faixa — CONFIRMA a decisão do doc63 de evitar TypeScript 7: se a v2 tivesse escolhido TS7,
  ts-jest simplesmente não teria versão compatível, mesmo achado já registrado naquela etapa,
  reafirmado aqui com evidência adicional), jest "^29.0.0 || ^30.0.0" (jest 30.4.2 satisfeito)
vitest: 4.1.10 | engines: Node "^20.0.0 || ^22.0.0 || >=24.0.0" (Node 24 satisfeito)

COMPARAÇÃO:
NestJS integration: Jest é o runner oficial/default do ecossistema NestJS (scaffolding do próprio Nest
  CLI, @nestjs/testing desenhado com Jest como caminho primário de documentação) — Vitest funciona com
  NestJS via TestingModule (framework-agnóstico na sua API pública), mas não é o caminho oficialmente
  documentado.
TypeScript 6: ambos compatíveis — mas ts-jest confirma explicitamente suporte a TS 6.x (evidência
  acima); Vitest usa esbuild para transformação (mais rápido, mas sem type-checking embutido no
  transform em si — typecheck já é gate separado, seção 8, então isso não é uma desvantagem funcional
  de Vitest, apenas uma diferença de arquitetura).
ESM/CJS compatibility: a apps/api-v2 já fixou module system CommonJS no doc63 (decisão deliberada para
  alinhamento com o ecossistema NestJS 11, evitando o objetivo de modernização ESM que é do NestJS 12,
  ainda não a versão escolhida) — Jest/ts-jest tem CommonJS como seu modo mais maduro e testado
  historicamente; Vitest é nativamente orientado a ESM (via Vite), com suporte a CJS mas não sendo o
  cenário para o qual foi primariamente desenhado — descasamento direto com a decisão já fixada de
  module system.
Mocking/spies: ambos maduros (jest.fn()/jest.spyOn() vs. vi.fn()/vi.spyOn()) — equivalentes.
Coverage: ambos com coverage nativo (Jest via istanbul/v8, Vitest via v8/istanbul) — equivalentes.
Speed: Vitest é reconhecidamente mais rápido em transformação (esbuild) — vantagem real, porém não
  decisiva frente ao descasamento de module system e ao alinhamento oficial com NestJS.
Test isolation: equivalentes, ambos com isolamento de módulo por arquivo/worker.
Ecosystem maturity: Jest tem o maior histórico de uso especificamente em aplicações NestJS/backend
  Node — Vitest é maduro para o ecossistema Vite/frontend (já usado em apps/web, doc57), mas com menor
  histórico específico de backend NestJS.
CI stability: ambos estáveis em CI — sem diferenciador.

DECISÃO:
Jest — não "porque o legacy já usa" (mesma armadilha já evitada em toda esta série de decisões), mas
  porque a combinação já fechada da stack (module system CommonJS do doc63 + ecossistema oficial
  NestJS 11) favorece estruturalmente Jest sobre Vitest, cujo maior diferencial (velocidade via ESM/
  esbuild) não se aplica com a mesma força a um projeto que já decidiu CommonJS por motivos
  independentes e bem justificados (doc63). Vitest já é usado no frontend (apps/web) — não é motivo
  para nem a favor nem contra aqui (mesma regra de não confundir stack de um app com a do outro já
  aplicada em toda esta série).
```

---

## 2. Tipos de teste obrigatórios

```text
UNIT: domain rules, use cases, pure services, mappers — sem banco real quando não necessário (Domain/
  Application, doc47, são TypeScript puro por design, testáveis isoladamente sem infraestrutura).

INTEGRATION: repositories, Drizzle, PostgreSQL, transactions, RLS, pg-boss, integrações internas —
  sempre contra PostgreSQL real (seção 3), nunca um substituto.

CONTRACT: validação obrigatória dos 250 endpoints HTTP e 22 eventos realtime já congelados no doc37 —
  a apps/api-v2 NÃO pode ser considerada pronta se quebrar qualquer contrato já aprovado (mesmo
  princípio do doc62 — FRONTEND_AS_FUNCTIONAL_SPEC).

E2E: fluxos completos reais, incluindo obrigatoriamente o exemplo já registrado no doc62 (criar
  despesa → vincular artista → transação concluída → contabilidade/P&L refletido corretamente) — o
  mesmo requisito de negócio já fixado naquele documento, agora traduzido em categoria de teste
  obrigatória, não reaberto.
```

---

## 3. Banco de testes

```text
TEST_DATABASE_ENGINE:
PostgreSQL 17

Estratégia: PostgreSQL real e isolado por execução de teste (via Testcontainers, seção 4) — nunca
SQLite ou qualquer substituto em memória, exatamente porque RLS, constraints compostas, transactions
com SET LOCAL e SQL específico do PostgreSQL (doc45/47/51) não têm equivalente fiel em outro motor de
banco — testar contra um motor diferente do de produção validaria um comportamento que não é o
comportamento real do sistema, especialmente crítico para RLS (defesa em profundidade que só existe de
fato no PostgreSQL).
```

---

## 4. Testcontainers

```text
Fonte: registry.npmjs.org/@testcontainers/postgresql (consultada nesta etapa)

@testcontainers/postgresql: 12.1.0 | dependency: testcontainers ^12.1.0

DECISÃO: SIM, Testcontainers faz parte da stack da apps/api-v2.

Justificativa: isolamento real por execução (cada suíte de integração sobe uma instância PostgreSQL 17
efêmera, migra do zero via Drizzle Kit + SQL manual já aprovados no doc46, roda os testes, descarta) —
reprodutibilidade total entre máquinas de desenvolvimento e CI (mesma imagem de container em qualquer
ambiente), sem depender de um banco de teste compartilhado e stateful que possa divergir entre execuções
ou vazar estado entre suítes. Docker já é uma dependência operacional confirmada do projeto (doc61,
deployment em container long-running) — Testcontainers reaproveita essa mesma capacidade já presente no
ambiente, sem introduzir uma categoria de infraestrutura nova.

TESTCONTAINERS_PACKAGE:
@testcontainers/postgresql 12.1.0 (+ testcontainers ^12.1.0 como dependência base)
```

---

## 5. HTTP testing

```text
Fonte: registry.npmjs.org/supertest (consultada nesta etapa)

supertest: 7.2.2 | engines: Node >=14.18.0 (Node 24 satisfeito)

DECISÃO: supertest — mesma biblioteca já usada no legacy (doc54/55/57), reavaliada e confirmada
adequada, não copiada por inércia: é a ferramenta padrão de fato para testes HTTP de aplicações Express/
NestJS (a apps/api-v2 usa platform-express, doc59), com integração direta e bem documentada com
@nestjs/testing (INestApplication exposto diretamente para supertest(app.getHttpServer())), sem
alternativa tecnicamente superior identificada para este caso de uso específico.

HTTP_TEST_LIBRARY_VERSION:
7.2.2
```

---

## 6. Coverage

```text
GLOBAL_COVERAGE_THRESHOLD:
Um piso global existe como higiene mínima (evita regressão generalizada), mas NÃO é o mecanismo
principal de qualidade — um número global alto pode mascarar um módulo crítico fracamente testado
(exatamente o problema que este prompt pede para evitar). O piso global funciona como uma rede de
segurança ampla, não como a política real.

CRITICAL_MODULE_COVERAGE_POLICY:
Threshold diferenciado por criticidade, não um único número:

- security/auth (Guards de autenticação/tenant/permissão, validação de JWT, doc66): threshold MAIS
  ALTO do conjunto — falha aqui é uma falha de isolamento de segurança/tenant, a categoria de erro mais
  cara possível neste sistema (doc45/47/49).
- financial (domínio accounting — Transacao/P&L/NotaFiscal, doc62): mesmo threshold mais alto —
  doc62 já estabeleceu tolerância zero a inconsistência financeira silenciosa; a cobertura de teste é a
  ferramenta que torna essa garantia verificável, não apenas declarada.
- domain/application (regras de negócio e use cases dos demais domínios, doc47): threshold alto — é
  TypeScript puro, barato e rápido de testar exaustivamente (sem infraestrutura), sem desculpa técnica
  para cobertura baixa.
- repositories (Persistence Adapters Drizzle): threshold moderado-alto, mas a garantia real de
  correção vem primariamente de INTEGRATION tests contra PostgreSQL real (seção 3/4), não de cobertura
  de linha isolada — cobertura aqui é complementar, não a prova principal de corretude.
- integration adapters (Stripe/R2/provedores externos, doc47 camada Integrations): threshold moderado
  — são adapters finos sobre SDK externo; a garantia real vem do contrato do adapter (testado com rede
  mockada, seção 13) mais do que de cobertura de linha bruta sobre código majoritariamente delegado ao
  SDK.

Nenhum número fixo arbitrário é registrado aqui sem justificativa (regra explícita do prompt) — a
ORDEM de prioridade acima (security/financial > domain/application > repositories ≥ integration
adapters) é a política; os números exatos ficam para quando o CI for de fato configurado (fora do
escopo desta etapa).
```

---

## 7. Quality gates

```text
Gates obrigatórios antes de merge/deploy, em sequência:
install → lint → typecheck → unit tests → integration tests → contract tests → e2e (fluxos críticos) →
build → migration validation

ALL_GATES_BLOCKING:
SIM

Nenhum gate é "warning apenas" — um warning crítico (ex.: falha de lint numa regra de segurança, um
teste de contrato quebrado, uma migration que falha ao aplicar do zero) nunca é tratado como sucesso
silencioso; todo gate listado é bloqueante para merge/deploy, sem exceção configurável por conveniência.
```

---

## 8. Typecheck

```text
TYPECHECK_SEPARATE_GATE:
SIM

Confirmado como gate independente do build — mesmo padrão já fixado no doc63 (TYPECHECK_SEPARATE_FROM_
BUILD/NO_EMIT_TYPECHECK, não reaberto): um script "typecheck" dedicado (tsc --noEmit) roda como etapa
própria do pipeline, antes ou em paralelo ao build real, permitindo falhar rápido em erro de tipo sem
esperar a emissão completa de artefato.
```

---

## 9. Migration testing

```text
Migrations são testadas em PostgreSQL 17 limpo (via Testcontainers, seção 4), cobrindo:
- apply from zero: toda a sequência de migrations (Drizzle Kit + SQL manual, doc46) aplicada do zero
  numa instância efêmera, validando que não há dependência de estado pré-existente não declarado.
- schema resulting: o schema resultante após aplicar todas as migrations corresponde ao schema Drizzle
  declarado em TypeScript (fonte da verdade tipada, doc45/58) — nenhuma divergência silenciosa entre
  "o que o código Drizzle espera" e "o que as migrations realmente criaram".
- constraints: constraints únicas/compostas (doc45/47) presentes e funcionando conforme declarado.
- indexes: índices simples/compostos presentes conforme declarado.
- RLS: policies de RLS ativas e funcionais nas tabelas que as exigem (doc45/47/49/51) — verificação
  direta de que ENABLE ROW LEVEL SECURITY e as policies criadas via SQL manual controlado (doc46) estão
  de fato em vigor, não apenas presentes como arquivo de migration não aplicado corretamente.
- rollback strategy quando aplicável: se a estratégia de migration (doc46, não reaberta) incluir um
  mecanismo de rollback, esse mecanismo também é testado da mesma forma — esta etapa não decide se
  existe rollback (decisão do doc46), apenas que, se existir, deve ser coberto por teste.

Nenhuma migration foi executada nesta etapa (proibido pelo prompt) — apenas a estratégia de teste foi
definida.
```

---

## 10. RLS / Tenant isolation tests

```text
TENANT_ISOLATION_TESTS_REQUIRED:
SIM

Cobertura obrigatória (contra PostgreSQL real, nunca simulada):
- tenant A não consegue LER dado do tenant B (mesmo com uma query aparentemente válida, sem filtro
  explícito de tenant — validando que RLS pega o que a aplicação eventualmente deixasse passar, doc49).
- tenant A não consegue ESCREVER dado no tenant B.
- X-Tenant-ID sem membership válida é rejeitado (regra crítica já fixada no doc49 — o header é indício,
  nunca prova; testado tanto a nível de Guard/aplicação quanto, quando aplicável, a nível de RLS).
- constraints únicas cross-tenant se comportam corretamente (uma constraint única escopada por tenant
  não pode bloquear indevidamente 2 tenants distintos usando o mesmo valor, nem deixar de bloquear
  duplicidade dentro do MESMO tenant).
- RLS atua como defesa em profundidade — teste explícito de que, mesmo num cenário hipotético onde o
  filtro de aplicação falhasse, o RLS sozinho ainda impediria o vazamento (validação direta do princípio
  já fixado nos docs 45/47/49: RLS nunca substitui a validação de aplicação, mas deve ser comprovadamente
  capaz de segurar sozinho quando necessário).
```

---

## 11. Auth tests

```text
Cobertura obrigatória (doc49/doc66, não reabertos — aqui apenas convertidos em categoria de teste):
- JWT ausente → rejeitado
- JWT inválido (assinatura incorreta) → rejeitado
- JWT expirado → rejeitado, com distinção de erro específica (doc50: AUTH_TOKEN_EXPIRED)
- issuer incorreto → rejeitado
- audience incorreta → rejeitado
- cenário de rotação de JWKS (chave antiga revogada, nova chave ativa — validando que
  createRemoteJWKSet do jose, doc66, re-busca corretamente e não fica preso a uma chave obsoleta)
- usuário não encontrado (JWT válido, sem usuário interno correspondente, doc49) → rejeitado exceto em
  rota de bootstrap explicitamente marcada
- usuário inativo → rejeitado
- membership de tenant inválida → rejeitado
- permissão negada (permission coarse do módulo, doc49) → rejeitado com 403/PERMISSION_DENIED (doc50)
```

---

## 12. Async tests

```text
Cobertura obrigatória quando os recursos correspondentes forem implementados (não implementados nesta
etapa — apenas a categoria de teste é definida agora, doc67 não reaberto):
- job success (execução normal, efeito aplicado corretamente)
- retry (job falha de forma recuperável, é retentado conforme a política já definida no doc67)
- idempotency (reprocessamento do mesmo job, via singletonKey/handler-level check já definidos no
  doc67, não produz efeito duplicado)
- permanent failure (esgotamento de tentativas, job transiciona para "failed", observável, doc67/68)
- outbox (job enfileirado na mesma transação da escrita de negócio, doc67, sobrevive a um crash
  simulado após commit)
- worker crash/recovery (worker interrompido no meio do processamento de um job — o job não é perdido
  nem processado 2x de forma não-idempotente após o worker reiniciar)
- duplicate delivery (mesmo job entregue mais de uma vez ao worker — handler idempotente absorve sem
  efeito duplicado, mesma garantia da seção idempotency)
```

---

## 13. Mock policy

```text
MOCK_EXTERNAL_NETWORK:
SIM

Chamadas de rede a providers externos (Stripe, R2, Spotify/Meta/TikTok/Google/DocuSign, ACRCloud,
provedores de IA, etc., doc65/67) são mockadas em unit tests e na maior parte dos integration tests —
nenhum teste automatizado desta suíte depende de credencial real de produção nem de disponibilidade real
de um provider externo para passar (regra também já implícita no doc53 — testes nunca dependem de
secrets produtivos).

MOCK_DATABASE_FOR_INTEGRATION_TESTS:
NÃO

PostgreSQL nunca é mockado em teste de integração — sempre uma instância real via Testcontainers
(seção 3/4), pela mesma razão de fidelidade de RLS/constraints/transactions já registrada. Mocks de
banco são aceitáveis SOMENTE em unit tests puros de Domain/Application (onde o Repository Port é
substituído por um double simples, doc47 — a interface abstrata já existe exatamente para permitir
isso sem tocar Drizzle), nunca como substituto permanente do comportamento real de runtime em
integration/e2e.
```

---

## 14. Frontend contract

```text
ALL_FRONTEND_CONTRACT_TESTS_GREEN:
SIM

A apps/api-v2 só pode ser liberada para cutover quando os 250 endpoints HTTP e os 22 eventos realtime
já congelados (doc37) estiverem cobertos por teste de contrato e 100% verdes — não uma meta aspiracional,
um requisito de bloqueio de release (mesmo princípio de FRONTEND_AS_FUNCTIONAL_SPEC já fixado no doc62).
```

---

## 15. Versionamento

```text
TEST_RUNNER:
jest

TEST_RUNNER_VERSION:
30.4.2 (+ ts-jest 29.4.12 para transformação TypeScript)

HTTP_TEST_LIBRARY:
supertest

HTTP_TEST_LIBRARY_VERSION:
7.2.2

TESTCONTAINERS:
@testcontainers/postgresql 12.1.0 (+ testcontainers ^12.1.0)

COVERAGE_PROVIDER:
coverage nativo do Jest (istanbul/v8, configuração de provider não fixada nesta etapa — decisão de
detalhe de configuração, não de stack)
```

---

## Resumo

```text
UNRESOLVED_TEST_STACK_DECISIONS:
0
```

## Cobertura

Test runner decidido (Jest, justificado pelo alinhamento com o module system CommonJS já fixado no
doc63 e com o ecossistema oficial NestJS, não por continuidade do legacy) com evidência de que ts-jest
explicitamente não suporta TypeScript 7 — confirmando retroativamente a decisão do doc63 de evitar essa
versão. 4 tipos de teste obrigatórios definidos (unit/integration/contract/e2e) com o fluxo financeiro
do doc62 explicitamente incluído como exemplo obrigatório de e2e. Banco de teste fixado como PostgreSQL
17 real via Testcontainers (nunca SQLite), com justificativa específica de fidelidade a RLS/constraints/
transactions. HTTP testing via supertest. Política de cobertura diferenciada por criticidade (não um
único número global) definida com ordem de prioridade justificada. Gates de qualidade definidos como
100% bloqueantes, sem warning silencioso. Typecheck confirmado como gate separado (doc63 reafirmado).
Migration testing, RLS/tenant isolation tests, auth tests e async tests detalhados com escopo concreto.
Política de mock definida (rede externa mockada, banco real nunca mockado em integração). Contrato do
frontend confirmado como gate de bloqueio de cutover. Nenhum teste/config/banco de teste/CI foi criado
ou alterado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e Git não foram alterados.
Nenhuma outra parte da stack foi reavaliada. Nenhum documento anterior foi modificado.
