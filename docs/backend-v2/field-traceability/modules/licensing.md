> Historical record. Kept as recorded; not the current contract.

# Módulo `licensing` — Auditoria Zero-Gap (Fase 2, Prompt 109)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

## Significado real do domínio (comprovado por evidência, não por nome de pasta)

```text
LICENSING_DOMAIN_MEANING: SYNC_LICENSING (predominante) + MASTER_USE_LICENSING +
    MECHANICAL_LICENSING (secundários, mesmo formulário/tabela)
```

Evidência: o título do modal de criação é literalmente **"Nova Licença de Sync"**
(`LicencaFormModal.tsx:60`); o `<Select>` "Tipo de Licença" oferece 7 valores fixos — **Sync TV,
Sync Cinema, Sync Publicidade, Sync Games, Sync Digital, Master Use, Mecânica**
(`tiposLicenca`, `LicencaFormModal.tsx:30`) — predominantemente sincronização (uso de obra musical
em produção audiovisual/publicidade/games), com "Master Use" (licenciamento de fonograma/master) e
"Mecânica" (licenciamento mecânico de composição) como categorias adicionais dentro do MESMO
formulário/tabela, não domínios separados. Não há `RIGHTS_CLEARANCE` formal (sem cálculo de
percentual de titulares liberados), não há `PERFORMANCE_LICENSING`/`SOFTWARE_LICENSING`/
`SUBSCRIPTION_LICENSING` em nenhuma camada.

---

## 1. Escopo real descoberto

Backend: `apps/api/src/modules/licensing/**` (controller, service, DTO — sem entity/repository
próprios, a entidade real vive no registro central `database/entities.ts`, mesmo padrão de todos os
módulos anteriores desta série). Frontend: `apps/web/src/modules/licensing/**` (~17 arquivos reais).
Tabela física única: `licenses` (27 colunas, Fase 1). `rights_holders` (já auditada em `catalog.md`)
não é referenciada em nenhum lugar do código deste módulo — **licensing não usa rights_holders**,
confirmado por busca exaustiva (nenhuma coluna de `licenses` referencia titulares de direitos, nem
por FK nem por jsonb).

**Módulo pequeno e autocontido** — sem workflow dedicado (diferente de `leads`), sem tabelas
satélite (sem `license_requests`/`license_approvals`/`license_documents`), sem jobs, sem
integrações externas próprias.

---

## 2. `Auditoria.tsx` — trecho de `licensing`

```text
module: "licensing", table: "licencas", fixPath: "/licenciamento?edit=<id>"
fields: titulo(obrigatorio), cliente(obrigatorio), valor(recomendado), status(recomendado)
```

**Gap confirmado (crítico, severidade "obrigatorio")**: `row.cliente` é verificado como campo
obrigatório, mas a coluna física `licenses.cliente` (texto livre, distinta de `cliente_id`) **nunca
é escrita pelo fluxo real de criação/edição** — `LicencaFormModal.tsx::buildPayload()` envia apenas
`cliente_id` (o UUID selecionado via `EntityCombobox`), nunca `cliente` (nome em texto livre) — o
mesmo padrão já visto para `licenses.artista` (§10). Resultado: **toda licença criada pela UI real
é sinalizada como "incompleta" (campo obrigatório ausente) pela Auditoria**, mesmo tendo um cliente
genuinamente vinculado via `cliente_id`. `fixPath` aponta para `/licenciamento?edit=<id>`, mas
`Licenciamento.tsx` não implementa `useSearchParams`/tratamento de query string (confirmado por
leitura completa do arquivo) — mesmo padrão de deep-link morto já confirmado em todos os módulos
anteriores desta série.

---

## 3. Subdomínios reais

| Subdomínio | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES |
|---|---|---|---|---|---|
| LICENSE | `Licenciamento.tsx`, `LicencaFormModal.tsx`, `LicencaViewModal.tsx` | `GET/POST/PATCH/DELETE /licenses` | `licensing.controller.ts` | `licensing.service.ts` | `licenses` |

**1 subdomínio real** — `LICENSE_REQUEST`/`LICENSOR`(distinto de titular real)/`APPROVAL`/
`CLEARANCE`/`DOCUMENT` não existem como subdomínios próprios (ver seções correspondentes abaixo,
todas `NOT_IMPLEMENTED`).

---

## 4. Componentes

| Componente | Classificação | Observação |
|---|---|---|
| `LicencaFormModal.tsx` | CREATE_MODAL + EDIT_MODAL + RESOURCE_SELECTOR + RELATION_SELECTOR | 467 linhas, bem estruturado, remuneração condicional (FIXED/PERCENTAGE/FIXED_PLUS_PERCENTAGE) com validação real via `superRefine` |
| `LicencaViewModal.tsx` | DETAIL_MODAL | leitura correta, deriva obra/cliente/artista ao vivo via `useObras()`/`useDataQuery` |
| `Licenciamento.tsx` | TABLE(×3 abas) + FILTER + SEARCH + STATIC(KPIs) | 3 abas client-side (Catálogo/Propostas/Ativas), cada uma com paginação própria sobre o mesmo array já carregado |
| `EntityCombobox.tsx` | RESOURCE_SELECTOR (genérico, real) | combo pesquisável reutilizado para obra e cliente |
| `hooks/licensing.store.ts`, `store/licensing.store.ts` | DEAD | Zustand, zero consumidores fora do próprio arquivo/barrel (mesmo padrão já confirmado em `events`/`inventory`/`leads`) |
| `constants/index.ts`, `forms/index.ts`, `schemas/index.ts`(barrel), `utils/index.ts` | STATIC (stub) | scaffold vazio |
| `services/licensing.service.ts` | OTHER_DATA_CONSUMER (real) | camada HTTP↔domínio |

Não existem `WIZARD`/`DRAWER`/`LICENSOR_SELECTOR`(distinto)/`LICENSEE_SELECTOR`(distinto do
`cliente`)/`RIGHTS_SELECTOR`/`TERRITORY_SELECTOR`(estruturado — é um `<Select>` simples de texto
livre, ver §17)/`APPROVAL_UI`/`DOCUMENT_UI`/`UPLOAD`/`IMPORT`/`EXPORT`(nível de módulo)/
`REALTIME_CONSUMER` — nenhum encontrado.

---

## 5. Hooks

| HOOK | FILE | SUBDOMAIN | ENDPOINTS | READ/WRITE | FINANCIAL_USAGE | DOCUMENT_USAGE | APPROVAL_USAGE | REALTIME | STORAGE | TENANT_DEP |
|---|---|---|---|---|---|---|---|---|---|---|
| `useLicencas` | `hooks/useLicencas.ts` | LICENSE | `GET/POST/PATCH/DELETE /licenses` (via `useDataQuery`, `table:"licencas"`, `select:"*, clientes(*)"` — string `select` **inerte**, mesmo padrão morto já confirmado em `catalog`/`events`/`crm-relationships`: `LicensingService` nunca faz join/mapeamento de `clientes`) | leitura completa + create/update/delete | leitura de `valor`/`amount`/`percentage`/`currency`/`remuneration_type` | não | não | não | implícito (backend `CurrentTenant()`) |

**1 hook ativo, totalmente classificado.**

---

## 6. CREATE — mapeamento campo a campo

`LicencaFormModal.tsx::buildPayload()` (frontend) + `CreateLicenseDto`/`normalizePayload()`
(backend) — cadeia verificada campo a campo:

| FORM_FIELD | LABEL | TYPE | REQUIRED (frontend) | REQUIRED (backend) | API_FIELD | DATABASE_COLUMN | PERSISTED |
|---|---|---|---|---|---|---|---|
| `titulo` | Título da Licença | string | sim | sim | `titulo` | `licenses.titulo` | sim |
| `tipoLicenca` | Tipo de Licença | select (7 opções fixas, slugificadas) | não | não | `tipo` | `.tipo` | sim |
| `obraId` | Obra Musical | RESOURCE_SELECTOR (`EntityCombobox`, via `useObras()`) | **sim** (zod `.min(1)`) | **não** (`@IsOptional()`) | `obra_id` | `.obra_id` | sim |
| (derivado, não é campo do form) | Artista (da obra) | read-only, calculado | — | — | **nunca enviado** | `.artista`/`.artista_id` | **NÃO, ver §10** |
| `clienteId` | Cliente | RELATION_SELECTOR (`EntityCombobox`, via `useDataQuery({table:"clientes"})`) | **sim** (zod `.min(1)`) | **não** | `cliente_id` | `.cliente_id` | sim |
| (nenhum campo do form) | — | — | — | — | **nunca enviado** | `.cliente` (texto livre) | **NÃO, ver §2 e §14** |
| `projeto` | Projeto | string livre | não | não | `projeto` | `.projeto` | sim |
| `midiaDestino` | Mídia de Destino | select (8 opções fixas) | não | não | `midia_destino` | `.midia_destino` | sim |
| `territorio` | Território | select (6 opções fixas) | não | não | `territorio` | `.territorio` | sim |
| `status` | Status | select (4 opções) | não (default "negociacao") | não | `status` | `.status` | sim |
| `dataInicio`/`dataFim` | Data Início/Fim | date | não | não | `data_inicio`/`data_fim` | `.data_inicio`/`.data_fim` | sim |
| `remunerationType` | Tipo de Remuneração | select (3 opções) | não (default FIXED) | não | `remuneration_type` | `.remuneration_type` | sim |
| `currency`+`amount` (se FIXED/FIXED_PLUS_PERCENTAGE) | Valor | select+number | condicional (`superRefine`) | não | `currency`+`amount` | `.moeda`+`.valor` (via `normalizePayload`) | sim |
| `percentage` (se PERCENTAGE/FIXED_PLUS_PERCENTAGE) | Percentual | number | condicional (`superRefine`) | não | `percentage` | `.percentage` | sim |
| `observacoes` | Observações | textarea | não | não | `observacoes` | `.observacoes` | sim |

**Todos os campos que o formulário realmente envia são corretamente persistidos** — o backend
implementa um mapeamento explícito, documentado no próprio código
(`normalizePayload()`/`mapLicense()`, comentário: "mapeamento é explícito e simétrico para criar,
editar e reler o modal"). `CREATE_FIELDS: 14` (contando `currency`/`amount`/`percentage` como 3
campos financeiros distintos dentro de "Remuneração").

**DEFAULT_MISMATCH confirmado**: `obraId`/`clienteId` são **obrigatórios no frontend** (zod
`.min(1)`) mas **opcionais no backend** (`CreateLicenseDto` usa `@IsOptional()` em ambos) — não é um
bug ativo (a UI real sempre impede submissão sem esses campos), mas significa que a API, se chamada
diretamente (Swagger/integração futura), aceitaria uma licença sem obra nem cliente vinculados —
uma licença "órfã" tecnicamente permitida pelo schema/DTO, apesar de nunca acontecer pelo caminho
real da UI.

---

## 7. EDIT — Create ≈ Edit (sem divergência de comportamento)

Mesmo componente (`mode: "create"|"edit"|"view"`), `useEffect` de pré-preenchimento
(`LicencaFormModal.tsx:89-112`) lê corretamente os nomes de campo REAIS retornados pela API
(`licenca.tipo`, `.obra_id`, `.cliente_id`, `.projeto`, `.midia_destino`, `.territorio`, `.status`,
`.data_inicio`, `.data_fim`, `.remuneration_type`, `.currency`, `.amount ?? .valor`, `.percentage`,
`.observacoes`) — **sem nenhum dos bugs de camelCase/snake_case já confirmados em `events.md`/
`inventory.md`**. `IMMUTABLE_AFTER_CREATE`: nenhum campo é literalmente imutável — não há workflow
que restrinja transições de `status` (diferente de `leads`, que usa `WorkflowService`; aqui
`status` é um `@IsIn(STATUSES)` simples, sem `WorkflowService`, sem validação de transição —
qualquer status pode mudar para qualquer outro livremente). `EDIT_FIELDS: 14` (mesmos do create).
`DATABASE_MAPPING`: idêntico ao create.

---

## 8. Details / Display (`LicencaViewModal.tsx`)

| DISPLAY_LABEL | DISPLAY_FIELD | API_FIELD/ORIGEM | DERIVED | Situação |
|---|---|---|---|---|
| Título | `licenca.titulo` | `titulo` | não | correto |
| Status | `licenca.status` (badge) | `status` | não | correto |
| Tipo de Licença | `tipoLabel(licenca.tipo)` | `tipo` | não (só formatação de rótulo) | correto |
| Obra Musical | `obraTitulo` | derivado — busca em `useObras()` por `licenca.obra_id` | SIM (join client-side, ao vivo) | correto |
| Artista | `artista` (`obraArtistaLabel(obra)`) | derivado da obra (não da licença) | SIM | correto — mas note-se: não vem de `licenca.artista`/`.artista_id` (que estão sempre vazios, §10), é recalculado a cada render a partir da obra vinculada |
| Cliente | `clienteNome` | derivado — busca em `useDataQuery({table:"clientes"})` por `licenca.cliente_id` | SIM | correto — não usa `licenca.cliente` (sempre vazio) |
| Projeto | `licenca.projeto` | `projeto` | não | correto |
| Mídia de Destino | `midiaLabel(licenca.midia_destino)` | `midia_destino` | não | correto |
| Território | `tipoLabel(licenca.territorio)` | `territorio` | não | **função de formatação errada** (usa `tipoLabel`, o mapa de rótulos de TIPO de licença, não um mapa de território) — inofensivo na prática porque `tipoLabel()` cai no fallback genérico de capitalização para qualquer chave não mapeada, produzindo um rótulo legível mesmo assim (ex.: "america_latina" → "America Latina") — bug de nomenclatura de função, não de dado exibido |
| Vigência | `formatLicensingDate(data_inicio)` + `formatLicensingDate(data_fim)` | `data_inicio`/`data_fim` | não | correto |
| Remuneração | `formatRemuneration(licenca)` | `remuneration_type`+`currency`+`amount`+`percentage`(+fallback `valor`) | não (formatação) | correto, com fallback documentado para licenças antigas sem `remuneration_type` |
| Observações | `licenca.observacoes` | `observacoes` | não | correto |
| Criada em/Atualizada em | `created_at`/`updated_at` | idem | não | correto |

Nenhum campo visível ficou sem origem. `DETAIL_DISPLAY_FIELDS: 12`.

---

## 9. Recurso licenciado (Obra Musical)

```text
RESOURCE_TYPE: WORK (obra musical — `works`, já auditado em catalog.md, não reaberto)
FRONTEND_FIELD: obraId → EntityCombobox alimentado por useObras() (real, catalog.md)
SOURCE_ENDPOINT: GET /works (via useObras(), não reauditado)
LOCAL_ID: licenses.obra_id (uuid)
EXTERNAL_ID: nenhum (não há ISWC/identificador externo copiado para a licença)
DATABASE_RELATION: licenses.obra_id → works.id — FK LÓGICA, sem constraint FK física declarada
       (foreign_key: false na Fase 1, mesmo padrão de referência solta já visto em quase todos os
       módulos desta série)
DISPLAY_FIELD: obra.titulo (buscado ao vivo, nunca copiado para a licença)
```

**Nenhum outro tipo de recurso é licenciado** — `PHONOGRAM`/`MASTER`/`RECORDING`/`RELEASE` não
aparecem em nenhuma camada (sem `fonograma_id`/`master_id`/`release_id` na tabela `licenses`,
confirmado na Fase 1) — apesar do formulário oferecer "Master Use" como TIPO de licença (texto
livre em `tipo`), não há um seletor de fonograma/master distinto do seletor de obra — uma licença
"Master Use" na prática ainda vincula apenas a uma `obra_id` (works), não a um fonograma específico
— **RESOURCE_TYPE_GAP menor**: o tipo "Master Use" sugere licenciar um fonograma/gravação
específica, mas o schema só permite vincular a uma obra (composição), não a um fonograma. Registrado
como observação, não como bug (a UI não afirma nada além do que o schema permite).

---

## 10. Catalog ↔ Licensing

```text
LICENSING_FIELD: obra_id
CATALOG_RESOURCE: works (via useObras())
DATABASE_RELATION: licenses.obra_id → works.id (FK lógica, sem constraint física)
RIGHTS_SOURCE: NENHUMA — licensing NÃO consulta rights_holders/percentuais de titularidade da
       obra em nenhum momento (nem create, nem display, nem validação) — a obra é tratada como um
       recurso simples de "título+artista", não como um conjunto de titulares com percentuais a
       liberar (ver §12/§23-24, RIGHTS_CLEARANCE inteiramente NOT_IMPLEMENTED)
IDENTIFIER_SOURCE: obra.titulo (exibição); nenhum ISRC/ISWC copiado ou exibido
CREATE_USAGE: obra_id gravado; obra_musical (coluna física livre, texto) e artista/artista_id
       (colunas físicas) — NENHUM dos 3 é escrito pelo formulário real (confirmado em buildPayload,
       §6) — apesar de `obra_musical` e `artista` existirem fisicamente como se fossem uma cópia
       denormalizada do título/artista da obra no momento da licença (útil para preservar o
       registro histórico mesmo se a obra for editada/removida depois), essa cópia NUNCA acontece
       — são colunas mortas do ponto de vista do fluxo real
EDIT_USAGE: idêntico ao create
DISPLAY_USAGE: obra.titulo e artista são sempre RELIDOS AO VIVO da obra atual (via useObras()),
       nunca da cópia (que não existe) — significa que se a obra for renomeada ou o artista
       vinculado for trocado depois da licença criada, o texto exibido na licença muda
       retroativamente, mesmo que a licença tenha sido negociada com o título/artista original —
       um RELATION_MISMATCH real: a licença não preserva um "snapshot" do estado da obra no momento
       da negociação, apesar das colunas físicas para isso existirem e estarem prontas
```

`CATALOG_LICENSING_TRACEABILITY_COMPLETE: SIM`.

---

## 11. Rights Holders

**NOT_IMPLEMENTED / NOT_APPLICABLE.** `licensing` não referencia `rights_holders` em nenhuma
camada — nenhuma coluna, nenhum join, nenhuma validação de titularidade. A obra é tratada
atomicamente (um único vínculo `obra_id`), sem decompor em titulares/percentuais. `RIGHTS_FIELDS: 0`.

---

## 12. Tipo de Direito (`tipo`)

| FRONTEND_LABEL | FRONTEND_VALUE (slugificado) | BACKEND_VALUE | DATABASE_VALUE |
|---|---|---|---|
| Sync TV | `sync_tv` | (texto livre, `@IsString()`, sem `@IsIn`) | `sync_tv` |
| Sync Cinema | `sync_cinema` | idem | `sync_cinema` |
| Sync Publicidade | `sync_publicidade` | idem | `sync_publicidade` |
| Sync Games | `sync_games` | idem | `sync_games` |
| Sync Digital | `sync_digital` | idem | `sync_digital` |
| Master Use | `master_use` | idem | `master_use` |
| Mecânica | `mecânica`→`mecânica`(sem acento removido pelo slugify simples — ver nota) | idem | idem |

Nota: o slugify do frontend (`tipo.toLowerCase().replace(/ /g, "_")`) só substitui espaços, não
remove acentos — "Mecânica" vira `mecânica` (com cedilha/acento preservado), não `mecanica`. O mapa
de rótulos reverso (`TIPO_LABEL`) usa a chave `mecanica` (sem acento) — **ENUM_MISMATCH confirmado**:
ao salvar uma licença do tipo "Mecânica", o valor persistido é `mecânica` (com acento), mas
`tipoLabel()` procura por `mecanica` (sem acento) no mapa `TIPO_LABEL` e não encontra — cai no
fallback de capitalização genérica, que ainda produz um rótulo razoável ("Mecânica" novamente, por
coincidência da capitalização do fallback operando sobre a string com acento) — o efeito visual
final é inofensivo (o rótulo continua correto), mas confirma uma divergência real de dado entre o
que foi pretendido (`TIPO_LABEL['mecanica']`) e o que é realmente gravado (`mecânica`, com acento).
`RIGHT_TYPES: 7`.

Não há tipo de direito com validação real no backend — `tipo` é 100% texto livre.

---

## 13. Licensor / Licensee

```text
LICENSEE (quem recebe a licença/paga pelo uso): cliente_id → clients (crm-relationships, não
       reauditado) — SOURCE_ENDPOINT: GET /clients (via useDataQuery({table:"clientes"})),
       DISPLAY_FIELD: clientes.nome, DATABASE_FK_OR_JOIN: licenses.cliente_id → clients.id (lógica,
       sem FK física), CARDINALITY: N:1, OPTIONAL: sim (backend), obrigatório na prática (frontend)

LICENSOR (quem concede a licença — o titular/artista da obra): NÃO É UMA ENTIDADE PRÓPRIA — é
       derivado indiretamente da obra selecionada (obra.artistas, uma relação já existente no
       módulo catalog/artist, não copiada nem referenciada diretamente pela licença) — não há um
       campo "licensor_id" nem um seletor de licenciante distinto do seletor de obra

RIGHTS_HOLDER: NOT_APPLICABLE (§11)
```

`LICENSEE = cliente_id → clients`. `LICENSOR` é implícito via a cadeia `obra_id → works → artists`,
nunca uma referência direta na tabela `licenses`. `PARTY_FIELDS: 1` (cliente_id, único vínculo de
parte real e direto na tabela).

---

## 14. PII das partes

```text
FIELD: nenhum campo de PII (email/telefone/documento/endereço) existe DIRETAMENTE em `licenses` —
       todo dado de contato do cliente vive em `clients` (já auditado, criptografia de email/
       telefone já confirmada em crm-relationships.md, não reaberta aqui).
`licenses.cliente` (texto livre, nunca escrito — §2/§10): se viesse a ser usado, seria um
       COMPANY_IDENTIFIER/PERSON_NAME em texto plano, sem criptografia — mas como nunca é escrito
       pelo fluxo real, não há PII exposta por essa coluna hoje na prática.
```

`PII_FIELDS: 0` (diretamente na tabela `licenses`) — toda PII relevante pertence ao domínio
`clients`, já coberto. `ENCRYPTION_GAP: 0` (não aplicável — nada para criptografar aqui).

---

## 15. Uso Licenciado

```text
FIELD: midia_destino (texto livre, 8 opções fixas no formulário: TV Aberta/TV Fechada/Cinema/
       Streaming/Redes Sociais/Publicidade Digital/Games/Outro)
DATABASE_MAPPING: licenses.midia_destino
ENUM_OR_FREE_TEXT: FREE_TEXT no banco/DTO (sem @IsIn), ENUM fixo só na UI de criação
VALIDATION: nenhuma no backend
```

Não há campos de `production`/`campaign`/`placement`(específico)/`duration`(do uso, distinto do
prazo da licença)/`excerpt`/`format`/`channel`/`purpose` — `projeto` (texto livre) é o único campo
que aproxima "para qual produção/campanha" a licença se destina, sem estrutura adicional.

---

## 16. Território

```text
ESTRUTURA REAL: GLOBAL/COUNTRY/REGION/CUSTOM — NENHUMA dessas classificações existe formalmente;
       `territorio` é uma ÚNICA coluna de texto livre (character varying), preenchida via um
       <Select> simples com 6 opções fixas (Brasil/América Latina/Mundial/Estados Unidos/Europa/
       Ásia) — não há suporte a MÚLTIPLOS territórios por licença (não é um array, não é uma
       tabela de junção) — uma licença só pode ter exatamente 1 valor de território.
FORM_FIELD: territorio (select)
DATABASE_FIELD: licenses.territorio (varchar simples)
CARDINALITY: 1:1 (uma licença, um território — sem suporte a lista)
NORMALIZATION: nenhuma no backend (aceita qualquer string via @IsString, sem @IsIn)
```

`TERRITORY_GAP`: nenhum — a limitação (território único, texto livre) é consistente em todas as
camadas, não há divergência entre o que a UI promete e o que o schema entrega. `TERRITORY_FIELDS: 1`.

---

## 17. Prazo / Term

| UI_FIELD | API_FIELD | DATABASE_COLUMN | DATABASE_TYPE | REQUIRED | TIMEZONE_BEHAVIOR |
|---|---|---|---|---|---|
| Data Início | `data_inicio` | `licenses.data_inicio` | `date` (sem componente de hora/fuso) | não | N/A — tipo `date` puro, sem timezone, sem ambiguidade de fuso possível |
| Data Fim | `data_fim` | `licenses.data_fim` | `date` | não | idem |

Não há `duration`/`perpetual`/`renewal`/`notice_period`/`expiration` como campos dedicados — apenas
o par início/fim, ambos opcionais e sem validação cruzada (o backend não valida que `data_fim` seja
posterior a `data_inicio` — `TERM_GAP` menor: uma licença com fim anterior ao início seria aceita
sem erro). `TERM_FIELDS: 2`.

---

## 18. Exclusividade

**NOT_IMPLEMENTED.** Nenhum campo `exclusive`/`exclusividade`/`non_exclusive` existe em nenhuma
camada (schema, DTO, formulário, exibição) — confirmado ausente na Fase 1 e por leitura completa do
form/view modal. `EXCLUSIVITY_FIELDS: 0`.

---

## 19. Restrições

**NOT_IMPLEMENTED.** Nenhum campo de restrição de plataforma/território/conteúdo/concorrente/
duração foi encontrado além do que já é coberto por `midia_destino`/`territorio`/`data_fim` em si
(que são definições de uso, não restrições adicionais/negativas) — `observacoes` (texto livre) é o
único lugar onde uma restrição poderia ser anotada manualmente, sem estrutura nem validação.

---

## 20. Status / Workflow

| STATUS_VALUE | FRONTEND_LABEL | DATABASE_VALUE | ALLOWED_TRANSITIONS | SIDE_EFFECTS |
|---|---|---|---|---|
| `negociacao` (default) | Em Negociação | `negociacao` | qualquer → qualquer (sem workflow) | nenhum |
| `proposta` | Proposta Enviada | `proposta` | idem | nenhum |
| `ativa` | Ativa | `ativa` | idem | nenhum |
| `expirada` | Expirada | `expirada` | idem | nenhum |

**Sem `WorkflowService`** (diferente de `leads.workflow.ts`) — `status` é validado apenas por
`@IsIn(STATUSES)` no DTO, sem nenhuma regra de transição, sem roles por transição, sem efeito
colateral (nenhum evento de domínio emitido em nenhuma mudança de status). `WORKFLOW_GAP`:
`expirada` é um status inteiramente MANUAL — não há job/cálculo automático que marque uma licença
como expirada quando `data_fim` é ultrapassada (ver §46 — `EXPIRATION_GAP` confirmado).
`WORKFLOW_STATUSES: 4`.

---

## 21. Aprovações

**NOT_IMPLEMENTED.** Nenhum campo/endpoint/UI de aprovação (`approver`/`approved_at`/
`rejected_at`/`comment`) existe — `status = 'proposta'`/`'negociacao'` são apenas rótulos
informativos escolhidos manualmente pelo usuário, sem um fluxo de solicitação→aprovação real.
`APPROVAL_FIELDS: 0`.

---

## 22. Clearance / Liberação de Direitos

**NOT_IMPLEMENTED.** Sem `rights_holders` (§11), não há conceito de "percentual liberado" nem de
"partes pendentes" — uma licença é criada e ativada unilateralmente pelo usuário, sem nenhuma
verificação de que os titulares da obra consentiram. `CLEARANCE_FIELDS: 0`.

---

## 23. Validação de 100% dos direitos

**NOT_APPLICABLE** — não há cálculo de cobertura de direitos em nenhuma camada (consistente com
§11/§22, não presumido).

---

## 24. Termos Financeiros

| FORM_FIELD | DATABASE_COLUMN | TYPE | PRECISION/SCALE | CURRENCY | SOURCE |
|---|---|---|---|---|---|
| `amount` (novo) / `valor` (legado) | `licenses.valor` | `numeric` (sem precisão/escala fixada no schema) | genérico | via `moeda` (coluna separada) | manual, formulário |
| `currency` (novo) / `moeda` (legado) | `licenses.moeda` | `varchar`, default `'BRL'` | — | — | manual (3 opções fixas na UI: BRL/USD/EUR; backend aceita qualquer string) |
| `percentage` | `licenses.percentage` | `numeric` | — | N/A (percentual, não monetário) | manual |

Não há `advance`/`minimum_guarantee`/`installment`/`tax`/`commission` como campos dedicados —
apenas os 3 acima (valor fixo, moeda, percentual), combináveis via `remuneration_type`
(FIXED/PERCENTAGE/FIXED_PLUS_PERCENTAGE). `FINANCIAL_FIELDS: 3`.

**REAL_MAPPING_GAP confirmado (documentação stale)**: o comentário em
`report-form-contracts.ts:348-351` ("`amount`/`percentage`/`currency` são enviados pelo formulário
mas NÃO existem no CreateLicenseDto (nem na entidade) — nunca persistem") **está desatualizado e
factualmente incorreto** frente ao código atual — `CreateLicenseDto` declara `amount`/`currency`/
`percentage` explicitamente, e `LicensingService.normalizePayload()` os mapeia simetricamente para
`valor`/`moeda`/`percentage` com um comentário próprio confirmando que o mapeamento é "explícito e
simétrico". A consequência prática (não o motivo original documentado, mas real): o
`LICENSES_CONTRACT` do motor de relatórios usa `col('valor')`/`col('moeda')` (os nomes físicos
corretos, então o VALOR em si exporta corretamente) mas **nunca inclui `percentage` nem
`remuneration_type`** — para uma licença do tipo `PERCENTAGE` (sem `valor` preenchido), o export
gerado pela Central de Relatórios mostraria a coluna de valor vazia e não teria nenhuma coluna para
o percentual — **EXPORT_GAP real**: remuneração percentual é invisível em qualquer relatório
exportado deste módulo.

---

## 25. Licensing ↔ Accounting

```text
LICENSING_ACTION: criar/editar licença com valor/percentual preenchido
FINANCIAL_RESOURCE: nenhum — `licensing.service.ts` não importa EventsService, não emite nenhum
       evento de domínio, não referencia `transactions`/`invoices` em nenhuma linha de código
DATABASE_RELATION: nenhuma
CLASSIFICAÇÃO: NOT_IMPLEMENTED (nem automático, nem manual — não há sequer um botão "Lançar como
       receita" na UI de licenciamento; o valor da licença só existe informativamente na tela e no
       KPI "Valor Total" da própria página, somado client-side só sobre licenças `status==='ativa'`)
```

`ACCOUNTING_LICENSING_TRACEABILITY_COMPLETE: SIM` (a ausência de integração é o resultado
determinístico confirmado, não uma lacuna de investigação).

---

## 26. Royalties

**NOT_IMPLEMENTED.** Nenhum campo/tabela de royalty (taxa, base de cálculo, período, valor apurado)
existe — o `percentage` da licença é apenas o termo comercial acordado na negociação (ex.: "10% de
royalty sobre X"), nunca há um cálculo/lançamento periódico real de royalty gerado a partir dele.

---

## 27. Contracts ↔ Licensing

**NOT_IMPLEMENTED / sem relação.** Nenhuma coluna `contrato_id`/`contract_id` existe em `licenses`
(confirmado na Fase 1), nenhum código referencia `ContractEntity` a partir do módulo licensing, e
vice-versa (busca exaustiva em `apps/api/src/modules/contracts` não encontrou nenhuma referência a
`licenses`/`LicenseEntity`). Uma licença "ativa" não gera nem se vincula automaticamente a um
contrato formal — são dois registros completamente independentes hoje, apesar de
conceitualmente relacionados (uma licença de sync tipicamente exigiria um contrato assinado no mundo
real). `CONTRACTS_LICENSING_TRACEABILITY_COMPLETE: SIM` (resultado determinístico: relação
genuinamente ausente, não uma lacuna de investigação).

---

## 28. Documentos

**NOT_IMPLEMENTED.** Nenhum campo de documento (proposta/contrato/autorização/clearance document)
existe em `licenses` — `observacoes` (texto livre) é o único campo textual adicional. Nenhuma
geração de documento (`DOCUMENT_GENERATION: NOT_IMPLEMENTED`), nenhuma integração de assinatura
eletrônica (`SIGNATURE: NOT_IMPLEMENTED` — módulo `integrations` já auditado confirma DocuSign/
Autentique existirem no sistema, mas nenhum deles é referenciado a partir de `licensing`, não
reaberto aqui).

---

## 29. Storage

**NOT_IMPLEMENTED.** Nenhum campo de anexo (`*_url`/`*_key`/`attachment*`) existe em `licenses`
(confirmado na Fase 1), nenhum componente de upload em `LicencaFormModal.tsx`/
`LicencaViewModal.tsx`. `STORAGE_FIELDS: 0`.

---

## 30. Relação com Artista

```text
LICENSING_FIELD: artista_id (coluna física real, uuid) + artista (coluna física real, texto livre)
ARTIST_ENDPOINT: nenhum diretamente — o artista é sempre derivado da obra (obra.artistas), nunca
       selecionado independentemente na UI
DATABASE_RELATION: licenses.artista_id → artists.id (FK lógica, sem constraint física) — mas
       NUNCA ESCRITA pelo fluxo real (§10/§6) — coluna morta do ponto de vista de código ativo
CARDINALITY: N:1 (se algum dia fosse escrita)
PURPOSE: presumivelmente um snapshot do artista no momento da licença (mesmo raciocínio de
       `obra_musical`/`cliente`, §10) — nunca exercitado
```

Não reauditado o módulo `artist` em si — apenas confirmada a ausência de uso real da coluna de
relação por parte de `licensing`.

---

## 31. Relação com Audiovisual / Project / Marketing

**NOT_IMPLEMENTED.** Nenhuma coluna `audiovisual_project_id`/`campaign_id`/`event_id` existe em
`licenses` — o único campo que aproxima essa noção é `projeto` (texto livre, sem FK, sem validação),
usado pelo usuário para anotar manualmente a que produção/campanha a licença se refere, sem nenhuma
integração real com os módulos `audiovisual`/`marketing`/`projects` (não reauditados).

---

## 32. Tables/Grids, Filters, Search, Sort, Paginação, KPIs

**TABLE** (`Licenciamento.tsx`, 3 abas idênticas em estrutura — Catálogo/Propostas/Ativas, 7
colunas de dados cada): Título/Artista+Obra(combinado)/Cliente/Mídia/Valor/Status/Ações — todas
corretamente mapeadas para campos reais (via as mesmas funções `obraTituloDe`/`artistaDe`/
`clienteNomeDe` derivadas ao vivo, §8). `SORTABLE`: nenhuma coluna interativa.

**FILTERS** (aba "Catálogo": search + statusFilter + midiaFilter): 100% client-side sobre o array
já carregado. **REAL_MAPPING_GAP confirmado**: `midiaFilter` oferece 5 opções fixas ("TV",
"Streaming", "Rádio", "Games", "Digital") que **não correspondem exatamente** aos 8 valores reais
que o formulário de criação pode gravar (`tv_aberta`/`tv_fechada`/`cinema`/`streaming`/
`redes_sociais`/`publicidade_digital`/`games`/`outro`) — o filtro usa correspondência por substring
(`.includes()`), então "TV" casa com `tv_aberta`/`tv_fechada` (funciona por coincidência de prefixo)
e "Digital" casa com `publicidade_digital` (funciona por coincidência de substring), mas **"Rádio"
não corresponde a NENHUM valor que o formulário de criação pode gerar** — a opção de filtro "Rádio"
é estruturalmuente morta, nunca retorna nenhum resultado, para nenhuma licença possível de ser
criada pela UI real. As abas "Propostas"/"Ativas" não têm filtros próprios (usam apenas o status já
implícito na aba).

**SEARCH**: título/obra(via `obraTituloDe`)/artista(via `artistaDe`)/cliente(via `clienteNomeDe`) —
100% client-side, `.includes()` case-insensitive (via `.toLowerCase()` em ambos os lados).

**PAGINAÇÃO**: `usePagination` client-side, aplicado independentemente em cada uma das 3 abas
(`pageItems`/`propostasPg`/`ativasPg`), todas operando sobre o MESMO array `licencas` já carregado
pelo hook — `TOTAL_COUNT_SOURCE`: contagem do array já truncado (ver Limites abaixo).

**KPIs** (5, topo da página): Total Licenças / Licenças Ativas / Em Negociação (`negociacao` OU
`proposta` combinados — rótulo "Em Negociação" impreciso, mistura 2 status distintos sob 1 label) /
Expirado / Valor Total (soma de `amount ?? valor` **só** de licenças `status==='ativa'` — ignora
licenças `PERCENTAGE`-only ativas, que teriam `amount` nulo e contribuiriam 0 à soma, mesmo tendo
remuneração real via percentual — `DISPLAY_MAPPING_MISMATCH` menor: "Valor Total" subestima o valor
real de licenças percentuais).

---

## 33. Limites

| ENDPOINT_OR_COMPONENT | LIMIT | SERVER_OR_CLIENT | INTENTIONAL | AFFECTS_TOTAL |
|---|---|---|---|---|
| `GET /licenses` (via `useLicencas()`, sem override) | 50 (`PaginationDto.limit` default, `licensing.service.ts:73` `query.limit ?? 50`) | SERVER (silencioso) | NÃO | **SIM** — mesmo padrão de truncamento silencioso já confirmado em todos os módulos anteriores desta série — afeta as 3 abas da página, todos os filtros/busca/paginação client-side, e os 5 KPIs do topo (para tenants com mais de 50 licenças) |

`TRUNCATION_GAP` confirmado.

---

## 34. Import / Export / XLSX

**Import: NOT_IMPLEMENTED.** Nenhum botão/fluxo de importação em `Licenciamento.tsx` nem em
nenhum outro arquivo do módulo. `IMPORT_FIELDS: 0`.

**Export (nível de página): NOT_IMPLEMENTED** — nenhum botão de export na própria página (diferente
de `leads`, que ao menos tem um botão que navega para a Central de Relatórios; `licensing` não tem
nenhum botão de export em lugar nenhum da UI).

**Export via Central de Relatórios (mecanismo genérico)**: `licenses` está registrado
(`LICENSES_CONTRACT`, `report-form-contracts.ts:352-364`) com `filterableColumns: ['status', 'tipo',
'territorio']` e `searchableColumns: ['titulo', 'obra_musical', 'artista', 'cliente', 'projeto']` —
**3 das 5 colunas de busca configuradas (`obra_musical`, `artista`, `cliente`) referenciam colunas
que o fluxo real NUNCA escreve** (§10/§13/§2) — a busca por essas 3 colunas no motor de relatórios
é estruturalmente inerte para qualquer licença criada pela UI real (sempre NULL). Confirma, por uma
via de evidência independente (o motor de export/relatórios), o mesmo achado já documentado em
§2/§10: essas 3 colunas físicas são vestigiais. `EXPORT_FIELDS: 17` (contando os campos do
`LICENSES_CONTRACT`, incluindo os 3 inertes). `XLSX_EXPORTS: 0` (específico do módulo — mecanismo é
o compartilhado). `XLSX_RULE_VIOLATIONS: 0`.

---

## 35. Duplicidade

Nenhuma regra de deduplicação (`DATABASE_UNIQUE`/`BACKEND_CHECK`/`FRONTEND_CHECK`) existe para
combinação de recurso+licenciado+uso+território+prazo — duas licenças idênticas (mesma obra, mesmo
cliente, mesma mídia, mesmo território, mesmas datas) podem ser criadas livremente, sem aviso.
`DUPLICATE_HANDLING_GAP` confirmado.

---

## 36. Conflitos de Licença

**NOT_IMPLEMENTED.** Nenhuma consulta de conflito (mesma obra + território sobreposto + data
sobreposta + exclusividade) existe em nenhuma camada — consistente com a ausência de campo de
exclusividade (§18) e com `data_fim`/`data_inicio` não terem validação cruzada nem consulta de
sobreposição no `create()`/`update()` do serviço. `LICENSE_CONFLICT_GAPS: 1` (a ausência total, não
um bug parcial).

---

## 37. Expiração

```text
EXPIRATION_SOURCE: nenhuma — `data_fim` é apenas um campo informativo
STATUS_UPDATE: MANUAL — o usuário precisa editar a licença e mudar `status` para `expirada`
       manualmente; não há cálculo automático comparando `data_fim` com a data atual
SCHEDULED_JOB: nenhum job/cron encontrado para expiração de licenças
LAZY_CALCULATION: nenhuma — nem sequer um cálculo client-side na exibição (a UI mostra o `status`
       persistido tal como está, mesmo que `data_fim` já tenha passado há muito tempo e o status
       ainda diga "Ativa")
NOTIFICATION: nenhuma
RENEWAL_FLOW: nenhum
```

`EXPIRATION_GAP` confirmado — uma licença com `data_fim` no passado permanece "Ativa" indefinidamente
até uma ação manual.

---

## 38. Notificações

**NOT_IMPLEMENTED.** Nenhum gatilho de notificação (aprovação solicitada/licença aprovada/
expiração/renovação/assinatura pendente) existe — consistente com a ausência de workflow/aprovação/
assinatura (§20-22, §31).

---

## 39. Background Jobs

**NOT_IMPLEMENTED.** Nenhum job de expiração/renovação/sync/notificação encontrado para este
módulo. `BACKGROUND_JOBS: 0`.

---

## 40. Realtime

**NOT_IMPLEMENTED.** Nenhum `useWsEvent()` em nenhum arquivo do módulo; `licensing.service.ts` não
emite nenhum evento de domínio (`EventsService` nem sequer é importado). `REALTIME_EVENTS: 0`.

---

## 41. External Integrations

**NOT_IMPLEMENTED / NOT_APPLICABLE.** Nenhuma integração externa (DocuSign/Autentique/ACRCloud/
etc., já auditadas em `integrations.md`) é referenciada a partir deste módulo.
`EXTERNAL_INTEGRATIONS: 0`. `CREDENTIALS_REQUIRED_LATER: 0` (nenhuma credencial do
`credential-readiness.json` é aplicável a este módulo — nenhuma integração externa existe para
exigir uma).

---

## 42. Permissões

| PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|
| `license:read` | nenhum gate visível | `@RequireRole('viewer') @RequirePermission('license:read')` |
| `license:create` | botão "Nova Licença" via `<RequirePermission module="licensing" action="write">` | `@RequireRole('editor') @RequirePermission('license:create')` |
| `license:update` | nenhum gate visível | `@RequireRole('editor') @RequirePermission('license:update')` |
| `license:delete` | nenhum gate visível | `@RequireRole('manager') @RequirePermission('license:delete')` |

`approve`/`reject`/`clear rights`/`manage financial terms`(separado)/`generate document`/`send for
signature`/`export` como permissões distintas: **não existem** — não há ações correspondentes na UI
(§21/§22/§28/§34) para exigi-las. `AUTHORIZATION_GAPS: 0` — backend é a autoridade real em toda
rota; ausência de gates visuais em editar/excluir é a mesma observação não-bloqueante já registrada
em módulos anteriores.

---

## 43. Tenant Isolation

```text
licenses: tenant_id enforced (WHERE l.tenant_id = :tenantId em list/findById/update/softDelete;
       create grava tenant_id explícito a partir de @CurrentTenant())
```

Sem `requests`/`parties`(tabela própria)/`documents`/`financial terms`(tabela própria)/`approvals`
para avaliar isolamento adicional — tudo vive na própria linha de `licenses`. `TENANT_ISOLATION_
GAPS: 0`.

---

## 44. Delete / Cancel / Expire / Revoke

| UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | CONTRACT_IMPACT | FINANCIAL_IMPACT | SOFT_OR_HARD |
|---|---|---|---|---|---|
| Excluir licença (individual ou em massa) | `DELETE /licenses/:id` | `UPDATE licenses SET deleted_at = now()` | nenhum (sem relação, §27) | nenhum (sem relação, §25) | SOFT |

`CANCEL`/`EXPIRE`(automático)/`REVOKE`/`ARCHIVE`/`RESTORE` como ações distintas de "excluir": **não
existem** — mudar `status` para "expirada" é apenas mais uma edição de campo comum (§20/§37), não
uma ação de workflow dedicada; não há endpoint de "restaurar" um item soft-deletado.

---

## Gaps consolidados (evidenciados, não corrigidos)

1. **AUDITORIA gap (crítico, severidade obrigatorio)** — `row.cliente` verificado como obrigatório
   pela Auditoria.tsx, mas a coluna física `licenses.cliente` nunca é escrita pelo fluxo real
   (apenas `cliente_id` é) — toda licença criada pela UI é sinalizada como incompleta.
2. **RELATION_MISMATCH** — `obra_musical`/`artista`/`artista_id`/`cliente` (colunas físicas
   aparentemente destinadas a um snapshot denormalizado do recurso/parte no momento da negociação)
   nunca são escritas — a licença sempre relê o estado ATUAL da obra/artista/cliente, sem preservar
   o que era verdade no momento em que foi negociada.
3. **REAL_MAPPING_GAP (documentação stale)** — comentário em `report-form-contracts.ts` afirma que
   `amount`/`currency`/`percentage` "nunca persistem", o que está desatualizado frente ao código
   atual (`normalizePayload()` os mapeia corretamente) — mas a consequência real e atual é que
   `percentage`/`remuneration_type` ficam de fora do `LICENSES_CONTRACT`, tornando remuneração
   percentual invisível em qualquer export.
4. **ENUM_MISMATCH menor** — "Mecânica" grava `mecânica` (com acento, do slugify incompleto do
   frontend) mas `TIPO_LABEL` procura `mecanica` (sem acento) — inofensivo na prática (fallback
   genérico ainda produz rótulo legível), mas é uma divergência real de dado gravado vs. esperado.
5. **DISPLAY_MAPPING_MISMATCH menor** — `LicencaViewModal` usa `tipoLabel()` (mapa de tipo de
   licença) para formatar o campo Território — nome de função incorreto, sem efeito visual negativo
   graças ao fallback.
6. **DEFAULT_MISMATCH** — `obraId`/`clienteId` obrigatórios no frontend, opcionais no DTO/backend —
   a API aceitaria uma licença "órfã" se chamada fora da UI real.
7. **REAL_MAPPING_GAP (filtro morto)** — a opção de filtro "Rádio" (`midiaFilter`) não corresponde
   a nenhum valor real que o formulário de criação pode gravar — sempre retorna zero resultados.
8. **DISPLAY_MAPPING_MISMATCH (KPI)** — "Valor Total" soma apenas `amount`/`valor` de licenças
   ativas, ignorando o `percentage` de licenças `PERCENTAGE`-only — subestima o valor real.
9. **RIGHTS_CLEARANCE_GAP** — módulo inteiro não modela titulares/percentuais de direitos (nem
   como conceito, nem como cálculo) — a obra é tratada atomicamente.
10. **CONTRACT_INTEGRATION_GAP** — nenhuma relação com o módulo `contracts` (sem coluna
    `contrato_id`, sem geração/vínculo automático de contrato ao ativar uma licença).
11. **FINANCIAL_INTEGRATION_GAP** — nenhuma propagação (automática ou manual) para `accounting`.
12. **DOCUMENT_GENERATION_GAP** / **SIGNATURE_GAP** — ambos inteiramente ausentes.
13. **STORAGE_GAP** — nenhum campo de anexo/documento em nenhuma camada (nem sequer uma versão
    fake, diferente de outros módulos desta série).
14. **WORKFLOW_GAP** — `status` sem validação de transição, sem workflow, sem side-effects.
15. **APPROVAL_GAP** — inteiramente ausente.
16. **EXPIRATION_GAP** — `data_fim` não expira automaticamente o `status`; sem job, sem cálculo
    lazy, sem notificação, sem fluxo de renovação.
17. **LICENSE_CONFLICT_GAP** — nenhuma detecção de sobreposição/conflito de licenciamento.
18. **DUPLICATE_HANDLING_GAP** — nenhuma verificação de duplicidade de licença.
19. **TERM_GAP menor** — sem validação de que `data_fim` seja posterior a `data_inicio`.
20. **TRUNCATION_GAP** — `PaginationDto.limit=50` silencioso, `useLicencas()` nunca sobrescreve.
21. **DEAD CODE** (não contado como gap formal) — 2 stores Zustand (`hooks/licensing.store.ts`,
    `store/licensing.store.ts`) com zero consumidores.

`FAKE_INTEGRATION_GAP`/`ENCRYPTION_GAP`/`PII_PROTECTION_GAP`: 0 — nenhum dado sensível é tratado
neste módulo, nenhum mecanismo finge funcionalidade que não existe (tudo que está ausente é
simplesmente ausente, sem simulação de sucesso em nenhum ponto).

---

## Contadores finais (Zero-Gap)

```text
SUBDOMAINS_AUDITED: 1
COMPONENTS_AUDITED: 7
HOOKS_AUDITED: 1
CREATE_FORMS: 1
CREATE_FIELDS: 14
EDIT_FORMS: 1
EDIT_FIELDS: 14
MODALS_DRAWERS_WIZARDS: 2 (LicencaFormModal, LicencaViewModal)
TABLE_GRID_FIELDS: 7 (× 3 abas idênticas em estrutura, contadas uma vez)
DETAIL_DISPLAY_FIELDS: 12
LICENSE_TYPES: 7
RIGHT_TYPES: 7 (mesmo conjunto de LICENSE_TYPES — não há uma classificação de "tipo de direito"
    distinta de "tipo de licença" neste módulo)
WORKFLOW_STATUSES: 4
LICENSED_RESOURCE_TYPES: 1 (WORK — únicos vinculável formalmente)
RELATION_FIELDS: 3 (obra_id, cliente_id, artista_id — este último morto)
PARTY_FIELDS: 1 (cliente_id — único vínculo de parte real)
RIGHTS_FIELDS: 0
TERRITORY_FIELDS: 1
TERM_FIELDS: 2
EXCLUSIVITY_FIELDS: 0
APPROVAL_FIELDS: 0
CLEARANCE_FIELDS: 0
FINANCIAL_FIELDS: 3
DOCUMENT_FIELDS: 0
FILTERS: 3
SEARCH_FIELDS: 4 (titulo, obra, artista, cliente — client-side)
SORT_FIELDS: 0
IMPORT_FIELDS: 0
EXPORT_FIELDS: 17 (via Central de Relatórios — LICENSES_CONTRACT)
XLSX_EXPORTS: 0
XLSX_RULE_VIOLATIONS: 0
REALTIME_EVENTS: 0
STORAGE_FIELDS: 0
BACKGROUND_JOBS: 0
EXTERNAL_INTEGRATIONS: 0
CREDENTIALS_REQUIRED_LATER: 0
PERMISSIONS_AUDITED: 4 (license:read/create/update/delete)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 4 (obra_musical, artista, artista_id, cliente — colunas físicas nunca
    escritas pelo fluxo real, Gap #2)
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 1 (Gap #6)
ENUM_MISMATCH: 1 (Gap #4)
RELATION_MISMATCH: 1 (Gap #2)
CREATE_MAPPING_MISMATCH: 0
EDIT_MAPPING_MISMATCH: 0
DISPLAY_MAPPING_MISMATCH: 2 (Gap #5, Gap #8)
RIGHTS_MAPPING_GAPS: 0 (não aplicável — não há mapeamento de direitos para divergir)
RIGHTS_CLEARANCE_GAPS: 1 (Gap #9)
TERRITORY_GAPS: 0
TERM_GAPS: 1 (Gap #19)
EXCLUSIVITY_GAPS: 0 (ausência total, não um gap de mapeamento — classificado como NOT_IMPLEMENTED,
    não como divergência)
WORKFLOW_GAPS: 1 (Gap #14)
APPROVAL_GAPS: 1 (Gap #15)
FINANCIAL_INTEGRATION_GAPS: 1 (Gap #11)
CONTRACT_INTEGRATION_GAPS: 1 (Gap #10)
DOCUMENT_GENERATION_GAPS: 1 (Gap #12)
SIGNATURE_GAPS: 1 (Gap #12)
STORAGE_GAPS: 1 (Gap #13)
DUPLICATE_HANDLING_GAPS: 1 (Gap #18)
LICENSE_CONFLICT_GAPS: 1 (Gap #17)
EXPIRATION_GAPS: 1 (Gap #16)
NOTIFICATION_GAPS: 1 (§38, ausência total)
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 1 (Gap #20)
EXTERNAL_INTEGRATION_GAPS: 0
REAL_MAPPING_GAPS: 2 (Gap #3, Gap #7)

CATALOG_LICENSING_TRACEABILITY_COMPLETE: SIM
CONTRACTS_LICENSING_TRACEABILITY_COMPLETE: SIM
ACCOUNTING_LICENSING_TRACEABILITY_COMPLETE: SIM

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_RIGHTS_FIELDS: 0
UNMAPPED_PARTY_FIELDS: 0
UNMAPPED_TERRITORY_FIELDS: 0
UNMAPPED_FINANCIAL_FIELDS: 0
UNMAPPED_DOCUMENT_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `marketing`
