> Historical record. Kept as recorded; not the current contract.

# 74 — Contrato Zero-Gap da Reconstrução Completa do Backend

Definição read-only dos critérios obrigatórios de completude e rastreabilidade que governarão toda a reconstrução da `apps/api-v2` daqui em diante, sobre o contrato canônico do frontend (doc37), as regras de preservação comportamental (doc62), a arquitetura em camadas (doc47), o fluxo de auth/tenant (doc49) e o namespace de banco (doc73), nenhum reaberto aqui. Este documento não implementa nada — é o CRITÉRIO DE ACEITE que toda etapa futura de reconstrução de domínio deverá satisfazer antes de ser considerada concluída. Nenhuma tabela, migration, schema, componente, hook ou export foi criado/alterado. Nenhum banco (local ou remoto) foi alterado. Supabase não foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados. Git não foi modificado.

## Princípio central

```text
Tudo que o sistema atual realmente utiliza deve possuir correspondência explícita na reconstrução.
Endpoint compilar, teste isolado passar ou schema existir NÃO são, isoladamente, critério de conclusão.
Nada desaparece por omissão — todo item candidato à eliminação precisa de classificação explícita
(seção "Não preservar lixo"), nunca de silêncio.
```

---

## 1. Database — cobertura total

```text
EVERY_REQUIRED_DATABASE_FIELD_ACCOUNTED_FOR:
SIM

Antes de reconstruir cada domínio (ordem já fixada no doc41), o schema v2 correspondente (namespace
`app`, doc73) deve ter, para cada tabela legacy relevante àquele domínio, inventário explícito de:
tabelas, colunas, tipos, nullability, defaults, PKs, FKs, unique constraints (simples e compostas),
indexes, check constraints, RLS/policies, functions, triggers, views/materialized views, enums,
referências de storage e dependências de realtime.

O schema v2 PODE ser redesenhado (doc58/45, já decidido — nenhuma obrigação de espelhar TypeORM 1:1).
O que não pode ocorrer é a PERDA de um dado ou comportamento que o sistema atual realmente usa, sem uma
decisão explícita de eliminação (seção 23).
```

---

## 2. Rastreabilidade obrigatória Form → Banco → API → Tela

```text
FORM_TO_DATABASE_TRACEABILITY_DEFINED:
SIM

Cadeia obrigatória para todo campo funcional real:

FORM FIELD → HTTP CONTRACT → APPLICATION INPUT → DOMAIN/BUSINESS RULE → DATABASE FIELD →
READ MODEL/RESPONSE → TABLE/SCREEN

Nenhum campo real de formulário pode ficar sem destino conhecido nessa cadeia. Nenhuma coluna
persistida necessária ao comportamento atual pode desaparecer da resposta HTTP sem justificativa
registrada (classificação da seção 23).
```

---

## 3. Create / Edit — paridade campo a campo

```text
Para cada form/modal de criação/modal de edição/drawer/wizard funcionalmente ativo, rastreamento
obrigatório por campo:

FIELD_NAME / CREATE_SUPPORTED / EDIT_SUPPORTED / PERSISTED / VALIDATED / RETURNED / RENDERED

Divergência REAL entre comportamento de Create e Edit (ex.: um campo editável só na edição, um campo
imutável após criação) deve ser DOCUMENTADA explicitamente no momento da reconstrução daquele domínio —
nunca silenciosamente unificada nem silenciosamente diferenciada.
```

---

## 4. Colunas de tabelas/grids — rastreabilidade obrigatória

```text
TABLE_COLUMN_TRACEABILITY_DEFINED:
SIM

Para cada tabela/grid visível no frontend, cada coluna individualmente:

SCREEN / COLUMN / SOURCE (database | derived | relation | external integration) / SOURCE_FIELD /
CREATE_FORM_FIELD / EDIT_FORM_FIELD / API_RESPONSE_FIELD / SORTABLE / FILTERABLE / SEARCHABLE

REGRA CRÍTICA: colunas devem representar campos reais e comportamento funcional já existente daquela
entidade — proibido criar tabela genérica sem correspondência com os formulários existentes, e proibido
remover uma coluna necessária apenas porque o schema v2 usa estrutura diferente (redesenho de schema não
é licença para perda funcional silenciosa).
```

---

## 5. Campos derivados

```text
DERIVED_FIELD_SOURCE_DOCUMENTED:
SIM

Uma coluna/campo de resposta pode ser derivado (ex.: artist.name via relation, status label, calculated
amount, aggregated P&L value) — mas sua origem (de qual tabela/relação/cálculo deriva, e em que camada é
calculado: query, Application, ou read model) deve ser explícita no momento em que aquele domínio for
reconstruído. Nenhum campo aparece "magicamente" sem fonte registrada.
```

---

## 6. Auditoria de componentes frontend

```text
COMPONENT_AUDIT_REQUIRED:
SIM

Todo componente funcionalmente relevante do frontend congelado (doc62: FRONTEND_AS_FUNCTIONAL_SPEC)
classificado como: DATA_CONSUMER / FORM / TABLE / MODAL / FILTER / SEARCH / UPLOAD / IMPORT / EXPORT /
REALTIME_CONSUMER / STATIC_UI / DEAD.

Todo componente que consome comportamento de backend (qualquer classificação exceto STATIC_UI/DEAD) deve
possuir contrato HTTP/realtime correspondente já mapeado (doc37) ou identificado como gap a resolver
antes do domínio ser considerado concluído.
```

---

## 7. Auditoria de hooks

```text
HOOK_AUDIT_REQUIRED:
SIM

Todo hook funcionalmente relevante, sem exceção, com ficha própria:

HOOK / DOMAIN / READS_API / WRITES_API / REALTIME / STORAGE / LOCAL_ONLY / BACKEND_REQUIREMENT

Um hook marcado LOCAL_ONLY: SIM ainda precisa de justificativa (por que não requer backend) — não é uma
categoria de escape para pular análise, é uma conclusão que também precisa ser sustentada.
```

---

## 8-9. Import/Export e regra XLSX

```text
IMPORT_EXPORT_TRACEABILITY_DEFINED:
SIM

Toda funcionalidade de import/export (CSV, XLSX, PDF, outros formatos em uso) verificada quanto a: campos
exportados, ordem das colunas, headers, tipos, formatação de datas, valores monetários, relations
resolvidas, filtros aplicados no momento da exportação, e isolamento de tenant (nenhum export pode
vazar dado cross-tenant).

XLSX_MAX_SHEETS:
2

Nenhum arquivo XLSX gerado pelo sistema pode ter mais que 2 abas. Uma exportação que aparente precisar de
múltiplos conjuntos de dados deve ser modelada para caber em no máximo 2 abas sem perda funcional (ex.:
dados principais em uma aba, detalhamento/legenda na segunda) — proibido criar uma aba por entidade
arbitrariamente como atalho de modelagem.
```

---

## 10. Import XLSX — verificação obrigatória

```text
Para cada fluxo de import, verificação explícita de: sheet utilizada, headers esperados, mapping de
colunas, campos obrigatórios, validação, tratamento de duplicidade, relatório de erro, política de falha
parcial (todo-ou-nada vs. parcial-com-relatório) e comportamento transacional, e atribuição de tenant à
linha importada.

Import silenciosamente incompleto (algumas linhas persistidas sem indicar quais falharam, ou sem
reportar por quê) não é aceitável em nenhum domínio.
```

---

## 11. Authentication — cobertura integral

```text
AUTH_FULL_COVERAGE_REQUIRED:
SIM

Supabase Auth, login, signup (quando existente no fluxo atual), logout, password reset, confirmação de
email, JWT, JWKS, refresh de sessão, redirects, Site URL/Redirect URLs, SMTP, resolução de usuário
interno (doc49) e usuários inativos — nenhum fluxo hoje ativo pode ser perdido na reconstrução. Mecanismo
já definido no doc49 (JWKS/ES256, RequestContext), não reaberto aqui — esta seção apenas fixa que a
COBERTURA de todos os sub-fluxos é obrigatória, não apenas o caminho feliz de login.
```

---

## 12. Authorization / Tenant

```text
Tenant membership, roles, permissions, route guards, action guards, RLS, tenant context, proteção
cross-tenant — todos cobertos, com a mesma regra já fixada e não reaberta no doc49: o frontend nunca é
fonte de autoridade (tenant_id/role/permission enviados pelo cliente são indício, nunca prova; a prova
vem sempre da resolução server-side via JWT → tenant → membership).
```

---

## 13. Realtime

```text
REALTIME_FULL_COVERAGE_REQUIRED:
SIM

Os 22 eventos realtime já catalogados (doc37/33), seus channels, publishers, subscribers, payloads,
isolamento de tenant e requisitos de auth — nenhum evento desaparece da reconstrução sem uma decisão
explícita registrada (não por omissão). Superfície de autorização de Realtime permanece separada do
RequestContext HTTP, conforme já fixado e não reaberto no doc49.
```

---

## 14. Storage

```text
STORAGE_FULL_COVERAGE_REQUIRED:
SIM

Uploads, downloads, delete, signed URLs, bucket, convenção de path, metadata, isolamento de tenant e
permissões, e toda referência de arquivo persistida em banco (foreign key lógica entre registro de
domínio e objeto de storage) — todo o CICLO DE VIDA precisa ser preservado, não apenas o caminho de
"upload funciona". Um domínio com upload funcionando mas sem delete/download/permissão equivalente ao
sistema atual não está concluído.
```

---

## 15. Edge Functions / Serverless

```text
EDGE_FUNCTION_VERIFICATION_REQUIRED:
SIM

Toda Supabase Edge Function, function serverless (Vercel) ou equivalente hoje em uso deve ser
explicitamente classificada: ACTIVE / LEGACY / DEAD / MIGRATE_TO_API_V2 / KEEP_EXTERNAL — antes de
qualquer decisão sobre reconstruir, descartar ou preservar externamente. Ausência de function ativa não
pode ser presumida sem verificação; se, após verificação, nenhuma estiver ativa, isso é registrado
explicitamente:

ACTIVE_EDGE_FUNCTIONS:
0 (valor de exemplo — a etapa de verificação real determinará o número, não presumido aqui)
```

---

## 16. Integrações

```text
INTEGRATION_FULL_COVERAGE_REQUIRED:
SIM

Para cada integração externa em uso (Stripe, ACRCloud, Spotify/Meta/TikTok/Google/DocuSign, Resend, R2,
provedores de IA, PostHog, etc., já inventariados no doc42): provider, modelo de auth, ownership por
tenant vs. plataforma (doc53, distinção já fixada), credenciais, webhooks, chamadas de API, sincronização,
retry, rate limits, tratamento de erro, storage e observabilidade associados.

Toda integração deve ser classificada como: OFFICIAL_API / OFFICIAL_AUTH / STATIC_LINK / PLACEHOLDER /
UNSUPPORTED — proibido criar uma integração fake/simulada apresentada como funcional.
```

---

## 17. Observabilidade

```text
Cobertura de HTTP, database, transactions, integrations, jobs, workers, webhooks, errors, respostas 5xx,
operações lentas, e correlação tenant/request — observabilidade não é considerada concluída apenas
porque Pino/Sentry/OpenTelemetry (doc68, já decidido) foram instalados como dependência; a cobertura
FUNCIONAL de cada uma dessas superfícies precisa ser verificada domínio a domínio.
```

---

## 18. Comportamento cross-domain

```text
CROSS_DOMAIN_VALIDATION_REQUIRED:
SIM

Cada fluxo cross-domain (doc62, ex.: despesa em Transações → vínculo com artista → persistência →
reflexo automático em Contabilidade/P&L → rastreabilidade até a transação original) deve ser validado
PONTA A PONTA. Endpoint isolado retornando 2xx não é, por si só, prova de que o domínio está concluído —
mesma regra já fixada no doc62 (DOMAIN_COMPLETE_ONLY_IF_CROSS_DOMAIN_BEHAVIOR_PASSES).
```

---

## 19. Relações entre entidades

```text
Toda relação usada pelo frontend (artist, project, contract, transaction, accounting, release, invoice,
relationship, integration, etc.) deve ser verificada contra uma relação persistente/canônica
correspondente no schema v2. Nenhum selector/autocomplete do frontend pode apontar para uma entidade sem
relação real por trás — um combo que hoje lista "artistas" precisa, na reconstrução, continuar resolvendo
contra a tabela/relação real de artistas, nunca um placeholder.
```

---

## 20. Estados obrigatórios por fluxo

```text
Para cada fluxo funcional: empty state, loading state, error state, comportamento not-found, permission
denied, erros de validação, conflito (409/duplicidade), paginação, filtros, ordenação e busca — todos
preservados. Um domínio reconstruído sem tratamento de algum desses estados (ex.: sem empty state
correspondente ao que o frontend já espera renderizar) não está concluído, mesmo que o caminho feliz
funcione.
```

---

## 21. Matriz de rastreabilidade obrigatória

```text
Durante a reconstrução de CADA domínio, deve existir uma matriz com as colunas:

SCREEN | COMPONENT | HOOK | ENDPOINT | REQUEST FIELD | RESPONSE FIELD | FORM FIELD | TABLE COLUMN |
DATABASE TABLE | DATABASE COLUMN | RELATION | PERMISSION | TENANT RULE | REALTIME EVENT | IMPORT FIELD |
EXPORT FIELD | TEST | STATUS

Esta matriz é o artefato de verificação que sustenta a alegação de "domínio concluído" — não uma
formalidade opcional. O formato exato do artefato (planilha, tabela em doc markdown, etc.) é decidido
quando cada domínio for de fato reconstruído; o que é obrigatório aqui é que ela EXISTA e cubra todas as
colunas listadas.
```

---

## 22. Zero unknown antes do cutover

```text
ZERO_UNMAPPED_REQUIRED_FOR_CUTOVER:
SIM

Antes do cutover, todos os seguintes contadores devem estar em zero:

UNMAPPED_FORM_FIELDS: 0
UNMAPPED_TABLE_COLUMNS: 0
UNMAPPED_ACTIVE_HOOKS: 0
UNMAPPED_ACTIVE_COMPONENTS: 0
UNMAPPED_HTTP_CONTRACTS: 0
UNMAPPED_REALTIME_EVENTS: 0
UNMAPPED_DATABASE_REQUIREMENTS: 0
UNMAPPED_IMPORT_EXPORT_FIELDS: 0
UNRESOLVED_ACTIVE_INTEGRATIONS: 0

Um item só sai dessa contagem por mapeamento completo (rastreado na matriz da seção 21) ou por
classificação explícita como elimindo (seção 23) — nunca por decurso de prazo ou omissão silenciosa.
```

---

## 23. Não preservar lixo — classificação obrigatória para eliminação

```text
Rastreabilidade total NÃO significa copiar tudo do legacy indiscriminadamente. Todo item candidato a não
ser reconstruído deve ser classificado explicitamente como um dos seguintes, com evidência, antes de ser
descartado:

REQUIRED        — usado pelo sistema atual, deve ser reconstruído.
REPLACED        — funcionalidade preservada, mecanismo técnico trocado (ex.: novo schema, novo endpoint
                  shape justificado por doc37/62).
DERIVED         — não persiste diretamente, é calculado a partir de outro campo REQUIRED (seção 5).
LEGACY_ONLY     — mecanismo interno do legacy (ex.: TypeORM-specific) sem efeito funcional observável
                  pelo usuário; não recriado, mas também não classificado como perda.
DEAD            — comprovadamente não utilizado pelo sistema atual (código morto, componente órfão,
                  coluna nunca lida/escrita) — precisa de evidência (mesmo padrão de comprovação já usado
                  em auditorias anteriores desta série, nunca "parece não usado").
NON_CRUD_BY_DESIGN — comportamento que deliberadamente não é uma operação CRUD simples (ex.: ação de
                  workflow, efeito colateral), documentado como tal, não uma omissão.

Itens DEAD podem ser eliminados — mas somente após essa comprovação explícita, nunca por presunção.
```

---

## 24. Critério de cutover

```text
A apps/api-v2 só pode substituir o legacy quando TODAS as condições abaixo estiverem satisfeitas
simultaneamente:

- frontend contracts green (doc37, 250 endpoints/22 eventos)
- cross-domain tests green (seção 18/doc62)
- database traceability complete (seção 1/2/4)
- tenant isolation green (seção 12, doc45/47/49)
- auth green (seção 11, doc49)
- realtime green (seção 13)
- storage green (seção 14)
- imports/exports green (seção 8-10)
- integrations green (seção 16)
- financial consistency green (doc62 — Source of Truth, rastreabilidade financeira)
- zero required unmapped items (seção 22)

Mesmo critério já fixado conceitualmente no doc69 (ALL_FRONTEND_CONTRACT_TESTS_GREEN) e doc72
(READY_FOR_API_V2_SCAFFOLD), agora consolidado e expandido para cobrir a reconstrução completa, não
apenas o scaffold inicial.
```

---

## Resumo

```text
UNRESOLVED_ZERO_GAP_DECISIONS:
0
```

## Cobertura

Os 24 critérios pedidos foram registrados como contrato obrigatório de completude e rastreabilidade para
toda reconstrução futura de domínio da apps/api-v2: cobertura total de database, rastreabilidade
Form→Banco→API→Tela, paridade Create/Edit, rastreabilidade de colunas de tabela/grid, documentação de
campos derivados, auditoria de componentes e hooks, rastreabilidade de import/export com o limite
XLSX_MAX_SHEETS=2, cobertura integral de authentication/authorization/tenant/realtime/storage,
verificação (não presunção) de Edge Functions, cobertura de integrações com classificação obrigatória,
cobertura de observabilidade funcional (não apenas instalação de dependência), validação ponta a ponta de
comportamento cross-domain, verificação de relações entre entidades, preservação de estados
empty/loading/error/etc., matriz de rastreabilidade obrigatória por domínio, contadores zero-unknown
exigidos antes do cutover, regra de classificação obrigatória para eliminar itens (REQUIRED/REPLACED/
DERIVED/LEGACY_ONLY/DEAD/NON_CRUD_BY_DESIGN — DEAD só após comprovação) e o critério consolidado de
cutover. Nenhuma tabela, migration, schema, componente, hook ou export foi criado/alterado. Nenhum banco
foi alterado. Supabase não foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados. Git não foi
modificado. Nenhum documento anterior foi modificado.
