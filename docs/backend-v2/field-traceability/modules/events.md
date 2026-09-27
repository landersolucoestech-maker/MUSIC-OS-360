# Módulo `events` — Auditoria Zero-Gap (Fase 2, Prompt 105)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

Escopo real (seguindo imports/hooks/endpoints, não a pasta `events/`):
- Frontend: `apps/web/src/modules/events/**` (`constants/`, `forms/`, `utils/` são stubs vazios;
  `services/events.service.ts`/`hooks/events.store.ts` são código morto, ver §3). Rota real:
  `/agenda` (`apps/web/src/app/routes/operations.routes.tsx:20`).
- Backend: `apps/api/src/modules/events/**` (`EventsController`/`EventsService`, único módulo
  backend real deste domínio — nenhum módulo `agenda`/`booking`/`venues` separado existe).
- Tabela (Fase 1, ground truth): `events` (23 col, `backendMapping: DIRECT`). Nenhuma tabela de
  `venues`, `event_participants`, `event_attachments`, `reminders` ou `recurrence` existe — todas
  as investigações do prompt (§14 recorrência, §28 reminders, §31 storage, §20 venue como entidade
  separada) resultam em **NOT_IMPLEMENTED**, confirmado pela ausência total dessas tabelas na Fase 1.

---

## 1. Subdomínios reais identificados

| Subdomínio | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES |
|---|---|---|---|---|---|
| EVENT | `Agenda.tsx` (calendário/lista), `SchedulerFormModal.tsx`, `SchedulerViewModal.tsx` | `GET/POST/PATCH/DELETE /events` | `events.controller.ts` | `events.service.ts` | `events` |
| EVENT_PARTICIPANT | inline em `SchedulerFormModal.tsx`/`SchedulerViewModal.tsx`, via `useScheduleParticipants()` | embutido em `POST/PATCH /events` (campo `participantes`) | `events.controller.ts` | `EventsService.dtoToEntity()` | `events.participantes` (jsonb) |
| VENUE/LOCATION (texto livre, não entidade própria) | `SchedulerFormModal.tsx` (seção "Campos de Local") | idem | idem | idem | `events.local`, `.contato_local`, `.endereco` |
| BOOKING_CRM (venue via CRM) | `SchedulerFormModal.tsx` (`shouldUseCRMLocal`, tipos show/tv/rádio/podcast) | `GET /clients` (via `useClientes()`) | `clients.controller.ts` (já auditado em `crm-relationships.md`) | — | `clients` (leitura, cópia pontual dos dados no submit) |

4 subdomínios reais. `RECURRENCE`, `REMINDER`, `EVENT_FINANCIAL` (propagação automática),
`ATTACHMENT`, `CALENDAR_EXTERNAL_INTEGRATION` — todos **NOT_IMPLEMENTED** (nenhum campo, tabela,
endpoint ou código encontrado — ver seções correspondentes abaixo).

---

## 2. `Auditoria.tsx` — CROSS_MODULE_AUDITORIA_TSX (trecho events)

Ferramenta real (mesma de `dashboard.md` etc.): tab "Agenda" (`module: "eventos"`) em
`apps/web/src/modules/admin/pages/Auditoria.tsx`. Roda sobre `runner.ts:144-156`.

`AUDITORIA_EVENT_FIELDS`:

| Campo | Severidade |
|---|---|
| `titulo` | obrigatorio |
| `data_inicio` | obrigatorio |
| `local` | recomendado |
| `artista_id` | recomendado |

`AUDITORIA_EVENT_RULES`: mesmo motor genérico (`hasValue()`) já documentado nos demais módulos.
`fix_path`: `/agenda?edit=<id>`.

`AUDITORIA_EVENT_DATABASE_SOURCES`: `storage.list("eventos")` → `GET /events` — mesmo endpoint
real usado pelo resto do módulo, resposta bruta de `EventsService.list()` (colunas físicas:
`titulo, tipo, data, starts_at, data_fim, local, ...` — **não** `data_inicio`).

`AUDITORIA_EVENT_GAPS` (2, ambos confirmados por leitura de código, ligados ao Gap #1 abaixo):

1. **Campo obrigatório sempre "faltante"**: o runner verifica `row.data_inicio`, mas a resposta
   real de `GET /events` nunca tem essa chave (a coluna física é `data`/`starts_at`) — `hasValue()`
   é sempre `false` para esse campo, então **100% dos eventos aparecem como incompletos** na
   Auditoria, mesmo tendo uma data de início real e válida gravada em `data`.
2. **Deep-link sem handler**: `fix_path` aponta para `/agenda?edit=<id>`, mas `Agenda.tsx` não
   implementa nenhum `useSearchParams`/`useEditQueryParam` (confirmado por leitura completa do
   arquivo, 479 linhas) — diferente de `Contratos.tsx` (`contracts.md` §2, que trata `?edit=`
   corretamente). Clicar em "Preencher"/"Abrir" para um evento incompleto só abre a Agenda normal,
   sem nenhum modal pré-aberto.

`AUDITORIA_TSX_EVENTS_SECTION_COMPLETE: SIM`.

---

## 3. Componentes (classificação completa)

| Componente | Classificação | Observação |
|---|---|---|
| `SchedulerFormModal.tsx` | CREATE_MODAL + EDIT_MODAL | real, 808 linhas, único formulário de criação/edição; mapeamento create/edit **correto e bem documentado** (ver §5) |
| `SchedulerViewModal.tsx` | DETAIL_MODAL | real, mas lê majoritariamente campos com nomes que não existem na resposta real da API — ver Gap #1 |
| `Agenda.tsx` | CALENDAR + TABLE(via `EntityCalendarView`) + FILTER + SEARCH + IMPORT + EXPORT | real, página única do módulo, 479 linhas |
| `EntityCalendarView` (shared, não deste módulo) | CALENDAR | componente compartilhado — só a integração de dados (`calendarEvents`) foi auditada aqui, não o componente em si |
| `events.store.ts` (hooks/ e store/, mesmo arquivo) | DEAD | Zustand store, zero consumidores fora do próprio arquivo (mesmo padrão já visto em `catalog.md`/`crm-relationships.md`) |
| `services/events.service.ts` (`eventService`) | DEAD | objeto de serviço alternativo (`list/findById/create/update/delete/listByStatus` via `storage`), **zero consumidores** — a página real usa `useEventos()` diretamente |
| `constants/index.ts`, `forms/index.ts`, `utils/index.ts` | STATIC (stub) | só comentário, sem conteúdo real |

---

## 4. Hooks

| HOOK | FILE | ENDPOINTS | READ/WRITE | RELATIONS | REALTIME | TENANT_DEP |
|---|---|---|---|---|---|---|
| `useEventos` | `hooks/useEventos.ts` | `GET/POST/PATCH/DELETE /events` (via `useDataQuery`/`storage`) | ver §5/§9 | `select: "*, artistas(*)"` — **morto**, `EventsService` nunca faz join/mapeamento de `artistas` (confirmado por leitura completa do service — mesmo padrão morto já visto em `catalog.md`, diferente do padrão real confirmado em `contracts.md`) | não | implícito |
| `useScheduleParticipants` | `hooks/useScheduleParticipants.ts` | nenhum próprio — agrega `useArtistas()`, `useFuncionarios()` (`rh`, não auditado), `useUsuarios()` (`settings`, não auditado), `useContacts()` (`crm-relationships`, já auditado) | monta uma lista unificada `{source, id, label, email, phone, category}` para o seletor de participantes | 4 fontes cross-module | não | implícito (herdado de cada hook) |

Nenhum hook ativo ficou sem classificação. `orderBy: {column: "data_inicio"}` passado por
`useEventos()`/`eventService.list()` é **inerte** — `EventsService.list()` (backend) ignora
qualquer `orderBy` recebido e sempre ordena por `e.data` (hardcoded, `events.service.ts:32`).

---

## 5. CREATE/EDIT Event — `SchedulerFormModal.tsx` (mapeamento real, majoritariamente correto)

O próprio código documenta a regra seguida (linha 418-429): "Backend NestJS ValidationPipe roda
com whitelist + forbidNonWhitelisted... Regra de produto 2026-07-12: cada campo do formulário tem
coluna própria no DTO/entity". `buildPayload()` produz exatamente os campos aceitos por
`CreateEventDto`/`UpdateEventDto`.

| FORM_FIELD | TYPE | REQUIRED | API_REQUEST_FIELD | DATABASE_COLUMN | PERSISTED | Observação |
|---|---|---|---|---|---|---|
| `titulo` | string | sim | `title` | `events.titulo` | sim | |
| `tipoEvento` (10 opções pt-BR) | select | sim | `type` (via `mapTipoToBackendType()`, mapa explícito 17→7) | `events.tipo` | sim | 4 das 10 categorias do frontend (`sessoes_estudio`, `ensaios`, `sessoes_fotos`, `producao_conteudo`) não têm entrada no mapa e caem no default `"other"` — perda de granularidade deliberada/aceita, não um erro de mapeamento (ver Gap #2) |
| `participantes[]` (via `useScheduleParticipants`, fontes artist/employee/user/contact) | RELATION_SELECTOR (multi) | não | `participantes` | `events.participantes` (jsonb) | sim | primeiro participante com `source==="artist"` também vira `artistId` |
| `status` (só em edit) | select (5 opções pt-BR) | não | `status` (via `mapStatusToBackend()`, mapa explícito) | `events.status` | sim | |
| `dataInicio` + `horarioInicio` | date + time (combinados) | `dataInicio` sim, `horarioInicio` não | `startsAt` (ISO combinado via `combineDateAndTime()`) | `events.data` **e** `events.starts_at` (dual-write deliberado, ver §11) | sim | `horarioInicio` é só um input de conveniência — nunca é uma coluna própria, sempre recombinado antes do envio |
| `dataFim` + `horarioFim` | date + time (combinados) | não | `endsAt` (ISO combinado) | `events.data_fim` | sim | idem |
| `nomeLocal` | string OU Select (CRM) conforme tipo | não | `venue` | `events.local` | sim | ver Gap #4 (semântica dupla da coluna) |
| `contatoLocal` | string | não | `contato_local` | `events.contato_local` | sim | auto-preenchido a partir do CRM quando `shouldUseCRMLocal` |
| `endereco` | string | não | `endereco` | `events.endereco` | sim | idem |
| `capacidadePublico` (só tipo "shows") | number | não | `capacity` | **nenhuma** | **NÃO** | ver Gap #3 — DTO aceita, `dtoToEntity()` nunca mapeia |
| `valorCache` (só tipo "shows") | number | não | `valor_cache` | `events.valor_cache` | sim | |
| `publicoEsperado` (só tipo "shows") | number | não | `publico_esperado` | `events.publico_esperado` | sim | |
| `descricao` | textarea | não | `descricao` | `events.descricao` | sim | |
| `observacoes` | textarea | não | `observacoes` | `events.observacoes` | sim | |

Campos do `CreateEventDto` nunca enviados por este formulário: `city`, `country` (aceitos pelo DTO,
sem coluna física correspondente — `CODE_FIELD_ONLY` no backend, nunca exercitado pelo frontend
real). `metadata` também nunca é enviado por este form (nenhum campo formal cai em jsonb genérico,
consistente com a "regra de produto 2026-07-12").

CREATE_FIELDS (persistidos de fato): 12 campos de nível-registro (titulo, tipo, participantes,
artista_id derivado, data/starts_at, data_fim, local, contato_local, endereco, valor_cache,
publico_esperado, descricao, observacoes = 13 colunas físicas populáveis) + `status` só em edit.

---

## 6. EDIT — Create ≠ Edit (confirmado)

Mesmo componente (`mode: "create"|"edit"|"view"`), mas `buildPayload(data, forUpdate)` só inclui
`status` quando `forUpdate=true` — `status` é `IMMUTABLE_AFTER_CREATE` no sentido de que o DTO de
criação (`CreateEventDto`) nem sequer declara esse campo (só existe em `UpdateEventDto`); todo
evento nasce implicitamente sem `status` explícito no payload (a coluna `status` é `NOT NULL` —
como não há default visível no DTO nem no service, presume-se um `DEFAULT` a nível de banco, não
verificado aqui por estar fora do escopo de alteração). `READ_SOURCE` para popular o formulário de
edição: `getInitialFormData()` usa uma cadeia de fallback robusta
(`evento?.dataInicio || evento?.data_inicio || evento?.data || evento?.startsAt`) que **já
antecipa corretamente** a resposta real da API (cai em `evento?.data`) — diferente de
`SchedulerViewModal.tsx`/`Agenda.tsx`, que não têm essa robustez (ver Gap #1). `DATABASE_MAPPING`:
idêntico ao create para todos os campos.

---

## 7. Details — `SchedulerViewModal.tsx` (GAP CRÍTICO, ver Gap #1)

| DISPLAY_LABEL | DISPLAY_FIELD (lido) | API_FIELD real | Situação |
|---|---|---|---|
| Badge de tipo | `evento.tipo_evento` | `tipo` | **sempre vazio/em branco** — sem fallback |
| Data Início | `evento.data_inicio` | `data`/`starts_at` | **sempre "—"** — sem fallback |
| Horário Início | `evento.horario_inicio` | não existe como coluna própria | **sempre "—"** — estruturalmente impossível com o schema atual |
| Data Fim | `evento.data_fim` | `data_fim` | **correto** (nomes coincidem) |
| Horário Fim | `evento.horario_fim` | não existe | **sempre "—"** |
| Local | `evento.local` | `local` | **correto** |
| Endereço | `[evento.endereco, evento.cidade, evento.uf]` | `endereco` (só a 1ª parte existe) | parcialmente correto — mostra só `endereco`, `cidade`/`uf` sempre ausentes |
| Cachê | `evento.valor_cache` | `valor_cache` | **correto** |
| Capacidade | `evento.capacidade_publico` | não existe (nem como nome, nem como coluna — ver Gap #3) | **sempre oculto** (seção some, pois a condição `capacidade_publico != null` nunca é satisfeita) |
| Público Esperado | `evento.publico_esperado` | `publico_esperado` | **correto** |
| Contato — Responsável | `evento.contato_local` | `contato_local` | **correto** |
| Contato — Telefone/E-mail | `evento.contato_telefone`/`.contato_email` | não existem (nunca declarados em DTO/DB) | **sempre oculto** — campos inteiramente fictícios |
| Badge "tipo_local" | `evento.tipo_local` | não existe | **sempre oculto** — campo fictício |
| Checklist | `evento.checklist` | não existe | **sempre oculto** — funcionalidade inteiramente fictícia, sem DTO/coluna/UI de edição correspondente em nenhum lugar do módulo |
| Seção "Artista" (fallback) | `evento.artistas` | sempre `undefined` (join morto, §4) | seção nunca renderiza por essa via — só funciona via `participantes[]`/metadata, que é o caminho real |

`EMPTY_STATE`: `Field()` mostra "—" para qualquer valor vazio — isso **mascara** o Gap #1: o
usuário vê "—" em Data Início/Horário/Tipo e pode interpretar como "não preenchido", quando na
verdade o dado existe no banco mas o componente está lendo o nome de campo errado.

---

## 8. Calendário / Agenda (§10 do prompt) — GAP CRÍTICO CONFIRMADO

`CALENDAR_COMPONENT`: `EntityCalendarView` (shared), alimentado por `calendarEvents` derivado de
`schedulerEvents`, derivado de `filteredEventos` (`Agenda.tsx`).

```
EVENT_SOURCE:        eventos (useEventos(), GET /events)
DATE_START_FIELD (lido pelo frontend):  evento.data_inicio   → SEMPRE undefined
DATE_END_FIELD (lido pelo frontend):    evento.data_fim      → correto (nomes coincidem)
ALL_DAY_FIELD:        derivado — allDay: !evento.horario_inicio → SEMPRE true (horario_inicio
                       nunca existe), então TODO evento é tratado como dia inteiro pelo calendário
TITLE_FIELD:           evento.titulo → correto
STATUS_FIELD:          evento.status → correto
RESOURCE_RELATIONS:    summarizeScheduleParticipants(getEventoParticipants(evento)) — via
                       evento.metadata.participants (sempre vazio, pois participantes reais vão
                       para events.participantes, não events.metadata.participants — ver Gap #5)
                       com fallback para evento.artista_id (este sim real e funcional)
```

Construção do `start`/`end` em `schedulerEvents` (`Agenda.tsx:252-254`):
```js
const start = evento.data_inicio ? new Date(`${evento.data_inicio}T${evento.horario_inicio ?? "00:00"}:00`) : new Date();
```
Como `evento.data_inicio` é **sempre `undefined`** na resposta real da API, a condição ternária
**sempre cai no `else`**: `start = new Date()` — **todo evento renderizado no calendário usa o
instante em que a página foi carregada como sua data/hora de início**, independentemente da data
real gravada no banco. `end` segue o mesmo padrão (`evento.data_fim ? ... : undefined` — este caso
específico *funciona*, pois `data_fim` é um nome de campo correto).

`FRONTEND_EVENT_FIELD → API_FIELD → DATABASE_FIELD` para os 3 campos centrais do calendário:
- título: `title` → `titulo` → `events.titulo` — **correto**.
- data: `startDate` → `evento.data_inicio` (inexistente) → **nunca chega à coluna real** `data`/`starts_at` — **GAP**.
- hora: `time` → `evento.horario_inicio` (inexistente) → **GAP**, força `allDay: true` sempre.

---

## 9. Datas e Horários / Timezone (§11/§12 do prompt)

| UI_FIELD | API_FIELD | DATABASE_COLUMN | DATABASE_TYPE | REQUIRED |
|---|---|---|---|---|
| Data + Horário de Início | `startsAt` | `data` **e** `starts_at` (dual-write) | `timestamp without time zone` (ambas) | sim (`data` é `NOT NULL`; se `startsAt` ausente no create, o service usa `new Date()` como fallback — `events.service.ts:84-91`) |
| Data + Horário de Fim | `endsAt` | `data_fim` | `timestamp without time zone` | não |

`TIMEZONE — auditoria obrigatória (§12)`: as colunas são `timestamp **without** time zone` — o
Postgres não armazena nem converte fuso horário nelas; o valor gravado é exatamente o que chega no
`Date` serializado pelo frontend (`combineDateAndTime()` usa `new Date(...).toISOString()`, que
serializa em UTC) — não há nenhuma camada de conversão explícita de fuso do evento (ex.: fuso do
local do show vs. fuso do usuário que cadastra) em nenhuma camada (frontend ou backend). Confirmado:
`SOURCE_TIMEZONE` = fuso local do browser de quem preenche o formulário (`new Date(date); dt.setHours(h,m,0,0)` opera em hora local do browser); `CONVERSION_LAYER` = `.toISOString()` (browser→UTC)
antes de enviar; `STORAGE_TIMEZONE` = UTC implícito (mas coluna sem tz, então é apenas convenção,
não garantia do Postgres); `DISPLAY_TIMEZONE` = qualquer leitura de volta (`formatDate()`) usa o
fuso local do browser de quem visualiza. Para um evento com participantes/visualizadores em fusos
diferentes do de quem cadastrou, a hora exibida pode divergir do horário real pretendido — **não é
um bug ativo hoje** (sistema mono-região presumido), mas é uma lacuna de design real, registrada
como `TIMEZONE_GAP` informativo (nenhuma evidência de troca de fuso incorreta observada, pois não
foi possível testar com dado real).

---

## 10. Eventos de dia inteiro (§13 do prompt)

Não existe um campo real `all_day`/`dia_inteiro` no schema. O frontend **infere** dia inteiro a
partir da ausência de `horario_inicio` (`Agenda.tsx:266`, `allDay: !evento.horario_inicio`) — como
demonstrado no Gap #1, `evento.horario_inicio` é sempre `undefined` na resposta real da API,
então **todo evento é tratado como dia inteiro pelo `EntityCalendarView`**, mesmo eventos criados
com um horário específico (o horário existe dentro do timestamp `data`/`starts_at`, só não é
exposto sob o nome que o frontend está procurando). `ALL_DAY_FIELD: DERIVED (incorretamente,
efeito colateral do Gap #1)`. `DATABASE_REPRESENTATION`: nenhuma — não há distinção real entre
"dia inteiro" e "com horário" na tabela `events`.

---

## 11. Recorrência (§14 do prompt)

`RECURRENCE_ENABLED: NÃO`. Nenhum campo (`frequency`, `interval`, `by_day`, `until`, `count`,
`parent_event_id` etc.) existe em `events` (Fase 1: 23 colunas, nenhuma delas relacionada a
recorrência), no `CreateEventDto`/`UpdateEventDto`, nem em nenhum componente do frontend
(`SchedulerFormModal.tsx` não tem nenhum campo/checkbox de repetição). Classificação:
**NOT_IMPLEMENTED** — não é um recurso parcial nem "só de UI", é ausente em todas as camadas.

---

## 12. Status / Workflow (§15 do prompt)

| STATUS_VALUE (backend, DTO) | STATUS_VALUE (frontend, form) | FRONTEND_LABEL |
|---|---|---|
| `scheduled` | `agendado`, `pendente` (ambos mapeiam para `scheduled` — ver `mapStatusToBackend`) | Agendado / Pendente |
| `confirmed` | `confirmado` | Confirmado |
| `cancelled` | `cancelado` | Cancelado |
| `completed` | `concluido`, `realizado` | Concluído / Realizado |
| `postponed` | `adiado`, `postponed` | (sem label pt-BR no form — só usado internamente) |

**Não existe workflow real** (nenhum `WorkflowDefinition`/`WorkflowService` para `events`,
diferente de `contracts.workflow.ts` já confirmado em `contracts.md`) — `status` é um campo livre
validado só por `@IsIn(STATUSES)` no backend, sem regras de transição, sem guard, sem
side-effects automáticos além do log de atividade genérico (`EventsController`'s `@Audit(...)`).
Qualquer transição de status é permitida a qualquer momento por quem tiver `event:update`.
`ALLOWED_TRANSITIONS: todas (sem restrição)`. `SIDE_EFFECTS: nenhum` (nenhum handler `@OnEvent`
para eventos de domínio `event.*` foi encontrado em `apps/api/src` — confirmado por busca
exaustiva).

---

## 13. Event Type (§16 do prompt)

| TYPE_VALUE (backend enum) | Frontend pt-BR mapeados para ele |
|---|---|
| `show` | shows, show, show_teatro, rodeio, lancamento |
| `festival` | festival |
| `recording` | gravacao, gravacoes, recording |
| `meeting` | reuniao, reunioes, meeting |
| `interview` | entrevista, entrevistas, interview, programas_tv, radio, podcasts |
| `tour` | tour, turne |
| `other` | evento_corporativo + **qualquer valor não mapeado** (inclui `sessoes_estudio`, `ensaios`, `sessoes_fotos`, `producao_conteudo` — 4 das 10 categorias do form, que caem no default por ausência de entrada explícita no mapa) |

`FORM_VARIATION`: `isArtistaRelated`/`showLocalFields`/`isShow`/`shouldUseCRMLocal` (todas
calculadas sobre `formData.tipoEvento`, o valor **pt-BR original**, antes do mapeamento para o
enum inglês) controlam quais seções do formulário aparecem — 4 categorias visuais distintas
(campos de local, campos exclusivos de show, uso de CRM para local). `FILTER_USAGE`: o filtro de
tipo em `Agenda.tsx` (`typeFilter`) compara contra `evento.tipo_evento` (Gap #1 — sempre
`undefined`), então **o filtro de tipo na Agenda nunca retorna resultados quando um tipo
específico é selecionado** (toda comparação `undefined === "shows"` etc. é `false`) — mais um
efeito concreto do Gap #1, registrado separadamente por afetar diretamente um controle de UI
interativo.

Nota: `Agenda.tsx`/`SchedulerFormModal.tsx` também consultam `useOperationalSettings().
getOptionsByKind("event_type")` (módulo `settings`, não auditado) para uma lista de tipos
potencialmente **customizável por tenant**, com fallback para a lista hardcoded de 10 valores —
se um tenant customizar tipos via essa configuração operacional, os novos slugs criados
provavelmente também cairiam em `"other"` no backend (mesmo mecanismo de `mapTipoToBackendType()`,
que não conhece tipos customizados) — registrado como extensão do mesmo comportamento, não
verificado a fundo por depender do módulo `settings` (fora de escopo).

---

## 14. Participantes (§17 do prompt)

| PARTICIPANT_TYPE | SOURCE_ENTITY | DISPLAY_FIELD | DATABASE_FK_OR_JOIN | CARDINALITY | OPTIONAL |
|---|---|---|---|---|---|
| `artist` | `artists` (via `useArtistas()`, já auditado em `artist.md`) | `nome_artistico`/`nome`/`name` | nenhuma FK — id copiado para dentro do jsonb `events.participantes`; o **primeiro** participante artista também grava `events.artista_id` (FK solta, sem constraint declarada) | N:N (evento↔participantes) / N:1 (evento↔artista principal) | sim |
| `employee` | `funcionarios` (módulo `rh`, não auditado) | `nome`/`nome_completo`/`full_name`/`email` | idem (só jsonb) | N:N | sim |
| `user` | `usuarios` (módulo `settings`, não auditado) | `full_name`/`nome`/`email` | idem | N:N | sim |
| `contact` | `clients` (via `useContacts()`, `crm-relationships`, já auditado — "Contato = Cliente") | `name`/`nome`/`companyName`/`email` | idem | N:N | sim |

Todos os 4 tipos de participante são armazenados **exclusivamente** dentro de
`events.participantes` (jsonb, um array de `{source, id, label, email, phone, category}` — cópia
denormalizada dos dados no momento da seleção, não uma referência viva) — **sem** nenhuma FK real,
sem tabela de junção. `ROLE`/`STATUS` por participante: não existem (a estrutura só guarda
identidade + categoria de origem, não papel no evento nem confirmação de presença).

`ATENÇÃO — Gap #5 (leitura)`: `Agenda.tsx`/`SchedulerViewModal.tsx` leem participantes via
`evento.metadata.participants` (`meta["participants"]`), **não** via `evento.participantes` (a
coluna física real onde o `SchedulerFormModal` efetivamente grava, conforme `dtoToEntity()`) — mais
uma instância do mesmo padrão de nomes divergentes do Gap #1, desta vez afetando a exibição de
participantes: como `events.metadata` é sempre `{}` (nunca escrito por este formulário —
`buildPayload()` nunca inclui `metadata`), a leitura via `meta["participants"]` é **sempre vazia**,
e a UI cai no fallback de artista único (`getArtistParticipantById(evento.artista_id)`) — que
funciona, mas mostra **só o primeiro artista**, perdendo os demais participantes
(employee/user/contact ou múltiplos artistas) que de fato foram salvos em `events.participantes`.

---

## 15. Artist ↔ Event (§18 do prompt — `artist` já concluído, não reaberto)

```
EVENT_FIELD:      events.artista_id (FK solta, sem constraint declarada — Fase 1: foreign_key=false)
ARTIST_ENDPOINT:  GET /artists (via useArtistas(), consumido por useScheduleParticipants())
DATABASE_RELATION: events.artista_id → artists.id (semântica de FK, não enforçada no schema)
CARDINALITY:      N:1 (um evento tem no máximo 1 "artista principal"; múltiplos artistas só via
                   events.participantes, sem FK)
CREATE_FLOW:      primeiro participante com source="artist" selecionado em
                   SchedulerFormModal → artistId no payload → events.artista_id
EDIT_FLOW:        idêntico ao create
DISPLAY_FLOW:     evento.artistas (join morto, sempre undefined, §4) OU
                   evento.metadata.participants (sempre vazio, Gap #5) OU
                   fallback real: getArtistParticipantById(evento.artista_id) — este é o único
                   caminho de exibição que efetivamente funciona hoje
```

`ARTIST_EVENT_TRACEABILITY_COMPLETE: SIM` (a relação é rastreável e determinística, mesmo com os
gaps de exibição já documentados acima — a coluna `artista_id` em si é gravada e lida
corretamente pelo caminho de fallback).

---

## 16. CRM ↔ Event (§19 do prompt — `crm-relationships` já concluído, não reaberto)

```
EVENT_FIELD:      nomeLocal (quando shouldUseCRMLocal=true, tipos shows/programas_tv/radio/podcasts)
CRM_RESOURCE:     clients (Contato = Cliente, filtrado a tipo_pessoa="pessoa_juridica" —
                   apps/web/src/modules/events/components/SchedulerFormModal.tsx:213)
DATABASE_RELATION: nenhuma FK — o id do cliente é gravado como STRING dentro da coluna de texto
                   livre events.local (ver Gap #4); contato_local/endereco recebem cópia pontual
                   de clients.telefone/.endereco/.cidade/.estado no momento da seleção
PURPOSE:          permitir reusar um contato PJ do CRM (ex. uma casa de show já cadastrada como
                   cliente) como "local" do evento, evitando redigitação
```

`CRM_EVENT_TRACEABILITY_COMPLETE: SIM`.

---

## 17. Venue / Location (§20/§21/§22 do prompt)

Venue **não é uma entidade separada** — é texto livre em 3 colunas de `events`
(`local`, `contato_local`, `endereco`) ou (alternativamente, ver §16) um ID de `clients` embutido
como string em `local`. `VENUE_NAME`: `local`. `ADDRESS`: `endereco` (campo único combinado, sem
subcampos `logradouro`/`numero`/`bairro`/`cep` como o schema de `clients` tem). `CITY`/`STATE`/
`COUNTRY`/`POSTAL_CODE`/`LATITUDE`/`LONGITUDE`/`MAP_LINK`/`ROOM_STAGE`/`CAPACITY`: **nenhum desses
campos existe** na tabela `events` — confirmado ausentes na Fase 1. `NORMALIZATION`: nenhuma
(texto livre, sem máscara/validação de formato). `DISPLAY_SOURCE`: `SchedulerViewModal` tenta
exibir `cidade`/`uf` (Gap #1, campos inexistentes) — na prática só `endereco` (texto livre único)
é exibido de fato. `MAPAS/GEOLOCATION (§22)`: nenhuma integração encontrada — `EXTERNAL_CALENDAR_
INTEGRATIONS: 0`, `MAPS_INTEGRATIONS: 0` (nenhuma chamada a Google Maps/geocoding em nenhuma
camada).

---

## 18. Booking (§23 do prompt)

Não existe um fluxo de "booking" com estados de solicitação/aprovação distintos do CRUD padrão de
evento — criar um evento do tipo "shows" já é, na prática, o mecanismo de booking (sem etapa de
"solicitação" separada de "confirmação" além da máquina de `status` genérica do §12). Não há
`REQUESTER` distinto do criador do evento (`created_by`), não há `APPROVAL` (nenhuma permissão
"aprovar evento" encontrada). `CONTRACT_RELATION`: nenhuma FK entre `events` e `contracts` foi
encontrada — ver §19 abaixo.

---

## 19. Contratos ↔ Event (§24 do prompt — `contracts` já concluído, não reaberto)

**Nenhuma relação real entre `events` e `contracts` foi encontrada** em nenhuma camada — sem
campo `contract_id`/`contrato_id` em `events` (Fase 1 confirma ausência), sem `event_id` em
`contracts` (Fase 1 de `contracts.md` confirma 25 colunas, nenhuma referenciando eventos), sem
nenhum código de serviço que vincule as duas entidades. `CONTRACT_EVENT_TRACEABILITY_COMPLETE:
SIM` (o resultado da investigação é determinístico: a relação simplesmente **não existe** hoje,
apesar do prompt investigativo original de `contracts.md` mencionar shows/eventos como contexto
possível de contrato — nenhuma coluna ou código real implementa esse vínculo).

---

## 20. Financeiro ↔ Event (§25/§26 do prompt — `accounting` já concluído, não reaberto)

`events.valor_cache` (cachê do show) e `events.publico_esperado` são os únicos campos com
natureza financeira/operacional na tabela. **Não existe nenhuma propagação automática para
`transactions`** — busca exaustiva por `@OnEvent` reagindo a eventos de domínio `event.*`
(equivalente ao `ContractEventsHandler.onContractSigned()` documentado em `contracts.md`) não
encontrou nenhum handler. Classificação: **NOT_IMPLEMENTED** (nem manual via UI dedicada, nem
automática) — não existe também nenhum botão/fluxo em `SchedulerFormModal`/`SchedulerViewModal`
para "lançar cachê como transação" ou similar. O `Dashboard.tsx` (já auditado em `dashboard.md`)
usa `evento.valor_cache` apenas para uma métrica cross-domain morta (`artistasMetrics.
receitaTotal`, nunca exibida) — não é uma integração financeira real, é um cálculo client-side já
documentado no módulo anterior. `ORÇAMENTO (§26)`: não existe conceito de orçamento
estimado-vs-realizado — só um único valor (`valor_cache`), sem campo "estimado" separado de
"realizado", sem cálculo de saldo.

---

## 21. Tasks / Projects (§27 do prompt)

Nenhuma relação entre `events` e `projects`/tarefas foi encontrada — sem `projeto_id`/`project_id`
em `events` (Fase 1 confirma ausência), sem `event_id` em nenhuma tabela de tarefas conhecida.
`PURPOSE`: N/A — relação inexistente.

---

## 22. Reminders / Notificações (§28/§29 do prompt)

`REMINDER_TIME`/`REMINDER_TYPE`/`RECIPIENT`/`CHANNEL`: nenhum campo, tabela ou serviço de
lembretes encontrado para eventos. Classificação: **NOT_IMPLEMENTED**. `NOTIFICAÇÕES`: o único
mecanismo relacionado é o log de atividade genérico (`@Audit('event.created'|'event.updated'|
'event.deleted')`, grava em `activity_logs` via o mesmo `AuditInterceptor` já visto nos demais
módulos) — não é uma notificação endereçada a um usuário, é um registro de auditoria consumido
pela Activity Feed do Dashboard (já documentado em `dashboard.md`, que por sua vez já documentou o
gap de realtime — não repetido aqui).

---

## 23. Realtime (§30 do prompt)

Nenhuma assinatura `useWsEvent()` foi encontrada em nenhum arquivo do módulo `events`
(`Agenda.tsx`, `SchedulerFormModal.tsx`, `SchedulerViewModal.tsx` — confirmado por grep exaustivo).
`REALTIME_EVENTS: 0` neste módulo especificamente — o Dashboard (módulo já auditado) é quem
assina `artist.created`/etc. de forma cross-domain, mas nenhum evento equivalente para `event.*`
existe nem lá. Consistente com `dashboard.md`: mesmo se existisse uma assinatura, já está
confirmado que não há ponte real backend→Supabase Realtime para nenhum domínio.

---

## 24. Storage / Attachments (§31 do prompt)

**Não existe nenhum campo, tabela ou endpoint de anexo para eventos** — sem coluna tipo
`attachments`/`arquivo_url` em `events` (Fase 1 confirma ausência, diferente de `contracts.
arquivo_url` ou `clients.attachments`/`client_attachments`), sem seção de upload em
`SchedulerFormModal.tsx`. Classificação: **NOT_IMPLEMENTED** (nem sequer uma versão fake/local
como a de `catalog.md`/`crm-relationships.md` — a funcionalidade simplesmente não existe na UI).

---

## 25. Import / Export / XLSX (§32-§34 do prompt)

**Import real** (`Agenda.tsx:192-239`, `handleExcelImport`): lê um arquivo XLSX
(`XLSX.read`→`sheet_to_json`), itera linhas, para cada uma com `titulo` presente chama
`addEvento.mutateAsync({...})` **usando nomes de campo pt-BR "de exibição"**
(`tipo_evento`, `data_inicio`, `data_fim`, `horario_inicio`, `horario_fim`, `local`, `cidade`,
`estado`, `valor_cache`, `capacidade`, `descricao`, `observacoes`) — **os mesmos nomes já
confirmados incorretos no Gap #1**, e diferentes dos nomes que `SchedulerFormModal.buildPayload()`
usa (`title`/`type`/`startsAt`/`venue`/`capacity`). Como esse payload vai direto para
`addEvento.mutateAsync()` → `storage.create("eventos", payload)` → `POST /events`, e o
`CreateEventDto` tem `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` global (mesmo
padrão confirmado em todos os módulos anteriores): **nenhum desses campos do import é reconhecido
pelo DTO** (`tipo_evento`, `data_inicio`, `horario_inicio`, `horario_fim`, `cidade`, `estado`,
`capacidade` não existem no DTO; `local`/`valor_cache`/`descricao`/`observacoes` também não — o
DTO usa `venue`/`valor_cache`(este de fato existe)/`descricao`(existe)/`observacoes`(existe), mas
`local` deveria ser `venue`) — na prática, **toda linha do import teria a maioria dos seus campos
rejeitados com HTTP 400** (só `titulo` sobreviveria, já que não há alias `title`/`titulo` dual no
DTO de create — na verdade nem `titulo` é aceito, só `title`! O import usa a chave `titulo` no
objeto, que também não bate com `CreateEventDto.title`). Confirmado: **o import XLSX de eventos
está estruturalmente quebrado** — toda tentativa de importação resultaria em erro 400 para
essencialmente toda linha, pois nenhuma das chaves do objeto construído em `handleExcelImport`
corresponde às chaves aceitas por `CreateEventDto`.

**Export real** (`Agenda.tsx:159-190`, `handleExcelExport`): gera um XLSX com as colunas
`titulo, tipo_evento, status, participantes, data_inicio, horario_inicio, data_fim, horario_fim,
local, cidade, estado, valor_cache, valor_ingresso, capacidade, descricao, observacoes` — lidas
diretamente do array `eventos` (a mesma resposta bruta da API, com os mesmos nomes de campo
incorretos do Gap #1) — **a maioria das colunas exportadas viria vazia** (`tipo_evento`,
`data_inicio`, `horario_inicio`, `horario_fim`, `cidade`, `estado`, `valor_ingresso`, `capacidade`
— todas sempre `undefined`/`""` no objeto de origem), exceto `titulo`, `status`, `participantes`
(via `summarizeScheduleParticipants`, funcional), `data_fim`, `local`, `valor_cache`, `descricao`,
`observacoes` (estes sim com nomes corretos). `XLSX`: `WORKSHEET_COUNT = 1` ("Agenda"),
`XLSX_RULE_VIOLATION: NÃO` — a regra de no máximo 2 abas é respeitada tanto no export quanto no
import (single-sheet em ambos), apesar do conteúdo estar incorreto.

`IMPORT + CRIPTOGRAFIA (§32 do prompt)`: não se aplica — nenhum campo de `events` é criptografado
(sem PII sensível neste módulo: `contato_local` é um campo de texto livre, não uma coluna
`*_encrypted` como em `clients`).

---

## 26. Duplicidade de Eventos (§41 do prompt)

Nenhuma regra de deduplicação (por título+data, artista+data, venue+data, ID externo) foi
encontrada em nenhuma camada — `DATABASE_UNIQUE: NÃO` (nenhuma constraint `UNIQUE` na Fase 1 para
`events`), `BACKEND_VALIDATION: NÃO` (`EventsService.create()` nunca consulta eventos existentes
antes de inserir), `FRONTEND_VALIDATION: NÃO`, `IMPORT_VALIDATION: NÃO` (o loop de import processa
cada linha independentemente, sem checagem cross-linha ou contra o banco).

---

## 27. Tables/Lists/Cards, Filters, Search, Sort, Paginação (§35-§40 do prompt)

**Calendário/lista** (`EntityCalendarView`, alimentado por `calendarEvents`): campos exibidos por
evento renderizado = `title` (correto), `dateISO` (Gap #1 — sempre "hoje"), `time` (Gap #1 —
sempre null/allDay), `toneClass` (derivado de `status`, correto), `hint` (`título · participantes`,
parcialmente correto — participantes sofre do Gap #5).

**FILTERS** (`Agenda.tsx`): 3 — busca livre (`searchTerm`), `typeFilter` (Gap #1 — nunca
encontra resultado quando não é "Todos Tipos", pois compara contra `evento.tipo_evento`
inexistente), `statusFilter` (**funcional** — compara `evento.status`, nome correto). `DATABASE_
FIELD_OR_EXPRESSION`: todos client-side, sobre o array já carregado (mesmo padrão dos demais
módulos — nenhum filtro vira query-param HTTP real, apesar de `QueryEventDto` aceitar
`status`/`type`/`artistId` no backend).

**SEARCH**: `evento.titulo` (correto) + `evento.local` (correto) +
`summarizeScheduleParticipants(...)` (parcial, Gap #5) — `.includes()` case-insensitive, 100%
client-side.

**SORT**: nenhum controle de ordenação interativo na UI (`Agenda.tsx` não tem `SortableTableHead`
nem equivalente) — a única ordenação é a implícita do calendário (por data) e a do backend
(`ORDER BY e.data DESC`, hardcoded, já citado no §4).

**PAGINAÇÃO**: nenhuma paginação de UI — `Agenda.tsx` carrega e renderiza `filteredEventos`
inteiro no calendário (sem `usePagination`/`TablePagination`). `TOTAL_COUNT_SOURCE`:
`eventos.length` (array já limitado a 50 pelo backend, ver §28).

---

## 28. Limites e Truncamento (§40 do prompt)

| ENDPOINT_OR_COMPONENT | LIMIT | SERVER_OR_CLIENT | INTENTIONAL | AFFECTS_TOTAL |
|---|---|---|---|---|
| `GET /events` (via `useEventos()`, sem override) | 50 (`PaginationDto.limit` default) | SERVER (silencioso) | NÃO | **SIM** — mesmo padrão de truncamento silencioso já confirmado em 6+ módulos anteriores (`works`, `phonograms`, `contracts`, `contract_templates`, `clients`, os 7 hooks de `dashboard.md`) — aqui afeta diretamente o calendário/lista principal do módulo: um tenant com mais de 50 eventos nunca vê os mais antigos na Agenda, nas métricas (`metricas.total`, `.confirmados`, `.pendentes`, `.proximos7Dias`) nem no export XLSX |

`TRUNCATION_GAP` confirmado — mesma causa raiz estrutural já documentada nos módulos anteriores
(nenhum hook de domínio deste sistema passa `limit`/`offset` para o backend).

---

## 29. Delete / Cancel / Archive (§42 do prompt)

| UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | RELATED_IMPACT | SOFT_OR_HARD |
|---|---|---|---|---|
| Excluir evento (`DeleteConfirmModal`, único botão de remoção na Agenda) | `DELETE /events/:id` | `UPDATE events SET deleted_at = now()` | nenhum (sem tabelas filhas) | SOFT |

Não existe distinção entre "Cancelar" (mudar `status` para `cancelado`, uma `PATCH` normal) e
"Excluir" (soft-delete real) na UI — ambos os conceitos coexistem mas usam mecanismos diferentes
(`status='cancelado'` é só mais um valor de status livre, §12; exclusão é o soft-delete padrão).
Não há `ARCHIVE`/`RESTORE` em nenhuma camada.

---

## 30. Calendar External Integrations (§43 do prompt)

Nenhuma integração com Google Calendar/Outlook/iCal/ICS foi encontrada em nenhuma camada —
`EXTERNAL_CALENDAR_INTEGRATIONS: 0`. `CREDENTIALS_REQUIRED_LATER: 0` (não há indício de que essa
integração esteja planejada — nenhum campo `external_calendar_id`/`ics_url`/similar existe no
schema).

---

## 31. Permissões e Tenant Isolation (§44/§45 do prompt)

| PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|
| `event:read` | leitura não gateada explicitamente | `@RequireRole('viewer') @RequirePermission('event:read')` |
| `event:create` | botão "Novo Evento" via `RequirePermission module="events" action="write"` (nome de módulo pt-BR/inglês distinto do `event:*` do backend — só rótulo interno do componente `RequirePermission`, não um mismatch funcional) | `@RequireRole('editor') @RequirePermission('event:create')` |
| `event:update` | nenhum gate visível nos botões "Editar" | `@RequireRole('editor') @RequirePermission('event:update')` |
| `event:delete` | nenhum gate visível no botão "Excluir" | `@RequireRole('manager') @RequirePermission('event:delete')` |

`AUTHORIZATION_GAPS: 0` — todas as rotas reais estão protegidas; ausência de gate visual
antecipado nos botões de editar/excluir é a mesma observação não-bloqueante já registrada em
módulos anteriores (o backend recusaria a operação de qualquer forma).

`TENANT_ISOLATION_GAPS: 0`. `EventsService` filtra `tenant_id = :tenantId` (via `@CurrentTenant()`)
em `list`/`findById`/`create`/`update`/`softDelete`, consistente com o padrão `TenantGuard` já
auditado em `auth.md`. Atenção específica pedida pelo prompt: `participants` (dentro do jsonb
`events.participantes`, isolamento herdado da própria linha do evento — sem tabela própria, sem
risco adicional); `venues` (texto livre na própria linha, mesmo isolamento); `attachments`/
`reminders`/`calendar sync` (não existem, §22/§24/§30 — sem superfície de risco);
`event financial relations` (não existem, §20 — sem superfície de risco).

---

## 32. Gaps consolidados (evidenciados, não corrigidos)

1. **DISPLAY_MAPPING_MISMATCH** (severidade crítica, cross-cutting) — `Agenda.tsx` e
   `SchedulerViewModal.tsx` leem os campos `data_inicio`, `tipo_evento`, `horario_inicio`,
   `horario_fim`, `cidade`, `estado`/`uf`, `capacidade_publico`, `contato_telefone`,
   `contato_email`, `tipo_local`, `checklist` — **nenhum desses nomes existe na resposta real de
   `GET /events`** (a API retorna `titulo`, `tipo`, `data`, `starts_at`, `data_fim`, `local`,
   `endereco`, `contato_local`, `valor_cache`, `publico_esperado`, `descricao`, `observacoes`,
   `participantes`, `status`, `artista_id`, `metadata`). Efeitos confirmados: (a) o calendário
   renderiza **todo evento na data/hora em que a página foi carregada**, não na data real do
   evento (`Agenda.tsx:252-254`, fallback `new Date()` sempre acionado); (b) todo evento é tratado
   como "dia inteiro" (`allDay` sempre `true`); (c) o filtro de tipo (`typeFilter`) nunca encontra
   resultados quando um tipo específico é selecionado; (d) o modal de detalhes mostra "—" para
   Data Início, Horário Início/Fim, Tipo, Cidade/Estado e Capacidade mesmo quando esses dados
   existem no banco; (e) o export XLSX gera colunas vazias para a maioria dos campos temporais/
   geográficos. Confirmado de forma independente pelo próprio código do módulo `dashboard`
   (`dashboard.md`, já auditado): `useMetrics.ts` já documenta em comentário que precisou de um
   fallback duplo `data_inicio ?? data` "para evitar contagem zerada em HTTP mode" — evidência de
   que esse exato problema já foi percebido em outro contexto, mas nunca corrigido na origem
   (`Agenda.tsx`/`SchedulerViewModal.tsx`, os componentes primários do próprio módulo `events`).
   O formulário de **criação/edição** (`SchedulerFormModal.tsx`) não sofre deste gap — usa uma
   cadeia de fallback correta (`getInitialFormData()`) que já cai em `evento?.data`.
2. **DISPLAY_MAPPING_MISMATCH** (secundário) — `mapTipoToBackendType()` não tem entrada para 4
   das 10 categorias pt-BR do formulário (`sessoes_estudio`, `ensaios`, `sessoes_fotos`,
   `producao_conteudo`), todas colapsando para o enum `"other"` no backend — perda de
   granularidade na persistência (não impede o uso, mas informação de categoria fica menos
   precisa na coluna `tipo` do que na seleção original do usuário).
3. **CREATE_MAPPING_MISMATCH** — `capacidadePublico` (campo real do formulário, seção "Campos
   Exclusivos para Shows") é validado, incluído no payload como `capacity`, aceito pelo
   `CreateEventDto`, mas `EventsService.dtoToEntity()` nunca mapeia `capacity` para nenhuma
   coluna — o valor é descartado silenciosamente após passar pela validação (a request tem
   sucesso, só o dado é perdido).
4. **RELATION_MISMATCH** (design) — a coluna `events.local` (`character varying`) tem semântica
   dupla dependendo do tipo de evento: texto livre (nome do venue, digitado) para a maioria dos
   tipos, ou um UUID de `clients` (sem marcação/tipo distinto) quando `shouldUseCRMLocal=true`
   (shows/TV/rádio/podcast) — não há como distinguir os dois casos só lendo a coluna, sem
   reconstituir a lógica de `tiposLocalCRM` do frontend.
5. **PARTICIPANT_GAP** — `Agenda.tsx`/`SchedulerViewModal.tsx` leem participantes via
   `evento.metadata.participants` (sempre `{}`/vazio — nunca escrito por
   `SchedulerFormModal.buildPayload()`), não via `evento.participantes` (a coluna física real onde
   os dados são de fato gravados) — a UI cai num fallback de artista único, perdendo
   employee/user/contact e artistas adicionais que foram genuinamente persistidos.
6. **REAL_MAPPING_GAP** — o import XLSX (`handleExcelImport`) constrói objetos com chaves
   (`titulo`, `tipo_evento`, `data_inicio`, `horario_inicio`, `horario_fim`, `cidade`, `estado`,
   `capacidade`) que não correspondem a nenhum campo aceito por `CreateEventDto` — com
   `ValidationPipe(whitelist:true, forbidNonWhitelisted:true)` global, toda linha importada
   resultaria em HTTP 400 (nem `titulo` sobrevive — o DTO só aceita `title`). O import está
   estruturalmente não-funcional, apesar de existir e ser acionável na UI.
7. **REAL_MAPPING_GAP** — o export XLSX (`handleExcelExport`) lê os mesmos nomes de campo
   incorretos do Gap #1 diretamente do array de eventos — a maioria das colunas exportadas
   (`tipo_evento`, `data_inicio`, `horario_inicio`, `horario_fim`, `cidade`, `estado`,
   `valor_ingresso`, `capacidade`) sai sempre vazia.
8. **TRUNCATION_GAP** — `GET /events` usa `PaginationDto.limit=50` e `useEventos()` nunca
   sobrescreve — tenants com mais de 50 eventos perdem visibilidade dos mais antigos na Agenda,
   métricas e export.
9. **RECURRENCE_GAP** — `NOT_IMPLEMENTED` em todas as camadas (§11).
10. **REMINDER_GAP** — `NOT_IMPLEMENTED` em todas as camadas (§22).
11. **STORAGE_GAP** — `NOT_IMPLEMENTED` (nem versão fake) — nenhum campo/fluxo de anexo existe
    (§24).
12. **CALENDAR_INTEGRATION_GAP** — `NOT_IMPLEMENTED` (§30).
13. **FINANCIAL_INTEGRATION_GAP** — `NOT_IMPLEMENTED` (nem automático nem manual) — `valor_cache`
    nunca propaga para `transactions` (§20).
14. **TIMEZONE_GAP** (informativo) — colunas `timestamp without time zone`, sem camada explícita
    de conversão de fuso do evento vs. fuso do visualizador (§9).
15. **DEAD CODE** (não contado como gap formal) — `events.store.ts` (Zustand, zero consumidores),
    `services/events.service.ts`/`eventService` (zero consumidores — a página real usa
    `useEventos()` diretamente), `evento?.artistas` (join nunca implementado no backend, sempre
    `undefined`).

Total: 5 DISPLAY_MAPPING_MISMATCH-família (itens 1, 2, 4, 5 — contados como 4 achados distintos de
mapeamento de exibição/relação) + 1 CREATE_MAPPING_MISMATCH + 2 REAL_MAPPING_GAP (import/export) +
1 TRUNCATION_GAP + 1 RECURRENCE_GAP + 1 REMINDER_GAP + 1 STORAGE_GAP + 1 CALENDAR_INTEGRATION_GAP +
1 FINANCIAL_INTEGRATION_GAP + 1 TIMEZONE_GAP (informativo) = **15 gaps**.

---

## Contadores finais (Zero-Gap)

```
SUBDOMAINS_AUDITED: 4
COMPONENTS_AUDITED: 7
HOOKS_AUDITED: 2
CREATE_FORMS: 1
CREATE_FIELDS: 13 (colunas físicas populáveis pelo form real, nível-registro)
EDIT_FORMS: 1
EDIT_FIELDS: 14 (13 + status)
MODALS_DRAWERS_WIZARDS: 2 (SchedulerFormModal, SchedulerViewModal)
CALENDAR_COMPONENTS: 1 (EntityCalendarView, integração de dados auditada; componente em si é shared)
TABLE_GRID_CARD_FIELDS: 6 (campos por evento renderizado no calendário: title, dateISO, time,
                           toneClass, hint, status)
DETAIL_DISPLAY_FIELDS: 15 (SchedulerViewModal — ver §7)
EVENT_TYPES: 10 (frontend pt-BR) mapeados para 7 (backend enum)
WORKFLOW_STATUSES: 5 (backend enum: scheduled/confirmed/cancelled/completed/postponed) — sem
                    workflow real (§12)
DATE_TIME_FIELDS: 2 colunas físicas (data/starts_at dual-write, data_fim) + 2 campos de UI
                   (horarioInicio/horarioFim, recombinados antes do envio, sem coluna própria)
TIMEZONE_SENSITIVE_FIELDS: 2 (data/starts_at, data_fim — timestamp without time zone)
RECURRENCE_FIELDS: 0
PARTICIPANT_FIELDS: 6 por participante (source, id, label, email, phone, category) × 4 fontes
RELATION_FIELDS: 2 (events.artista_id → artists.id; events.local como referência solta opcional a
                    clients.id)
VENUE_LOCATION_FIELDS: 3 (local, contato_local, endereco)
FINANCIAL_FIELDS: 2 (valor_cache, publico_esperado) — sem propagação
REMINDER_FIELDS: 0
FILTERS: 3
SEARCH_FIELDS: 3 (titulo, local, participantes-resumo)
SORT_FIELDS: 0 (nenhum controle interativo; ordenação backend hardcoded)
IMPORT_FIELDS: 12 (construídos pelo import, estruturalmente rejeitados — ver Gap #6)
EXPORT_FIELDS: 16 (colunas do XLSX exportado, maioria vazia — ver Gap #7)
XLSX_EXPORTS: 1 (Agenda)
XLSX_RULE_VIOLATIONS: 0
REALTIME_EVENTS: 0
STORAGE_FIELDS: 0
EXTERNAL_CALENDAR_INTEGRATIONS: 0
CREDENTIALS_REQUIRED_LATER: 0
PERMISSIONS_AUDITED: 4 (event:read/create/update/delete)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 2 (CreateEventDto.city/.country — aceitos, nunca enviados pelo form real, sem coluna)
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 0 (o mapeamento pt-BR→enum existe e é determinístico, mesmo sendo lossy — ver Gap #2)
RELATION_MISMATCH: 1
CREATE_MAPPING_MISMATCH: 1
EDIT_MAPPING_MISMATCH: 1 (mesmo — mesmo componente/mesma lacuna de capacity)
DISPLAY_MAPPING_MISMATCH: 4 (Gaps #1, #2, #4, #5)
DATE_TIME_GAPS: 0 (formalmente — os problemas de data são classificados como DISPLAY_MAPPING_MISMATCH, já que a causa raiz é nome de campo, não o tipo/formato da data em si)
TIMEZONE_GAPS: 1
RECURRENCE_GAPS: 1
WORKFLOW_GAPS: 0 (ausência de workflow é uma característica documentada, não uma inconsistência —
                  não há workflow parcial/quebrado, simplesmente não existe)
PARTICIPANT_GAPS: 1
FINANCIAL_INTEGRATION_GAPS: 1
REMINDER_GAPS: 1
CALENDAR_INTEGRATION_GAPS: 1
STORAGE_GAPS: 1
REALTIME_GAPS: 0 (não se aplica — nenhuma assinatura realtime existe neste módulo para estar "quebrada")
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 1
REAL_MAPPING_GAPS: 2

ARTIST_EVENT_TRACEABILITY_COMPLETE: SIM
CRM_EVENT_TRACEABILITY_COMPLETE: SIM
CONTRACT_EVENT_TRACEABILITY_COMPLETE: SIM
ACCOUNTING_EVENT_TRACEABILITY_COMPLETE: SIM
AUDITORIA_TSX_EVENTS_SECTION_COMPLETE: SIM

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_DATE_TIME_FIELDS: 0
UNMAPPED_PARTICIPANT_FIELDS: 0
UNMAPPED_FINANCIAL_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `integrations`
