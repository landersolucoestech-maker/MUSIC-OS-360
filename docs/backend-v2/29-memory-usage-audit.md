> Historical record. Kept as recorded; not the current contract.

# 29 — Auditoria dos Usos de Memória do Frontend (zustand)

Continuação read-only de [`03-frontend-data-access-surface.md`](./03-frontend-data-access-surface.md) (`MEMORY_FILES: 20`). Nenhum arquivo foi alterado. Nenhum estado em memória foi removido. `apps/api` não foi consultado (a única referência a um endpoint do doc05 abaixo é citação de um documento já produzido nesta auditoria de `apps/web`, não uma nova consulta a `apps/api`).

## Achado geral (aplicável a todo o lote)

Todos os 20 arquivos são stores `zustand` puros — `import { create } from "zustand"`, sem middleware `persist` (confirmado nos 20 arquivos: nenhum usa `persist()`/`createJSONStorage`). Isso confirma o que o doc18 já implicava: nenhum destes stores grava em `localStorage`/`sessionStorage` — são 100% memória volátil do processo do navegador, perdida em qualquer reload.

**Achado não previsto no enunciado, mas decisivo para a classificação:** grep de cada um dos 20 nomes de hook (`use{X}Store`) em todo `apps/web/src` mostra que **19 dos 20 stores não têm nenhum consumidor fora do próprio arquivo de declaração** — nem leitura, nem escrita. Apenas **1** (`useLeadFiltersStore`, `leads/store/lead-filters.store.ts`) é realmente importado e usado, em `modules/leads/pages/LeadsPage.tsx:10,242`. Validado contra um caso de controle (`useTenant()`, que retorna 10 consumidores reais) para confirmar que a metodologia de busca está correta.

---

## Uso real confirmado

### `apps/web/src/modules/leads/store/lead-filters.store.ts`

```text
ARQUIVO:
apps/web/src/modules/leads/store/lead-filters.store.ts

SÍMBOLO:
useLeadFiltersStore (filters: LeadFiltersState — search/tipoServico/statusLead/responsavel/origemLead/temperatura)

FINALIDADE:
estado dos filtros da tela de listagem de leads (busca, tipo de serviço, status, responsável, origem, temperatura)

DURAÇÃO:
APPLICATION_LIFETIME (zustand sem persist — sobrevive a navegações internas da SPA, perdido em reload)

DADO:
seleção corrente de filtros de UI para a lista de leads — nenhum registro de negócio, só critérios de filtro

PERSISTÊNCIA_REAL_NECESSÁRIA:
NÃO

CLASSIFICAÇÃO:
UI_TRANSIENT_STATE

API_V2_REQUIRED:
NÃO

JUSTIFICATIVA:
consumido de fato por modules/leads/pages/LeadsPage.tsx (`const { filters, setFilters } = useLeadFiltersStore()`) para controlar os parâmetros de busca/filtro passados à listagem real de leads (que vem de leads.service.ts, API real). É estado de UI clássico — não guarda nenhum dado que deveria vir de um backend, só a escolha atual do usuário sobre como filtrar dados que já vêm de uma API real.
```

---

## 15 stores de UI (view/tab/filtros/seleção/modal) — órfãos, sem consumidor

Os 15 stores abaixo têm a MESMA natureza estrutural de `useLeadFiltersStore` (view/tab ativa, filtros de listagem, id selecionado, estado de modal/sidebar/dirty) — mas, ao contrário dele, **nenhum tem consumidor fora do próprio arquivo** (confirmado por grep de cada nome de hook em todo `apps/web/src`). Registrados em bloco por brevidade, com os campos que variam por arquivo:

```text
ARQUIVOS E SÍMBOLOS:
1. apps/web/src/modules/accounting/hooks/accounting.store.ts        — useAccountingStore (view, filters, selectedTransactionId, sidebarOpen)
2. apps/web/src/modules/artist/hooks/artist.store.ts                — useArtistStore (view, filters, selectedArtistId, visao360Open)
3. apps/web/src/modules/catalog/hooks/catalog.store.ts              — useCatalogStore (tab, filters, selectedWorkId)
4. apps/web/src/modules/contracts/hooks/contracts.store.ts          — useContractsStore (tab, filters, selectedContractId, templateEditorOpen)
5. apps/web/src/modules/crm-relationships/store/contact-filters.store.ts — useContactFiltersStore (filters)
6. apps/web/src/modules/crm-relationships/store/contact-panel.store.ts   — useContactPanelStore (selectedContactId)
7. apps/web/src/modules/events/hooks/events.store.ts                — useEventsStore (view, filters, selectedEventId)
8. apps/web/src/modules/inventory/hooks/inventory.store.ts          — useInventoryStore (filters, selectedItemId)
9. apps/web/src/modules/leads/store/lead-modal.store.ts             — useLeadModalStore (isOpen, editingLeadId)
10. apps/web/src/modules/licensing/hooks/licensing.store.ts          — useLicensingStore (tab, filters, selectedLicenseId)
11. apps/web/src/modules/monitoring/hooks/monitoring.store.ts        — useMonitoringStore (tab, filters, selectedAlertId, ecadModalOpen/RecordId)
12. apps/web/src/modules/projects/hooks/projects.store.ts            — useProjectsStore (tab, filters, selectedProjectId)
13. apps/web/src/modules/releases/hooks/releases.store.ts            — useReleasesStore (tab, filters, selectedReleaseId)
14. apps/web/src/modules/rh/hooks/rh.store.ts                        — useRhStore (tab, filters, selectedMemberId)
15. apps/web/src/modules/settings/hooks/settings.store.ts            — useSettingsStore (activeTab, dirtyTabs: Set)

FINALIDADE (comum aos 15):
estado de UI da tela principal do respectivo módulo — aba/visão ativa, filtros de listagem, item selecionado, estado de modal/sidebar/"sujo" — nenhum contém dado de negócio, só controle de apresentação

DURAÇÃO:
APPLICATION_LIFETIME (idêntico ao caso real acima)

DADO:
critérios de filtro, id selecionado, flags booleanas de UI (aberto/fechado, sujo/limpo) — nenhum registro de negócio

PERSISTÊNCIA_REAL_NECESSÁRIA:
NÃO

CLASSIFICAÇÃO:
UI_TRANSIENT_STATE

API_V2_REQUIRED:
NÃO

JUSTIFICATIVA:
mesma natureza do caso real confirmado (useLeadFiltersStore) — se estivessem em uso, seriam estado de UI legítimo, sem necessidade de persistência. A diferença é que estes 15 não têm NENHUM importador fora da própria declaração (confirmado por grep individual de cada nome de hook), portanto hoje são código inalcançável — não participam do runtime real de nenhuma tela. Não são classificados como "problema" pela regra desta etapa (não é uma substituição de API real por memória — é, simplesmente, não utilizado).
```

---

## 4 stores de dado de negócio — órfãos em leitura E escrita (destaque obrigatório)

Estes 4 diferem estruturalmente dos 16 acima: guardam **registros de negócio reais** (não apenas critérios de UI), indexados por id da entidade-pai. Se estivessem em uso, se encaixariam no destaque obrigatório desta etapa ("fonte principal de registros exibidos ao usuário"). Nenhum, porém, tem qualquer consumidor — nem leitura, nem as próprias funções de escrita (`setAgenda`/`setTags`/`setInteractions`/`appendInteraction`/`setUploads`/`clearUploads`) são chamadas em lugar nenhum de `apps/web/src`.

### `contact-agenda.store.ts`

```text
ARQUIVO:
apps/web/src/modules/crm-relationships/store/contact-agenda.store.ts

SÍMBOLO:
useContactAgendaStore (agendaByContactId: Record<string, ContactAgendaItem[]>)

FINALIDADE:
guardar, por contato do CRM, uma lista de itens de agenda (id, título, data de início, status: scheduled/done/cancelled)

DURAÇÃO:
APPLICATION_LIFETIME

DADO:
registros de agenda (compromissos) por contato — dado de negócio real, não estado de UI

PERSISTÊNCIA_REAL_NECESSÁRIA:
INCERTO

CLASSIFICAÇÃO:
OTHER

API_V2_REQUIRED:
INCERTO

JUSTIFICATIVA:
ATENÇÃO — nenhuma das categorias listadas descreve corretamente este caso: o formato do dado é de negócio (BUSINESS_DATA), mas como `setAgenda` nunca é chamado em lugar nenhum, não há evidência de que ele algum dia contenha dado real — não é cache de API (RUNTIME_CACHE), porque nada o alimenta; não é fallback (MOCK_OR_FALLBACK), porque nada o consome como substituto de nada. É simplesmente inatingível dos dois lados (nem escrito, nem lido). Observação relevante sem confirmação: `apps/api` já expõe `GET/POST /clients/:id/timeline` (doc05, clients.service.ts) — estruturalmente parecido com "agenda por contato" — mas comparar campos exigiria consultar `apps/api`, fora do escopo autorizado nesta etapa; registrado como possível sobreposição não confirmada, não como equivalência.
```

### `contact-tags.store.ts`

```text
ARQUIVO:
apps/web/src/modules/crm-relationships/store/contact-tags.store.ts

SÍMBOLO:
useContactTagsStore (tagsByContactId: Record<string, string[]>)

FINALIDADE:
guardar, por contato do CRM, uma lista de tags/etiquetas

DURAÇÃO:
APPLICATION_LIFETIME

DADO:
lista de strings (tags) por contato — dado de negócio real

PERSISTÊNCIA_REAL_NECESSÁRIA:
INCERTO

CLASSIFICAÇÃO:
OTHER

API_V2_REQUIRED:
INCERTO

JUSTIFICATIVA:
mesma situação do caso anterior — `setTags` nunca é chamado em nenhum lugar de `apps/web/src`; nenhum componente lê `tagsByContactId`. Inatingível dos dois lados. Sem endpoint específico de "tags de contato" identificado no doc05 (não há `/clients/:id/tags`).
```

### `lead-interactions.store.ts`

```text
ARQUIVO:
apps/web/src/modules/leads/store/lead-interactions.store.ts

SÍMBOLO:
useLeadInteractionsStore (interactionsByLeadId: Record<string, LeadInteraction[]>)

FINALIDADE:
guardar, por lead, um histórico de interações (chamadas, emails, notas etc. — tipo LeadInteraction não expandido nesta etapa, fora do necessário)

DURAÇÃO:
APPLICATION_LIFETIME

DADO:
histórico de interações por lead — dado de negócio real

PERSISTÊNCIA_REAL_NECESSÁRIA:
INCERTO

CLASSIFICAÇÃO:
OTHER

API_V2_REQUIRED:
INCERTO

JUSTIFICATIVA:
`setInteractions`/`appendInteraction` nunca são chamados em nenhum lugar de `apps/web/src`. Inatingível dos dois lados. `leads.service.ts` (doc05: GET/POST/PATCH/DELETE `/leads`) não expõe nenhuma sub-rota de interações — não há evidência de endpoint equivalente no inventário de chamadas do frontend.
```

### `lead-uploads.store.ts`

```text
ARQUIVO:
apps/web/src/modules/leads/store/lead-uploads.store.ts

SÍMBOLO:
useLeadUploadsStore (uploadsByLeadId: Record<string, LeadUpload[]>)

FINALIDADE:
guardar, por lead, uma lista de uploads/anexos (tipo LeadUpload não expandido nesta etapa, fora do necessário)

DURAÇÃO:
APPLICATION_LIFETIME

DADO:
lista de anexos por lead — dado de negócio real

PERSISTÊNCIA_REAL_NECESSÁRIA:
INCERTO

CLASSIFICAÇÃO:
OTHER

API_V2_REQUIRED:
INCERTO

JUSTIFICATIVA:
`setUploads`/`clearUploads` nunca são chamados em nenhum lugar de `apps/web/src`. Inatingível dos dois lados. Observação não confirmada: `apps/api` já expõe `GET/DELETE /clients/:id/attachments` (doc05, clients.service.ts) para o domínio de clientes (CRM) — estruturalmente parecido, mas "leads" e "clients" são entidades distintas no sistema (doc05/TABLE_ENDPOINT: leads→/leads, clientes/contatos→/clients); comparar exigiria apps/api, fora do escopo desta etapa.
```

---

## Resumo

```text
MEMORY_FILES_ANALYZED:
20

UI_TRANSIENT_STATE:
16

RUNTIME_CACHE:
0

REQUEST_STATE:
0

SESSION_STATE:
0

BUSINESS_DATA:
0

MOCK_OR_FALLBACK:
0

TEMPORARY_PROCESSING:
0

STATIC_RUNTIME_DATA:
0

OTHER:
4

UNRESOLVED:
0

MEMORY_USAGES_REQUIRING_API_V2:
0
```

`MEMORY_USAGES_REQUIRING_API_V2: 0` reflete apenas os casos com `API_V2_REQUIRED: SIM` inequívoco — nenhum caso atingiu esse patamar. Os 4 stores `OTHER` têm `API_V2_REQUIRED: INCERTO` (não SIM, não NÃO) porque, sendo inatingíveis hoje (nem lidos nem escritos por nenhum componente), não há evidência de que qualquer tela dependa deles — mas seu formato de dado (agenda/tags/interações/uploads por entidade) sugere uma funcionalidade planejada e nunca conectada, possivelmente sobreposta a endpoints já reais (`/clients/:id/timeline`, `/clients/:id/attachments`) sem confirmação de equivalência de campos (que exigiria consultar `apps/api`, fora do escopo autorizado nesta etapa). Recomenda-se revisão futura dedicada, não coberta por este documento.

## Cobertura

20/20 arquivos `MEMORY` do doc03 lidos por completo. Consumidores verificados por grep individual de cada um dos 20 nomes de hook exportados, com metodologia validada contra um caso de controle (`useTenant()`). Nenhum estado em memória foi alterado ou removido. `apps/api` não foi consultado (apenas o doc05, já produzido dentro desta auditoria de `apps/web`, foi referenciado).
