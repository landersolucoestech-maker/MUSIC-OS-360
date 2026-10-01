> Historical record. Kept as recorded; not the current contract.

# 62 — Regras de Preservação Comportamental e Consistência Entre Módulos

Definição read-only das regras obrigatórias para que a reconstrução da `apps/api-v2` preserve o comportamento funcional já congelado, sobre o contrato canônico (doc37), o inventário e mapa de dependências de domínios (docs 38/39/41), a arquitetura em camadas (doc47) e a estratégia transacional (doc51) já aprovados — nenhum reaberto aqui. Nenhum código, schema, migration ou dependência foi criado/alterado. Nenhum event bus/queue foi escolhido. Nenhum P&L/transaction foi implementado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy) e Git não foram alterados.

## Evidência decisiva encontrada (fonte primária, "regra explicitamente fornecida")

Consulta ao frontend (autorizada pelo prompt "para confirmar comportamento existente") encontrou 2
arquivos de governança já existentes no próprio código do frontend, que são a fonte de verdade mais
direta possível para esta etapa — não inferência, declaração explícita:

```text
apps/web/src/shared/governance/flows.ts
  → "Fluxos Operacionais Canónicos" — 10 fluxos de negócio (F01-F10) documentados como cruzando 2+
  módulos, com a regra do próprio arquivo: "qualquer novo fluxo que atravesse 2+ módulos deve ser
  documentado aqui antes de ser implementado". F04 "Ciclo Financeiro (Transação → P&L)" é
  EXATAMENTE o exemplo obrigatório desta etapa, já documentado como requisito de negócio pré-existente,
  não inventado por esta auditoria.

apps/web/src/shared/governance/modules.ts
  → "Registo Canónico de Módulos" (MODULE_REGISTRY) — cada módulo declara explicitamente "dependsOn"
  (módulos dos quais lê dados) e "consumedBy" (módulos que consomem seus dados), com a regra do próprio
  arquivo: "nenhum módulo novo pode ser adicionado ao sistema sem ser primeiro registado aqui, com
  todas as propriedades preenchidas". É a fonte de verdade primária usada abaixo para validar (ou
  descartar) cada relação candidata listada pelo prompt.
```

---

## Regra principal

```text
A reconstrução da apps/api-v2 PODE alterar livremente: framework interno, ORM, schema interno,
estrutura de módulos, implementação, infraestrutura (já decidido nos docs 45/47/58/59/60/61, não
reaberto).

A reconstrução da apps/api-v2 NÃO PODE alterar silenciosamente: comportamento funcional visível, fluxos
de negócio (os 10 já documentados em flows.ts, e qualquer outro comprovável pelo contrato/código atual),
efeitos entre módulos (declarados em modules.ts), contratos consumidos pelo frontend (doc37, 250
endpoints/22 eventos realtime), estado resultante esperado pelo usuário.
```

---

## Exemplo obrigatório — Transação → Contabilidade

```text
Requisito de negócio (registrado verbatim, com evidência de que já é o comportamento canônico
documentado, F04 de flows.ts):

Quando o usuário registrar uma DESPESA na página/módulo de TRANSAÇÕES e vincular um artista cadastrado,
a operação deve:

1. persistir a despesa corretamente;
2. manter o vínculo com o artista;
3. renderizar a transação como despesa concluída conforme o fluxo funcional;
4. refletir automaticamente essa despesa no módulo/página de Contabilidade / Profit & Loss;
5. não exigir lançamento manual duplicado no P&L;
6. não permitir divergência entre Transações e Contabilidade.

EVIDÊNCIA: F04 (flows.ts) já documenta exatamente este comportamento como canônico — step 1
("Registar transação... Vincular a artista e/ou projecto para P&L segmentado", ator: Gestor
Financeiro) seguido do step 3 ("Recalcular P&L por artista e por projecto", ator: Sistema, não o
usuário) — ou seja, a recomputação do P&L já é modelada como uma consequência AUTOMÁTICA e do SISTEMA,
não uma segunda ação manual do usuário. MODULE_REGISTRY (modules.ts) confirma estruturalmente: "Transacao"
e "NotaFiscal" são as primaryEntities do MESMO módulo "accounting" ao qual P&L pertence — Transação e
P&L não são domínios separados que precisam de sincronização entre si, são a MESMA fonte de dado vista
de duas formas (registro bruto vs. projeção agregada).

IMPLICAÇÃO PARA A API V2: P&L/Contabilidade não pode ser um segundo registro persistido
independentemente da Transação — deve ser uma DERIVAÇÃO da mesma fonte canônica (Transacao), calculada
sob demanda ou mantida sincronizada por um mecanismo confiável (a técnica exata — query direta,
projection, domain event, outbox, materialized view, read model — não é decidida aqui, conforme
instrução explícita do prompt).
```

---

## Consistência cross-domain — regra geral e relações validadas

```text
REGRA GERAL: uma relação de consistência cross-domain só é registrada aqui com evidência direta de
MODULE_REGISTRY (dependsOn/consumedBy) e/ou de um Fluxo Operacional Canônico (flows.ts) — nenhuma
relação foi inventada além do que essas 2 fontes já declaram.
```

```text
RELAÇÃO: Transaction → Accounting/P&L
STATUS: CONFIRMADA — mas é uma relação INTRA-domínio, não cross-domain: Transacao e o P&L pertencem ao
  mesmo módulo "accounting" (MODULE_REGISTRY, primaryEntities). Ver seção Exemplo Obrigatório acima.
NATUREZA: consistência forte, mesma fonte de verdade, automática (não é integração entre domínios, é
  integridade dentro de 1 domínio).

RELAÇÃO: Contract → Accounting
STATUS: CONFIRMADA — MODULE_REGISTRY, accounting.dependsOn inclui "contracts" (modules.ts:128).
NATUREZA: rastreabilidade/consumo de dado, não propagação automática de escrita — os Fluxos Operacionais
  (F03 Ciclo de Contrato, F09 Licenciamento) mostram que o lançamento financeiro decorrente de um
  contrato/licença é uma AÇÃO DELIBERADA do Gestor Financeiro ("Registar receita de licenciamento",
  step 5 de F09), referenciando o contrato/licença de origem — não um gatilho automático disparado
  pela assinatura do contrato em si. Nenhuma evidência de propagação automática Contract→Transacao foi
  encontrada; portanto NÃO se registra aqui uma regra de atomicidade obrigatória entre "assinar
  contrato" e "criar transação" (isso seria inventar comportamento não evidenciado).

RELAÇÃO: Release → Artist
STATUS: CONFIRMADA — MODULE_REGISTRY, releases.dependsOn inclui "artists" (modules.ts:96) — um
  Lançamento sempre referencia um Artista existente.
NATUREZA: dependência de dado (o Lançamento não existe sem um Artista válido já cadastrado), confirmada
  também pelo Fluxo F02 (Lançamento Musical) que pressupõe artista/catálogo já registrados como
  pré-condição.

RELAÇÃO: Project → Financial records
STATUS: CONFIRMADA — MODULE_REGISTRY, accounting.dependsOn inclui "projects" (modules.ts:128), e F04
  confirma explicitamente "Vincular a artista e/ou projecto para P&L segmentado" — P&L pode ser
  segmentado por Projeto, exatamente como por Artista.
NATUREZA: mesma natureza de Transaction→Accounting (rastreabilidade + segmentação de P&L), não
  propagação automática de escrita a partir do módulo Projects.

RELAÇÃO: Invoice/payment → Accounting
STATUS: CONFIRMADA como relação INTRA-domínio — "NotaFiscal" é primaryEntity do próprio módulo
  "accounting" (modules.ts:127), assim como "Transacao". Não existe um módulo "invoices"/"billing"
  separado no MODULE_REGISTRY do frontend para faturamento de tenant — nota fiscal já É parte do
  domínio accounting, mesma relação que Transaction→P&L.
NATUREZA: mesma fonte de verdade, consistência forte (mesmo raciocínio do Exemplo Obrigatório).

OUTRAS RELAÇÕES CONFIRMADAS POR MODULE_REGISTRY (registradas por completude, não solicitadas
explicitamente pelo prompt, mas evidenciadas pela mesma fonte primária já consultada):
- accounting.dependsOn também inclui "artists" (além de contracts/projects já citados)
- releases.consumedBy inclui "accounting" (dado de lançamento também alimenta relatórios financeiros)
- contracts.consumedBy inclui "accounting", "artists", "releases"
- events.consumedBy inclui "accounting" | inventory.consumedBy inclui "accounting" | hr.consumedBy
  inclui "accounting" | licensing.consumedBy inclui "accounting" — ou seja, accounting é
  estruturalmente um CONSUMIDOR terminal de dado de praticamente todo o resto do sistema
  (accounting.consumedBy = [] — nada consome accounting de volta, é um "sink" de dado financeiro, nunca
  uma fonte para outro domínio de negócio)
```

---

## Source of truth

```text
PRINCÍPIO: toda informação de negócio possui exatamente UMA fonte canônica de verdade. Views,
dashboards, relatórios e P&L PODEM derivar dessa fonte, mas NUNCA constituem uma segunda fonte
independente do mesmo fato de negócio.

EVITAR (verbatim do prompt, reforçado com a evidência acima):
- duplicação independente de registros (ex.: uma "despesa" persistida tanto em Transacao quanto num
  registro próprio de P&L)
- sincronização manual (o usuário nunca deveria precisar "lançar no P&L" depois de já ter lançado a
  Transação — F04 já modela a recomputação como ação do Sistema, não do usuário)
- mesma despesa persistida duas vezes sem necessidade
- estado divergente entre módulos (Transações e Contabilidade nunca podem mostrar números diferentes
  para o mesmo período/entidade)

NÃO DECIDIDO AQUI (conforme instrução explícita do prompt): se a implementação da apps/api-v2 usará
query direta, projection, domain event, outbox, materialized view ou read model para materializar essa
derivação — decisão adiada para quando cada caso for modelado em detalhe.
```

---

## Atomicidade

```text
BUSINESS_ATOMICITY_REQUIRED: SIM — aplicável especificamente ao caso onde falha parcial geraria estado
  inválido observável pelo usuário, conforme a estratégia transacional já aprovada (doc51, não
  reaberto):

- Persistir uma Transacao + qualquer efeito colateral local que a mesma unidade de trabalho precise
  garantir (ex.: write + audit log obrigatório, já um dos critérios de atomicidade obrigatória do
  doc51) — se a auditoria dessa transação for exigida, não pode existir um estado onde a Transacao
  exista mas o registro de auditoria correspondente não.
- Qualquer operação que precise atualizar 2+ registros correlacionados como uma unidade (ex.: alteração
  de saldo/financeiro, já critério do doc51) dentro do próprio domínio accounting.

BUSINESS_ATOMICITY_REQUIRED: NÃO aplicável à derivação do P&L a partir da Transação em si, SE a
  estratégia de leitura escolhida futuramente for uma projeção calculada sob demanda a partir da mesma
  fonte (nesse caso não há "segundo estado" a manter atômico com o primeiro, porque não existe um
  segundo registro — é a mesma regra do Source of Truth acima). Caso a estratégia futura escolhida seja
  uma materialização física separada (read model/materialized view), essa futura decisão precisará
  então reavaliar se BUSINESS_ATOMICITY_REQUIRED passa a SIM para aquele mecanismo específico — não
  decidido nesta etapa.
```

---

## Eventual consistency

```text
Eventual consistency só pode ser usada quando TODAS as 5 condições abaixo forem verdadeiras
simultaneamente (verbatim do prompt, não é o padrão default):

1. o negócio tolerar atraso;
2. o frontend tolerar atraso (nenhuma tela do contrato congelado, doc37, espera atualização
   instantânea síncrona no mesmo request para o dado em questão);
3. houver mecanismo confiável de retry/recovery;
4. não gerar informação financeira incorreta (EXCLUI explicitamente Transaction→P&L do uso de eventual
   consistency de forma displicente — qualquer atraso ali que resulte em um P&L temporariamente
   incorreto exibido ao usuário viola esta condição, a menos que o atraso seja imperceptível/dentro de
   tolerância explicitamente documentada);
5. estiver explicitamente documentada (nenhuma consistência eventual pode ser adotada silenciosamente
   — precisa constar de um documento de decisão futuro específico do caso, mesmo padrão de rigor já
   praticado em toda esta série de documentos).

Nenhuma relação cross-domain desta etapa foi pré-aprovada para eventual consistency — cada caso futuro
precisará justificar as 5 condições individualmente.
```

---

## Financeiro

```text
PRINCÍPIO: "Financial source records must remain traceable."

Toda informação exibida em Profit & Loss, Accounting, relatórios financeiros deve poder ser rastreada
até sua origem — exemplo já validado pela evidência desta etapa:

P&L expense → transaction (Transacao, primaryEntity de accounting) → linked artist (referência a
Artista, MODULE_REGISTRY: accounting.dependsOn inclui artists) e/ou linked project (referência a
Projeto, MODULE_REGISTRY: accounting.dependsOn inclui projects) → original operation (quando aplicável
— ex.: a receita ECAD do Fluxo F08 é rastreável até o relatório ECAD importado que a originou, mesmo
sendo lançada manualmente como Transação).

Esta rastreabilidade é uma propriedade do MODELO de dado (referências explícitas preservadas), não uma
feature de UI — deve estar disponível na apps/api-v2 independentemente de qual tela a exibe.
```

---

## Frontend congelado

```text
FRONTEND_AS_FUNCTIONAL_SPEC:
SIM

Durante a reconstrução: o backend deve adaptar-se ao contrato funcional já aprovado (doc37, 250
endpoints/22 eventos realtime, mais os 10 Fluxos Operacionais Canônicos e o MODULE_REGISTRY desta
etapa); o frontend não deve ser redesenhado para compensar deficiência da API v2. Mudança de frontend
somente poderá ocorrer posteriormente por decisão funcional explícita, não por conveniência de
reconstrução — mesma regra já aplicada consistentemente em toda a série de documentos desde o doc36
("FRONTEND_CONTRACT_WINS").
```

---

## Stack

```text
STACK_MUST_SUPPORT_BUSINESS_BEHAVIOR:
SIM

A stack já decidida para a apps/api-v2 (NestJS 11.1.28, Drizzle, PostgreSQL 17/Supabase, modelo
transacional do doc51, deployment long-running do doc61) deve ser avaliada — não nesta etapa, apenas
registrado o princípio — também pela capacidade de suportar corretamente: transactions (doc51, já
suporta), cross-domain coordination (doc47, Public Application Service/Domain Event, já suporta),
financial consistency (Source of Truth desta etapa, compatível com a arquitetura em camadas já
aprovada), background processing (doc61, modelo long-running já escolhido exatamente por isso),
integrations (doc47, Integrations layer), auditability (doc52, logging estruturado + doc51 write+audit
log como critério de atomicidade obrigatória), tenant isolation (doc45/47/49, RLS + enforcement de
aplicação), observability (doc52). Nenhuma reavaliação de stack foi feita nesta etapa — apenas
confirmado que nada nesta regra contradiz o que já foi decidido.
```

---

## Domain completion rule

```text
DOMAIN_COMPLETE_ONLY_IF_CROSS_DOMAIN_BEHAVIOR_PASSES:
SIM

Um domínio não é considerado concluído apenas porque seus endpoints isolados funcionam, quando esse
domínio possuir dependências funcionais declaradas em MODULE_REGISTRY (dependsOn/consumedBy) ou
participar de um Fluxo Operacional Canônico (flows.ts). Exemplo direto desta etapa: "endpoint de
Transaction PASS" não é suficiente critério de conclusão do domínio accounting se o P&L não refletir
corretamente a transação (Exemplo Obrigatório acima) — o domínio accounting só está de fato completo
quando a consistência Transaction↔P&L, e a rastreabilidade até artists/contracts/projects (suas
dependências declaradas), também passam.
```

---

## Testes futuros (categorias, não implementados)

```text
Deverão existir testes futuros (não criados nesta etapa) para:
- endpoint contract (conformidade com o contrato canônico, doc37)
- domain behavior (regras de negócio internas de cada domínio, doc47)
- transactional consistency (doc51 — atomicidade, rollback, retry)
- cross-domain behavior (as relações validadas nesta etapa — accounting↔artists/contracts/projects,
  releases↔artists, e o caso central Transaction↔P&L)
- financial projection/read behavior (qualquer mecanismo de derivação de P&L futuramente escolhido —
  query direta/projection/domain event/outbox/materialized view/read model)
- tenant isolation (doc45/47/49/51 — nenhuma leitura/escrita cross-tenant, RLS + enforcement de
  aplicação)
```

---

## Resumo

```text
UNRESOLVED_BEHAVIOR_PRESERVATION_DECISIONS:
0
```

## Cobertura

Regra principal, exemplo obrigatório (Transação→Contabilidade, confirmado como já canônico via F04 de
flows.ts), regra geral de consistência cross-domain com as 5 relações candidatas do prompt validadas
individualmente contra evidência primária real (MODULE_REGISTRY/flows.ts) — nenhuma inventada, 2
reclassificadas corretamente como intra-domínio (Transaction→P&L, Invoice/payment→Accounting) em vez de
cross-domain — princípio de fonte única de verdade, atomicidade, eventual consistency (5 condições),
rastreabilidade financeira, frontend congelado como especificação funcional, stack avaliada por
capacidade de suportar comportamento de negócio (sem reavaliar a stack em si), regra de conclusão de
domínio dependente de comportamento cross-domain, e categorias de testes futuros — todos definidos.
Nenhum código, schema, migration, event bus, queue, P&L ou transaction foi implementado. `apps/api-v2`
não foi criado. `apps/web`, `apps/api` (legacy) e Git não foram alterados. Nenhum documento anterior foi
modificado.
