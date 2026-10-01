> Historical record. Kept as recorded; not the current contract.

# 51 — Estratégia de Transações da `apps/api-v2`

Definição read-only de como a `apps/api-v2` abre, propaga, confirma e reverte transações PostgreSQL via Drizzle ORM, sobre a decisão de acesso a banco já aprovada ([`45`](./45-api-v2-database-access-decision.md)), a arquitetura em camadas já aprovada ([`47`](./47-api-v2-layered-architecture.md)), o RequestContext já aprovado ([`49`](./49-auth-tenant-request-context.md)) e o modelo de erros já aprovado ([`50`](./50-api-v2-error-model.md)). Nenhum TransactionManager, repository, código Drizzle, banco, schema ou migration foi criado. `apps/api-v2` não foi criado. Nenhuma dependência foi instalada. `apps/web` e `apps/api` (legacy) não foram alterados.

## Decisões fixas (não reabertas)

```text
Database access: Drizzle ORM
Use cases: coordenam operações de aplicação
Controllers: não acessam banco diretamente
Repositories: encapsulam persistência
Domain: não depende de Drizzle
```

---

## Unidade transacional

```text
TRANSACTION_OWNER_LAYER:
Application / Use Case (doc47) decide QUANDO uma transação é necessária — é uma decisão de negócio
("esta operação precisa ser atômica?"), não uma decisão técnica de infraestrutura. Mas o Use Case NÃO
chama Drizzle diretamente (proibido pelo doc47) — ele decide através de um Port abstrato (Transaction
Manager Port, ver seção Transaction Context), cuja implementação concreta com `db.transaction()` do
Drizzle vive exclusivamente na camada Persistence, que é quem de fato abre/fecha a transação.

TRANSACTION_START:
O Use Case chama o Transaction Manager Port pedindo execução de um bloco de trabalho como unidade
atômica. A Persistence Adapter que implementa esse Port é quem efetivamente chama `db.transaction()`
do Drizzle — e, dentro dela, reaplica o primitivo de sessão RLS já definido nos docs 45/47/49
(`set_config('app.current_tenant_id', ...)` etc.) usando os valores de tenantId/userId/role do
RequestContext que o próprio Use Case recebeu (doc49) — o Use Case não precisa lembrar de fazer isso
separadamente, é parte do próprio ato de abrir a transação.

TRANSACTION_COMMIT:
Automático, ao final do bloco de trabalho, SOMENTE se ele completar sem lançar erro — nenhuma camada
chama "commit" explicitamente; é o comportamento nativo de `db.transaction()` (resolve → commit,
lança → rollback), mesmo modelo já usado no padrão RLS provado no legacy (doc45).

TRANSACTION_ROLLBACK:
Automático, sempre que o bloco de trabalho lançar qualquer erro — seja um erro de Domain/Application
(regra de negócio violada), seja um erro de infraestrutura traduzido pela própria Persistence (doc50).
Nenhum código de Application precisa chamar "rollback" explicitamente.
```

Esta divisão evita exatamente os 4 riscos citados no prompt: Controller nunca vê o Transaction Manager
Port (não pode abrir transação); só a Persistence Adapter que implementa o Port pode efetivamente
comitar (repository isolado não comita nada por conta própria — ver seção Repositories); o Transaction
Manager Port não permite que uma chamada aninhada abra uma SEGUNDA transação real dentro de uma já
aberta (ver Transaction Context); e o Use Case é, por definição desta regra, a ÚNICA camada com
controle sobre o início/fim da unidade atômica.

---

## Transaction Context

```text
TRANSACTION_CONTEXT_STRATEGY:
Um "Transaction Context" opaco (um handle/token sem membros visíveis para Application/Domain — não é o
objeto `tx` real do Drizzle, é um tipo abstrato definido no mesmo Port) é criado pela Persistence
Adapter no momento em que a transação Drizzle é aberta, e devolvido ao Use Case através do callback do
Transaction Manager Port. O Use Case então passa esse MESMO Transaction Context, explicitamente, como
parâmetro adicional em cada chamada de Repository (Porta) que precisa participar da mesma unidade
atômica:

Use Case
   ↓ chama
Transaction Manager Port .run(work)
   ↓ (implementado pela Persistence Adapter, que abre db.transaction() real e aplica SET LOCAL de RLS)
Transaction Context (opaco, devolvido ao "work")
   ├── Repository A .save(entity, txContext)
   ├── Repository B .save(entity, txContext)
   └── Repository C .save(entity, txContext)
   ↓
(work completa sem erro → commit automático | work lança erro → rollback automático)

REPOSITORY_TRANSACTION_PROPAGATION:
Cada método de escrita de um Repository Port aceita um parâmetro OPCIONAL de Transaction Context. A
Persistence Adapter que implementa esse Repository Port, ao receber um Transaction Context não-nulo,
"desembrulha" internamente o handle opaco de volta para o objeto `tx` real do Drizzle (só a Persistence
sabe fazer essa conversão — é o único lugar do sistema que conhece o tipo concreto por trás do handle)
e executa a query usando esse `tx`, garantindo que todas as escritas de A/B/C caiam na mesma transação
física do Postgres. Quando o parâmetro é omitido, a Persistence Adapter usa a conexão/pool padrão do
Drizzle Client, fora de qualquer transação explícita de negócio.
```

---

## Repositories

```text
COM transação (Transaction Context presente):
Repository usa o `tx` real do Drizzle desembrulhado do Transaction Context recebido — a query participa
da transação já aberta pelo Use Case corrente.

SEM transação (Transaction Context ausente):
Repository usa a conexão/pool padrão do Drizzle Client — comportamento de leitura simples, avaliado na
seção Leituras abaixo.

COMO ISSO NÃO EXPÕE DRIZZLE AO APPLICATION/DOMAIN:
O tipo do parâmetro "Transaction Context" que Application manipula é uma interface abstrata (mesmo
princípio de Repository Port do doc47) — Application nunca importa `drizzle-orm`, nunca vê o tipo `tx`
real, só recebe/repassa um handle opaco. A conversão handle↔tx real acontece inteiramente dentro da
Persistence, nunca cruzando para Application/Domain (mesma regra de fronteira já fixada no doc47 para
Repository Ports vs. Persistence Adapters).
```

---

## Atomicidade — quando transação é obrigatória

```text
O Use Case DEVE abrir uma transação (via o Transaction Manager Port) quando a operação envolver:

- múltiplas escritas dependentes (2+ repositories, ou 2+ chamadas de escrita, cujo resultado só faz
  sentido se todas ocorrerem juntas)
- write + audit log obrigatório (quando a própria regra de negócio exige que a escrita e seu registro
  de auditoria sejam indissociáveis — nenhuma escrita "sem rastro" é aceitável)
- write + outbox/event persistence (quando a persistência de um evento de domínio a ser publicado
  depois precisa estar garantidamente consistente com a escrita que o originou — ver seção Side
  Effects Externos)
- alterações de saldo/financeiro (qualquer leitura-modificação-escrita sobre um valor agregado
  compartilhado, ex.: saldo, contador, total — sujeita a condição de corrida sem atomicidade)
- mudanças de estado correlacionadas (quando 2+ entidades precisam transicionar de estado como uma
  unidade única, para nunca existir um estado intermediário observável de fora)
- operações cross-table que precisam ser atômicas (caso geral — qualquer operação cuja falha parcial
  deixaria o banco num estado inconsistente do ponto de vista do domínio)

Esta lista registra CRITÉRIOS, não operações de negócio específicas (nenhuma delas foi modelada ainda,
por instrução explícita do prompt) — cada futuro Use Case concreto avalia se se encaixa em 1+ destes
critérios para decidir se abre transação.
```

---

## Leituras — quando NÃO abrir transação de negócio

```text
Uma leitura simples (1 único Repository, 1 única operação de busca, sem escrita e sem exigência de
consistência com outra leitura/escrita) NÃO abre uma transação de negócio via o Transaction Manager
Port — usa a conexão/pool padrão do Drizzle Client diretamente (seção Repositories, caso "sem
transação"). Abrir uma transação de negócio para todo GET seria custo desnecessário de conexão/latência
sem nenhum ganho de atomicidade real, especialmente relevante dado o pooler transaction-mode do
Supabase já registrado no doc42 (connection_limit reduzido).

NOTA TÉCNICA IMPORTANTE (para não parecer contradizer o padrão RLS do doc45/47):
Isso não significa que uma leitura simples fica sem o primitivo de sessão RLS (`SET LOCAL
app.current_tenant_id`, etc.) — esse primitivo continua sendo aplicado pela Persistence Adapter em
TODA query, inclusive leituras, como um detalhe de implementação de baixo nível e de escopo mínimo
(o Postgres já envolve automaticamente cada statement isolado, fora de um BEGIN explícito, numa
transação implícita própria — a Persistence Adapter só precisa garantir que o `SET LOCAL` e a query
real caiam nessa MESMA transação implícita mínima, o que ela faz internamente sem que isso conte como
"o Use Case abriu uma transação de negócio"). A distinção é de CAMADA e de INTENÇÃO: transação de
negócio (Use Case, multi-repository, este documento) vs. micro-transação de sessão RLS por statement
(detalhe interno da Persistence, sempre presente, nunca decidida pelo Use Case).
```

---

## Isolation level

```text
DEFAULT_ISOLATION_LEVEL:
READ COMMITTED — o padrão nativo do PostgreSQL, usado sem escalonamento global por não haver nenhuma
exigência técnica comprovada que justifique um nível mais forte como padrão (regra explícita do
prompt).

ESCALATION_ALLOWED:
SIM — por transação individual, via um parâmetro opcional no Transaction Manager Port (não implementado
nesta etapa), nunca como mudança do padrão global.

ESCALATION_CASES:
- leitura-modificação-escrita sobre um valor agregado compartilhado sob risco real de concorrência
  (mesmo critério de "alterações de saldo/financeiro" da seção Atomicidade) — candidato a
  REPEATABLE READ ou SERIALIZABLE, decidido quando a operação específica for modelada, não aqui
- verificação de invariante multi-step onde uma leitura fantasma (phantom read) entre os passos
  invalidaria a decisão de negócio já tomada dentro da mesma transação
Nenhuma operação concreta é nomeada aqui — apenas os critérios que justificariam a escalada, por
instrução explícita do prompt de não inventar operações ainda não modeladas.
```

---

## Retries

```text
AUTOMATIC_TRANSACTION_RETRY:
SIM — mas estritamente limitado às classes de erro Postgres genuinamente transitórias/recuperáveis por
reexecução completa da transação.

MAX_RETRIES:
3 (com backoff curto entre tentativas — detalhe de implementação não definido nesta etapa)

RETRYABLE_ERRORS:
- serialization_failure (SQLSTATE 40001)
- deadlock_detected (SQLSTATE 40P01)

NON_RETRYABLE_ERRORS:
- violação de constraint única/composta (é um conflito real, não uma falha transitória — vira
  RESOURCE_CONFLICT no modelo de erro do doc50, nunca retentado silenciosamente)
- violação de check/foreign key constraint (erro real de dado, não transitório)
- falha de conexão/timeout de rede (não é retentada pelo Transaction Manager em si — é uma
  preocupação de camada de conexão/pool, fora do escopo desta política; vira INFRASTRUCTURE_ERROR)
- qualquer erro lançado por Domain/Application (regra de negócio violada) — retentar não mudaria o
  resultado, já que a causa não é uma condição de corrida do banco

RESTRIÇÃO OBRIGATÓRIA SOBRE O QUE PODE SER RETENTADO:
Como um retry reexecuta o bloco de trabalho INTEIRO desde o início (Postgres não permite retomar uma
transação abortada por serialization failure/deadlock a meio caminho), só é seguro habilitar retry
automático para blocos de trabalho que não contenham nenhum side effect externo irreversível dentro de
si — ver próxima seção, que é o motivo direto pelo qual essa restrição existe.
```

---

## Side effects externos

```text
REGRA OBRIGATÓRIA:
Nenhum side effect externo IRREVERSÍVEL (email, webhook, chamada a API externa que não seja o próprio
Postgres, upload externo, publicação em mensageria) pode ocorrer DENTRO do bloco de trabalho de uma
transação de negócio. Dois motivos concretos, ambos já cobertos por seções anteriores deste documento:
1. Rollback: se a transação reverter após o side effect já ter disparado, o sistema fica num estado
   inconsistente observável externamente (ex.: e-mail enviado, mas o registro que o originou não existe).
2. Retry: um bloco de trabalho retentado automaticamente (seção Retries) dispararia o mesmo side effect
   múltiplas vezes se ele estivesse dentro do bloco.

QUANDO USAR CADA ESTRATÉGIA FUTURA (nomeada, não implementada):
- post-commit action: o Use Case dispara o side effect SOMENTE depois que a chamada ao Transaction
  Manager Port retornar com sucesso (fora do bloco de trabalho) — adequado para side effects
  não-críticos, onde entrega "melhor esforço"/at-most-once é aceitável (ex.: uma notificação não
  essencial).
- outbox: dentro da MESMA transação de negócio, persiste-se um registro de "intenção de enviar" (uma
  escrita local no Postgres, portanto segura para estar dentro da transação e sujeita ao mesmo
  commit/rollback do resto) — um processo assíncrono separado lê esse registro depois e executa o
  side effect real. Adequado quando a entrega não pode ser silenciosamente perdida mesmo que o
  processo caia exatamente entre o commit e o disparo do side effect (ex.: webhook financeiro).
- idempotency: exigida no lado receptor de qualquer mecanismo "at-least-once" (outbox, ou qualquer
  retry de entrega) — sem uma chave de idempotência, uma reentrega gera duplicidade observável.
- compensation: quando o side effect externo JÁ ocorreu com sucesso (fora da transação, por post-commit
  action ou outbox) mas um passo posterior de um processo de negócio maior falha — a reversão não pode
  ser um rollback de banco (o sistema externo não participa da transação Postgres); precisa de uma ação
  de compensação explícita e própria (ex.: estornar em vez de reverter).

Nenhuma dessas estratégias é implementada nesta etapa — apenas nomeadas e associadas ao critério que
determina qual usar, conforme pedido pelo prompt.
```

---

## Cross-domain

```text
Quando um Use Case de um domínio precisa preservar atomicidade com uma operação de OUTRO domínio, ele
NÃO importa Repository/Domain/Persistence do outro domínio (proibido pelo doc47) — ele chama o Public
Application Service do outro domínio (mesmo mecanismo cross-domain já aprovado no doc47), passando
EXPLICITAMENTE o mesmo Transaction Context já aberto como parâmetro opcional dessa chamada. O Public
Application Service do domínio B, ao receber um Transaction Context não-nulo, o repassa para seus
próprios Repository Ports internos (exatamente como qualquer Use Case interno faria) — participando
assim da MESMA transação física, sem que o domínio A jamais veja como o domínio B usa esse contexto
internamente.

Esta propagação cross-domain de Transaction Context é reservada a casos onde atomicidade na MESMA
transação é um requisito de negócio genuíno e já evidenciado — não é o padrão default de comunicação
cross-domain (que continua sendo, na maioria dos casos já registrados nos docs 39-41, consistência
eventual via Domain Event, ex.: leads→artists, sem necessidade de transação compartilhada).
```

---

## Tenant

```text
O Transaction Context, no momento em que é criado pela Persistence Adapter, é vinculado de forma
IMUTÁVEL a exatamente o tenantId/userId/requestId do RequestContext (doc49) que estava ativo quando o
Use Case chamou o Transaction Manager Port — porque é exatamente esse conjunto de valores que alimenta
o `SET LOCAL app.current_tenant_id`/`app.current_org_id`/`app.current_role` no início da transação
Drizzle real (docs 45/47).

Nenhum código dentro do bloco de trabalho pode trocar o tenant de uma transação já aberta — não existe
operação exposta para isso. Se uma chamada cross-domain (ver seção acima) precisasse, por algum motivo
inválido, de um tenant DIFERENTE do da transação corrente, isso exigiria uma transação nova e separada
— nunca a mutação da já aberta. Esta é a garantia estrutural (não apenas de convenção) que impede troca
de tenant dentro da mesma unidade de trabalho.
```

---

## Erros

```text
Falhas na camada de transação são capturadas e traduzidas na própria Persistence, ANTES de cruzar para
Application/Domain/Controller — mesma fronteira e mesmo modelo de categorias já definidos no doc50:

- serialization_failure/deadlock_detected após esgotar as 3 tentativas de retry → INFRASTRUCTURE_ERROR
  (503) — é uma condição transitória de banco que não foi possível resolver, não um conflito de negócio
- violação de constraint única/composta → RESOURCE_CONFLICT (409), categoria já definida no doc50,
  reaproveitada sem alteração aqui
- falha de conexão/timeout ao abrir a transação → INFRASTRUCTURE_ERROR (503), mesma categoria já
  definida no doc50

Em nenhum caso o cliente recebe SQLSTATE bruto, texto de SQL, stack trace interno, ou informação de
connection string — mesma regra SAFE_CLIENT_MESSAGE / INTERNAL_LOG_CONTEXT já definida no doc50,
reaproveitada sem redefinição nesta etapa (a mensagem exposta ao cliente para estes 2 casos é sempre o
texto genérico fixo já registrado no doc50 para INFRASTRUCTURE_ERROR/RESOURCE_CONFLICT).
```

---

## Validação (respostas objetivas exigidas pelo prompt)

```text
Controller abre transaction?
NÃO

Use case pode coordenar transaction?
SIM

Repositories podem compartilhar a mesma transaction?
SIM

Domain conhece Drizzle transaction?
NÃO

Toda leitura abre transaction?
NÃO

Side effect externo irreversível pode ocorrer livremente antes do commit?
NÃO

Tenant pode mudar durante uma transaction?
NÃO
```

---

## Resumo

```text
UNRESOLVED_TRANSACTION_DECISIONS:
0
```

## Cobertura

Camada dona da transação, ciclo start/commit/rollback, estratégia de Transaction Context (handle
opaco compartilhado entre repositories via Port, sem expor Drizzle a Application/Domain), regra de
propagação em repositories, critérios de atomicidade obrigatória (6 categorias pedidas, sem inventar
operações de negócio), regra de leituras simples (com a nuance técnica de RLS por statement esclarecida
explicitamente), isolation level padrão com critérios de escalonamento, política de retry (2 classes de
erro retentáveis, restrição sobre side effects dentro do bloco retentável), regra de side effects
externos (4 estratégias futuras nomeadas), propagação cross-domain de Transaction Context via Public
Application Service, invariante de tenant imutável por transação, e tradução de erros de transação para
o modelo já aprovado no doc50 — todos definidos. Nenhum TransactionManager, repository, código Drizzle,
banco, schema ou migration foi criado. `apps/api-v2` não foi criado. Nenhuma dependência foi instalada.
`apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.
