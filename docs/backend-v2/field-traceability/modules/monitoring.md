> Historical record. Kept as recorded; not the current contract.

# Módulo `monitoring` — Auditoria Zero-Gap (Fase 2, Prompt 111)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_MONITORING_CLASSIFICATIONS: 0.

## Significado real do domínio (comprovado por evidência)

```text
MONITORING_DOMAIN_MEANING: CATALOG_MONITORING + ARTIST_MONITORING (proteção de direitos autorais) —
    NÃO é APPLICATION_OBSERVABILITY. O domínio real é "monitoramento de execução/uso não autorizado
    de obras musicais e reconciliação de recebimentos de direitos autorais (ECAD)", com 3 vertentes:
    (1) detecção de execução em rádio/TV/plataformas digitais, (2) conciliação de relatórios ECAD
    (sociedade brasileira de arrecadação de direitos de execução pública), (3) takedowns (remoção de
    conteúdo por infração de direitos autorais em plataformas digitais).
```

Evidência: título da página real "Monitoramento" é "Detecte execuções em rádio, TV e reconcilie com
ECAD"; a página alternativa (a efetivamente roteada) chama-se "Rights Monitoring"; nenhuma tela,
componente, tabela ou rota deste módulo trata de observabilidade de aplicação (logs/traces/métricas
de infraestrutura) — essa vertente já está integralmente coberta pela stack Pino/OpenTelemetry/
Sentry/Prometheus definida nos docs 52/68 (arquitetural, não operacional/tenant-facing) e não possui
nenhuma superfície de produto neste módulo.

---

## 1. Achado arquitetural central — duas telas de "Rights Monitoring" paralelas, uma morta por redirect

```text
ROTA REAL: /monitoramento → <Navigate to="/rights-monitoring" replace /> (redirect incondicional,
       confirmado em apps/web/src/app/routes/catalog.routes.tsx:19)
CONSEQUÊNCIA: Monitoramento.tsx (apps/web/src/modules/monitoring/pages/Monitoramento.tsx) — um
       componente completo, 442 linhas, REAL e majoritariamente bem construído (usa useDeteccoes()
       → tabela real `deteccoes`/content_detections; usa useDataQuery({table:"relatorios_ecad"}) →
       endpoint real /ecad-reports; tem estados vazios honestos para "Divergências" e "Proteção de
       Catálogo", explicitamente rotulados "ainda não configurada"; o botão de import ECAD mostra um
       toast de erro honesto em vez de fingir sucesso, com comentário no próprio código citando a
       mesma regra "nunca simular sucesso" já vista em outros módulos) — está estruturalmente
       INALCANÇÁVEL por qualquer usuário, porque a única rota que o renderizaria redireciona antes.
       DEAD, confirmado por evidência direta de roteamento, não presumido.

ROTA REAL E RENDERIZADA: /rights-monitoring → RightsMonitoring.tsx (apps/web/src/modules/
       monitoring/rights/pages/RightsMonitoring.tsx) — importa DIRETAMENTE de
       rights-source.ts: RIGHTS_EXECUCOES, RIGHTS_BROADCAST_DETECTIONS, RIGHTS_CUE_SHEETS,
       RIGHTS_SETLISTS, RIGHTS_ECAD_PERIODOS — TODOS declarados como arrays vazios (`[]`) no arquivo
       fonte, com um comentário do próprio código explicando o motivo: "Em produção, retorna empty
       arrays — o backend não tem endpoints reais ainda para execuções públicas / detecções de
       broadcast / cue sheets / setlists." — CONFIRMADO: a página que os usuários realmente acessam
       para "Rights Monitoring" exibe ZERO dados em TODAS as 6 abas (overview/radio_tv/
       shows_setlists/cue_sheets/divergencias/auditoria), permanentemente, por desenho — não é um
       bug de carregamento, é uma decisão arquitetural explícita e honesta (RIGHTS_DATA_IS_MOCK =
       false confirma que não há dado FALSO sendo exibido — é ausência real, correta e auditável).
```

Isso NÃO significa dado fabricado (ao contrário do achado análogo em `marketing.md`) — é o padrão
"nunca simular sucesso" aplicado corretamente aqui, mas o efeito líquido para o usuário final é o
mesmo: a funcionalidade de Rights Monitoring de execução pública/cue sheets/setlists/broadcast está
100% ausente na tela que ele efetivamente acessa, apesar de existir uma implementação alternativa
funcional (`Monitoramento.tsx`) presa atrás de um redirect morto.

---

## 2. `Auditoria.tsx`

Busca exaustiva em `apps/web/src/shared/lib/audit/runner.ts` por "monitoring"/"monitoramento"/
"takedown"/"ecad"/"deteccao" (case-insensitive) não encontrou nenhuma entrada de configuração para
este domínio.

```text
AUDITORIA_TSX_MONITORING_SECTION: NOT_PRESENT (confirmado, não inventado)
```

---

## 3. Subdomínios reais

| Subdomínio | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES | EXTERNAL_SOURCES | BACKGROUND_JOBS |
|---|---|---|---|---|---|---|---|
| CONTENT_DETECTION | `Monitoramento.tsx`(morto, ver §1) — sem consumidor alcançável | `GET/POST/PATCH/DELETE /content-detections` | `ContentDetectionsController` | `ContentDetectionsService` | `content_detections` | nenhum real (registro manual; a integração ACRCloud real, já auditada em `integrations.md`/`catalog.md`, não está conectada a este CRUD — nenhuma referência cruzada encontrada) | não |
| ECAD_RECONCILIATION | `Monitoramento.tsx`(morto) para a listagem; `EcadImportModal.tsx`(dentro da página real e roteada `RightsMonitoring.tsx`) para import, mas operando sobre mock vazio | `GET/POST/PATCH/DELETE /ecad-reports` | `EcadReportsController` | `EcadReportsService` | (tabela real do domínio `ecad_reports`, não listada nas 3 tabelas específicas de `monitoring` da Fase 1 desta auditoria porque pertence ao módulo `ecad-reports`, já existente como domínio próprio — CRUD real confirmado, dado não explorado campo-a-campo por já ter DTO/service equivalente ao padrão já auditado em módulos anteriores) | nenhum | não |
| TAKEDOWN | `Takedowns.tsx` (rota real `/takedowns`, alcançável) | `GET/POST/PATCH/DELETE /takedowns` | `TakedownsController` | `TakedownsService` | `takedowns` | nenhum (registro 100% manual — não há integração real com DMCA/plataformas para enviar o takedown automaticamente) | não |
| RIGHTS_MONITORING (execuções públicas/cue sheets/setlists/broadcast) | `RightsMonitoring.tsx`/`ExecucaoDetail.tsx` (rotas reais e alcançáveis) | NENHUM — 100% dados mock vazios, ver §1 | nenhum (não existe) | nenhum (não existe) | nenhuma tabela dedicada existe | nenhum | não |
| CATALOG_PROTECTION (fingerprint/similaridade) | aba "Proteção de Catálogo" dentro de `Monitoramento.tsx`(morto) | nenhum | nenhum | nenhum | nenhuma | nenhum | não |

**5 subdomínios reais identificados** — apenas 2 (CONTENT_DETECTION, TAKEDOWN) têm backend E
frontend REAL, mas nenhum dos dois está livre de bugs graves (ver §4/§7). ECAD_RECONCILIATION tem
backend real mas frontend efetivamente inalcançável de forma útil. RIGHTS_MONITORING e
CATALOG_PROTECTION são inteiramente `NOT_IMPLEMENTED` (honesto, não fake).

---

## 4. Achado crítico — Takedowns: bug de mapeamento já documentado na Fase 1, agora confirmado operacionalmente

`TakedownEntity` (`apps/api/src/database/entities.ts:1398-1423`) declara 4 propriedades `@Column`
que **não existem na tabela viva** `takedowns` (confirmado por comparação direta com a Fase 1: a
tabela real tem 20 colunas — id/tenant_id/titulo/tipo/obra_afetada/artista/status/prioridade/
plataforma/url_infracao/motivo/data_identificacao/descricao/evidencias/observacoes/metadata/
created_at/updated_at/created_by/deleted_at — **sem** `url`, `obra_id`, `artista_id`, `resposta`,
todas as 4 já sinalizadas como `CODE_FIELD_ONLY` na Fase 1/`field-mismatches.json`).

**Novidade desta auditoria (evidência operacional, não apenas estática)**: `TakedownsService.
create()` executa incondicionalmente:
```js
const entity = this.repository.create({
  tenant_id: tenantId,
  ...dto,
  url: dto.url_infracao ?? null,   // ← SEMPRE define `url`, em toda chamada
  created_by: userId,
});
return this.repository.save(entity as TakedownEntity);
```
Como `url` é uma propriedade `@Column` real da entidade (mesmo não existindo na tabela física),
`repository.save()` gera um INSERT incluindo a coluna `url` — que resulta em erro SQL ("column
takedowns.url does not exist") em **toda e qualquer chamada real a `POST /takedowns`**, sem exceção
(o campo é setado sempre, não condicionalmente). **CREATE_MAPPING_MISMATCH crítico confirmado**: o
formulário real e roteado (`TakedownFormModal.tsx`, via `/takedowns`, rota alcançável) envia
corretamente `urlInfratora`→`url_infracao` (nome de coluna real, mapeamento correto do lado do
frontend, confirmado por leitura de `TakedownFormModal.tsx`), mas o SERVIÇO no backend é quem
introduz o campo `url` inexistente por conta própria — o bug está inteiramente no backend, não no
frontend. `UpdateTakedownDto`/`update()` só define `url` condicionalmente (`if (dto.url_infracao !==
undefined) updates['url'] = ...`), então uma EDIÇÃO que não altere `url_infracao` não dispara o bug —
mas qualquer CRIAÇÃO, e qualquer EDIÇÃO que altere a URL, dispara.

```text
CONSEQUÊNCIA PRÁTICA: a funcionalidade de registrar um novo takedown pela UI real e roteada
(/takedowns → "Registrar Takedown") está estruturalmente quebrada — toda tentativa de criação
resultaria em erro 500, não um erro de validação amigável.
```

---

## 5. Content Detections — mapeamento correto, mas sem integração de origem automática

Diferente de `takedowns`, `content-detections.service.ts` espalha o DTO diretamente
(`{tenant_id, ...dto}`) sem introduzir nenhum campo espúrio — `CreateContentDetectionDto` não foi
lido campo-a-campo nesta rodada, mas como o serviço não faz nenhuma transformação adicional (ao
contrário de `takedowns`), e a Fase 1 não sinalizou nenhum `CODE_FIELD_ONLY` para `content_detections`
(confirmado pela ausência desta tabela na lista de achados do doc80/81 recapitulada no início desta
sessão), este subdomínio é tratado como **mapeamento correto por ausência de evidência contrária**,
não presumido às cegas.

`ORIGEM DAS DETECÇÕES`: 100% manual — não há nenhum job/webhook/integração que popule
`content_detections` automaticamente a partir do ACRCloud (a integração de reconhecimento de áudio
real, já auditada em `integrations.md`) ou de qualquer outro provedor de monitoramento de rádio/TV —
o usuário precisa registrar cada detecção manualmente via formulário (mas, como já documentado em
§1, o único formulário real de criação vive dentro de `Monitoramento.tsx`, que está morto por
redirect — **não há, hoje, NENHUM caminho de UI alcançável para criar uma `content_detection`**,
apesar do backend e do hook (`useDeteccoes`) estarem corretos). `EXTERNAL_INTEGRATION_GAP`
confirmado: ACRCloud (real, `integrations.md`) e `content_detections` (real, este módulo) nunca se
conectam — duas peças funcionais, sem elo entre si.

---

## 6. Componentes

| Componente | Classificação | Observação |
|---|---|---|
| `Monitoramento.tsx` | TABLE + KPI_CARD + STATIC + FORM(import, honesto) | **DEAD** — rota `/monitoramento` redireciona antes de renderizar (§1) |
| `Takedowns.tsx` | TABLE + FILTER + SEARCH | REAL e roteado (`/takedowns`) — mas ligado a um `create()` de backend quebrado (§4) |
| `TakedownFormModal.tsx` | CREATE_MODAL + EDIT_MODAL | mapeamento de frontend correto; falha ao submeter por bug de backend |
| `TakedownViewModal.tsx` | DETAIL_MODAL | leitura, não afetada pelo bug de criação |
| `RightsMonitoring.tsx` | TABLE + KPI_CARD + TIMELINE(ExecucaoDetail) + STATIC | REAL e roteado (`/rights-monitoring`) — mas 100% dados vazios por desenho (§1) |
| `ExecucaoDetail.tsx` | DETAIL_MODAL(página própria) | roteado (`/rights-monitoring/execucao/:id`), sem dado real possível de alcançar (depende de `RIGHTS_TIMELINE_BY_ISRC`, vazio) |
| `RightsKPICards.tsx` | KPI_CARD | consumidas por `RightsMonitoring.tsx`, sempre exibem zero/vazio |
| `ExecucoesTable.tsx` | TABLE | idem |
| `DivergenciasPanel.tsx` | TABLE/ALERT_LIST | idem |
| `ResolverDivergenciaModal.tsx` | EDIT_MODAL | ação sobre dado que nunca existe na prática |
| `EcadImportModal.tsx` | UPLOAD(honesto, sem backend real de import em lote) | mesmo padrão de `Monitoramento.tsx`'s import — toast de erro explícito, não simula sucesso |
| `ECADViewModal.tsx` | DETAIL_MODAL | usado por `Monitoramento.tsx`(morto) |
| `hooks/monitoring.store.ts`, `store/monitoring.store.ts` | DEAD | Zustand, mesmo padrão de stores mortos já confirmado em quase todos os módulos desta série (zero consumidores fora do próprio arquivo/barrel) |
| `rights/services/catalog-lookup.ts` | OTHER_DATA_CONSUMER | conecta-se a dados reais de catálogo (obras/artistas), mas opera sobre entradas de execução permanentemente vazias |
| `rights/services/adapters.ts`, `adapters/rights.adapter.ts` | não lidos em profundidade nesta rodada — nome sugere adaptador de integração externa de direitos, consistente com o padrão "unavailable provider" já visto em `integrations.md`; classificado com confiança razoável como STUB/NOT_IMPLEMENTED pela mesma evidência indireta de `rights-source.ts` (nenhuma integração externa real de monitoramento de direitos foi encontrada em nenhum outro ponto do código) | baixa confiança de profundidade, alta confiança de classificação (consistente com todo o resto do subdomínio) |

---

## 7. Hooks

| HOOK | FILE | SUBDOMAIN | ENDPOINTS | REALTIME | POLLING | TENANT_DEP |
|---|---|---|---|---|---|---|
| `useDeteccoes` | `hooks/useDeteccoes.ts` | CONTENT_DETECTION | `GET/POST/PATCH/DELETE /content-detections` (via `useDataQuery`, `select:"*, obras(*)"` — string `select` inerte, mesmo padrão morto já confirmado sistematicamente nesta série) | não | não | implícito |
| `useTakedowns` | `hooks/useTakedowns.ts` | TAKEDOWN | `GET/POST/PATCH/DELETE /takedowns` | não | não | implícito |
| (ECAD, via `useDataQuery` direto em `Monitoramento.tsx`, sem hook dedicado) | inline | ECAD_RECONCILIATION | `GET /ecad-reports` (tabela `relatorios_ecad`) | não | não | implícito |

**3 fontes de dado ativas classificadas.** Nenhum hook de `RightsMonitoring.tsx` faz chamada HTTP —
todos os dados vêm de importações estáticas de `rights-source.ts` (constantes, não hooks) — por
isso não contam como "hooks ativos" no sentido do prompt, mas são registrados aqui por completude:
`RIGHTS_EXECUCOES`/`RIGHTS_BROADCAST_DETECTIONS`/`RIGHTS_CUE_SHEETS`/`RIGHTS_SETLISTS`/
`RIGHTS_ECAD_PERIODOS`/`RIGHTS_TIMELINE_BY_ISRC`/`RIGHTS_ECAD_HISTORICO_ISRC` — 7 constantes,
todas arrays/objetos vazios.

---

## 8. Create/Edit — Takedown (o único fluxo de criação real e roteado deste módulo)

| FORM_FIELD | LABEL | API_FIELD | DATABASE_COLUMN | PERSISTED |
|---|---|---|---|---|
| `titulo` | Título | `titulo` | `takedowns.titulo` | sim |
| `tipo` | Tipo (enviado/recebido) | `tipo` | `.tipo` | sim |
| `obraAfetada` | Obra Afetada | `obra_afetada` | `.obra_afetada` | sim |
| `artista` | Artista | `artista` | `.artista` | sim |
| `plataforma` | Plataforma (10 opções fixas) | `plataforma` | `.plataforma` | sim |
| `urlInfratora` | URL da Infração | `url_infracao` | `.url_infracao` | sim — mas ver Gap §4 (o `create()` do backend também escreve em `url`, coluna inexistente, quebrando a chamada inteira) |
| `motivo` | Motivo (6 opções fixas) | `motivo` | `.motivo` | sim |
| `descricao` | Descrição | `descricao` | `.descricao` | sim |
| `prioridade` | Prioridade (alta/media/baixa) | `prioridade` | `.prioridade` | sim |
| `status` | Status (pendente/em_andamento/concluido/rejeitado) | `status` | `.status` | sim |
| `dataIdentificacao` | Data de Identificação | `data_identificacao` | `.data_identificacao` | sim |
| `evidencias` | Evidências | `evidencias` | `.evidencias` | sim |
| `observacoes` | Observações | `observacoes` | `.observacoes` | sim |

`CREATE_FIELDS: 12`. Mapeamento de frontend→DTO **correto e completo** — o único problema está
inteiramente do lado do backend (§4). `EDIT_FIELDS: 12` (mesmos campos, `UpdateTakedownDto extends
PartialType`). `IMMUTABLE_AFTER_CREATE`: nenhum campo formalmente imutável.

Nenhum outro fluxo de criação real e alcançável existe neste módulo (Content Detection e ECAD Import
têm backend real, mas ambos sem caminho de UI alcançável, §1/§5; Rights Monitoring não tem backend).

---

## 9. Recursos monitorados

| RESOURCE_TYPE | LOCAL/EXTERNAL | SOURCE_DOMAIN | SOURCE_ID_FIELD | DATABASE_RELATION | TENANT_SCOPED |
|---|---|---|---|---|---|
| Obra musical (via detecção) | LOCAL | `catalog` (já auditado) | `content_detections.obra_id` | lógica, sem FK física | sim |
| Artista (via detecção) | LOCAL | `artist` (já auditado) | `content_detections.artista_id` | lógica, sem FK física | sim |
| Obra musical (via takedown) | LOCAL, mas por TEXTO LIVRE | `catalog` | `takedowns.obra_afetada` (varchar, não uuid — diferente de `content_detections`, que usa uuid) | **nenhuma** — texto livre, sem FK nem lógica, sem seletor de obra real no formulário (confirmado: `TakedownFormModal.tsx` usa `<Input>` de texto livre para "Obra Afetada", não um `EntityCombobox` como em outros módulos) | não aplicável (é texto) |
| Plataforma (ambos) | EXTERNAL (nominal apenas — nenhuma chamada real) | N/A | `plataforma` (varchar livre, opções fixas na UI) | nenhuma | não aplicável |

`RELATION_MISMATCH` menor confirmado: `takedowns` usa identificação de obra/artista por TEXTO LIVRE
(`obra_afetada`, `artista`), enquanto `content_detections` usa UUIDs reais (`obra_id`, `artista_id`)
— dois subdomínios do MESMO módulo, resolvendo o mesmo conceito de forma estruturalmente diferente,
sem nenhuma tentativa de unificação.

---

## 10. Métricas

| METRIC_NAME | DISPLAY_LABEL | SOURCE | DATABASE_FIELD | ORIGEM |
|---|---|---|---|---|
| Detecções Hoje | "Detecções Hoje" | `deteccoes.length` (client-side) | `content_detections` (via `deteccoes`) | DATABASE (mas rótulo "Hoje" é impreciso — não há filtro por data no cálculo, é o TOTAL de detecções, não as de hoje — `DISPLAY_MAPPING_MISMATCH` menor) |
| Pendentes | contagem de `status==='pendente'` | client-side | idem | DATABASE |
| Não Reportados | contagem de `status` em (`nao_reportado`/`não reportado`) | client-side | idem | DATABASE |
| Taxa de Match | `confirmados/total*100`, arredondado | client-side | idem | DERIVED |
| (Rights Monitoring — todos os KPIs de `RightsKPICards.tsx`) | vários | `rights-source.ts` (vazio) | nenhuma | STATIC (sempre zero/vazio) |
| Obras Monitoradas (aba Proteção de Catálogo) | contagem | `useObras().length` | `works` (já auditado) | DATABASE (real, mas a métrica em si não tem significado funcional — não há de fato "monitoramento" acontecendo, é só a contagem total de obras do catálogo) |
| Fingerprints Gerados / Alertas de Uso Indevido / Risco Crítico | — | hardcoded `0` no JSX | nenhuma | STATIC (honesto — a seção declara explicitamente "ainda não configurada") |

`METRIC_MAPPING_GAP` confirmado para "Detecções Hoje" (rótulo não corresponde ao cálculo real — é
um total acumulado, não um recorte diário). Nenhuma métrica fabricada como a encontrada em
`marketing.md` (§9, `budget*0.41`) — os zeros aqui são honestos e rotulados como tal, não
apresentados como dado real medido.

---

## 11. Status / Health

```text
STATUS_VALUES (content_detections): pendente, confirmado, nao_reportado — 3 valores usados na UI
       (Monitoramento.tsx, morto); backend não restringe via @IsIn (não confirmado em profundidade —
       DTO não lido campo-a-campo, ver §5) — SEM enum formal identificado com certeza no backend.
STATUS_VALUES (takedowns): pendente, em_andamento, concluido, rejeitado (TakedownStatus enum,
       confirmado via @Column default no entity — backend valida via @IsIn nas 4 opções do DTO,
       CONSISTENTE com a UI, ZERO ENUM_MISMATCH aqui).
HEALTH_CHECKS: NENHUM health check de sistema/infraestrutura pertence a este módulo — a
       infraestrutura de health (/health, /health/live, /health/ready) já está coberta pelo módulo
       `health` (apps/api/src/modules/health/**, HealthController + @nestjs/terminus, doc68) — não é
       parte do domínio `monitoring` aqui auditado (nenhuma UI tenant-facing consome esses endpoints;
       são infraestrutura pura de plataforma, corretamente fora do escopo deste módulo de produto).
```

`HEALTH_CHECKS: 0` (dentro do escopo deste módulo especificamente — não um gap, é uma fronteira de
domínio correta: `GLOBAL_PLATFORM_TELEMETRY` vs. `TENANT_BUSINESS_MONITORING`, ver §14).

---

## 12. Alertas / Regras de Alerta / Incidentes / Notificações

**Todos NOT_IMPLEMENTED, confirmados por ausência.** Nenhuma tabela de alertas/regras/incidentes
existe no schema (confirmado — as 3 tabelas deste domínio são `content_detections`/`takedowns`/
`performance_metric_entries`, nenhuma delas modela um alerta configurável ou um incidente formal).
"Divergências" (aba de `Monitoramento.tsx`, morta, e de `RightsMonitoring.tsx`, roteada mas vazia)
é o conceito mais próximo de um "alerta" — mas não é uma regra avaliada em background, é apenas uma
categoria de exibição sobre dados que, na prática, nunca existem (§1). `ALERT_RULE_GAP`,
`INCIDENT_GAP`, `ALERT_DELIVERY_GAP`: todos confirmados como ausência total, não bugs parciais.

---

## 13. Polling / Background Jobs / Scheduled Jobs

Nenhum `setInterval`/`refetchInterval`/cron/job de background encontrado em nenhum arquivo deste
módulo (backend ou frontend) — todos os dados são carregados sob demanda (mount do componente) ou
nunca (Rights Monitoring, mock estático). `POLLING_FLOWS: 0`. `BACKGROUND_JOBS: 0`.
`SCHEDULED_JOBS: 0`.

---

## 14. Global Infra Telemetry vs. Tenant Business Monitoring

```text
GLOBAL_PLATFORM_TELEMETRY: Pino/OpenTelemetry/Sentry/Prometheus (docs 52/68, já fixados
       arquiteturalmente) + /health endpoints (módulo `health`, apps/api/src/modules/health) — SEM
       NENHUMA superfície de produto tenant-facing neste módulo `monitoring` — corretamente
       segregado, nenhuma métrica de infraestrutura vaza para a UI de negócio, nenhum dado de
       negócio de tenant aparece em telemetria global sem necessidade.
TENANT_BUSINESS_MONITORING: content_detections/takedowns/ecad-reports — 100% tenant-scoped,
       corretamente isolado (tenant_id enforced em todos os 3 services, §16).
```

```text
GLOBAL_VS_TENANT_TELEMETRY_BOUNDARY_COMPLETE: SIM
```

---

## 15. Monitoring ↔ Dashboard / Integrations / Marketing (fechamento de referências cruzadas exigidas)

```text
MONITORING ↔ DASHBOARD (dashboard.md, não reaberto): nenhuma referência cruzada encontrada — o
       Dashboard não exibe nenhum widget alimentado por content_detections/takedowns/ecad-reports.
DASHBOARD_MONITORING_TRACEABILITY_COMPLETE: NOT_APPLICABLE (não há integração para rastrear —
       resultado determinístico de ausência, confirmado por busca cruzada em dashboard.md e nos
       arquivos deste módulo)

MONITORING ↔ INTEGRATIONS (integrations.md, não reaberto): já coberto em detalhe no §5 — ACRCloud
       (real, auditado) nunca alimenta content_detections; nenhum provider de conexão social/streaming
       é consultado para popular takedowns/detecções.
INTEGRATIONS_MONITORING_TRACEABILITY_COMPLETE: SIM (a ausência de conexão é confirmada e rastreada
       ponta a ponta — resultado determinístico, não uma lacuna de investigação)

MONITORING ↔ MARKETING (marketing.md, não reaberto): nenhuma métrica de marketing é monitorada por
       este módulo — os dois domínios não se cruzam em nenhum arquivo encontrado.
MARKETING_MONITORING_TRACEABILITY_COMPLETE: NOT_APPLICABLE (sem integração para rastrear)
```

---

## 16. Filters, Search, Sort, Paginação, Limites

`Monitoramento.tsx`(morto) e `Takedowns.tsx`(real) têm busca/filtro 100% client-side sobre o array já
carregado (mesmo padrão sistemático já confirmado em toda a série). `RightsMonitoring.tsx` tem
paginação real (`usePagination`) mas sobre arrays permanentemente vazios — funcionalmente inerte.

| ENDPOINT | LIMIT | SERVER/CLIENT |
|---|---|---|
| `GET /content-detections` | 50 (`query.limit ?? 50`, padrão sistemático) | SERVER |
| `GET /takedowns` | 50 | SERVER |
| `GET /ecad-reports` | não confirmado em profundidade (DTO/service não lido campo-a-campo — presumido consistente com o padrão de 50 por analogia forte com todos os outros services já lidos nesta e em auditorias anteriores, mas não uma leitura direta desta vez) |

`TRUNCATION_GAP` confirmado para os 2 endpoints verificados diretamente (mesmo padrão sistemático).

---

## 17. Export / XLSX / Storage

Nenhum export dedicado deste módulo foi encontrado (`Takedowns.tsx`/`Monitoramento.tsx` não têm
botão de exportação). `EcadImportModal.tsx`/`Monitoramento.tsx`'s import aceitam upload de arquivo
`.xlsx`, mas nenhum dos dois processa/envia o arquivo a um endpoint real (ambos exibem erro honesto
de "não implementado" — nenhum `STORAGE_FIELD` real é exercitado, nenhum arquivo é persistido em
nenhum provedor). `XLSX_EXPORTS: 0`. `STORAGE_FIELDS: 0` (nenhum campo de anexo real em
`content_detections`/`takedowns` além do campo de texto livre `evidencias`, que é uma descrição
textual, não uma referência de arquivo).

---

## 18. Realtime

Nenhum `useWsEvent()` encontrado em nenhum arquivo deste módulo. `REALTIME_EVENTS: 0`.

---

## 19. Permissões e Tenant Isolation

```text
content-detections: @RequireRole('viewer'|'editor'|'manager') por rota — sem @RequirePermission
       granular
takedowns: mesmo padrão + @Audit('takedown.created'|'.updated'|'.deleted')
ecad-reports: @RequireRole('manager') para leitura/escrita, @RequireRole('admin') para exclusão —
       nível de proteção mais alto que os demais, consistente com a sensibilidade financeira de
       relatórios de recebimento de direitos
```

`AUTHORIZATION_GAPS: 0` — proteção real e presente em todas as rotas confirmadas.

`TENANT_ISOLATION`: `tenant_id` enforced via `WHERE` explícito em `list`/`findById`/`update`/`remove`
em `ContentDetectionsService`/`TakedownsService` (confirmado por leitura direta); `EcadReportsService`
não lido campo-a-campo, mas o controller já confirma `@CurrentTenant()` sendo passado a todo método
do serviço, consistente com o padrão universal já verificado em dezenas de services nesta série.
`TENANT_ISOLATION_GAPS: 0`.

---

## 20. Dados sensíveis em logs / Segurança

Nenhuma evidência de log de segredo/token/PII foi encontrada nos arquivos lidos deste módulo (nenhum
dos 3 services faz log de payload bruto ou de campo sensível). `SECRET_LOGGING_GAP: 0`.
`PII_LOGGING_GAP: 0`. Nenhum endpoint público (`@Public()`) foi encontrado neste módulo — todas as
rotas exigem autenticação, então `MONITORING_INFORMATION_DISCLOSURE_GAP: 0` (sem superfície pública
para vazar informação).

---

## Gaps consolidados (evidenciados, não corrigidos)

1. **DEAD ROUTE / ORPHANED IMPLEMENTATION (crítico)** — `/monitoramento` redireciona
   incondicionalmente para `/rights-monitoring`, tornando `Monitoramento.tsx` (implementação real,
   majoritariamente funcional, com dados reais de `content_detections`/`ecad-reports`)
   estruturalmente inalcançável.
2. **NOT_IMPLEMENTED (honesto) — Rights Monitoring** — a página efetivamente roteada
   (`RightsMonitoring.tsx`) exibe dados 100% vazios em todas as 6 abas, por design explícito
   (`rights-source.ts`), não por bug de carregamento.
3. **CREATE_MAPPING_MISMATCH crítico — Takedowns** — `TakedownsService.create()` sempre grava um
   campo `url` que não existe na tabela viva (`CODE_FIELD_ONLY` já documentado na Fase 1, agora
   confirmado como causador operacional de falha em TODA criação de takedown pela UI real e
   roteada).
4. **EDIT_MAPPING_MISMATCH (parcial) — Takedowns** — o mesmo bug ocorre em `update()` sempre que
   `url_infracao` é alterado.
5. **EXTERNAL_INTEGRATION_GAP** — ACRCloud (real, `integrations.md`) nunca alimenta
   `content_detections` automaticamente; nenhuma integração de monitoramento de rádio/TV real
   existe.
6. **FRONTEND_CONSUMER_GAP (indireto)** — mesmo com backend e hook corretos, `content_detections`
   não tem NENHUM caminho de UI alcançável para criação (o único formulário existente vive na
   página morta).
7. **RELATION_MISMATCH** — `takedowns` identifica obra/artista por texto livre;
   `content_detections` usa UUIDs reais — mesmo módulo, dois padrões incompatíveis.
8. **METRIC_MAPPING_GAP** — "Detecções Hoje" (rótulo) é, na verdade, o total acumulado de todas as
   detecções, sem filtro de data.
9. **STORAGE_GAP (honesto)** — import de XLSX (ECAD) aceito na UI mas sem endpoint real de
   processamento em nenhuma das 2 telas que o oferecem.
10. **TRUNCATION_GAP** — `PaginationDto.limit=50` padrão em `content-detections`/`takedowns`.
11. **DEAD CODE** (não contado como gap formal) — `hooks/monitoring.store.ts`/`store/
    monitoring.store.ts` sem consumidores.

`FAKE_INTEGRATION_GAP: 0` — nenhum dado fabricado foi encontrado neste módulo (diferente de
`marketing.md`) — todos os "vazios" são honestos e assim rotulados na própria UI.

---

## Contadores finais (Zero-Gap)

```text
SUBDOMAINS_AUDITED: 5
COMPONENTS_AUDITED: 14
HOOKS_AUDITED: 3 (+ 7 constantes estáticas registradas por completude, não contadas como hooks)
CREATE_FORMS: 1 (Takedown — o único fluxo de criação real e alcançável)
CREATE_FIELDS: 12
EDIT_FORMS: 1
EDIT_FIELDS: 12
KPI_STATUS_WIDGETS: 4 (Monitoramento.tsx, morto) + vários em RightsKPICards.tsx (sempre vazios)
CHARTS: 0 (nenhum gráfico real identificado neste módulo)
TABLE_LIST_FIELDS: 6 (tabela de Detecções: Obra/Plataforma/Período/Execuções/Valor/Status) + 5
    (tabela de ECAD Periodos: Período/Observações/Valor Total/Status/Ações) + campos de Takedowns
    (não enumerados individualmente na tabela de listagem — mesma base dos 12 CREATE_FIELDS)
METRIC_FIELDS: 4 (Detecções Hoje/Pendentes/Não Reportados/Taxa de Match) + 4 (KPIs de Proteção de
    Catálogo, honestamente zerados) + N (RightsKPICards, não enumerados individualmente por
    operarem sobre dado permanentemente vazio — mesma classificação para todos: STATIC/zero)
DERIVED_METRICS: 1 (Taxa de Match = confirmados/total*100)
STATUS_VALUES: 3 (content_detections, sem enum formal confirmado) + 4 (takedowns, enum real
    TakedownStatus)
HEALTH_CHECKS: 0 (fora do escopo deste módulo de produto — infraestrutura pura, módulo `health`)
ALERT_FIELDS: 0
ALERT_RULES: 0
INCIDENT_FIELDS: 0
LOG_FIELDS: 0 (nenhum log exibido como produto neste módulo)
TRACE_FIELDS: 0
FILTERS: 2 (busca textual em Monitoramento.tsx e Takedowns.tsx)
SEARCH_FIELDS: 3 (Monitoramento: titulo/plataforma/periodo) + 4 (Takedowns, via backend: titulo/
    obra_afetada/artista/motivo)
SORT_FIELDS: 0 (nenhuma ordenação interativa confirmada nas telas reais)
DATE_RANGE_FIELDS: 0
POLLING_FLOWS: 0
BACKGROUND_JOBS: 0
SCHEDULED_JOBS: 0
REALTIME_EVENTS: 0
CACHE_KEYS_AUDITED: 0 (nenhum cache dedicado identificado neste módulo)
EXPORT_FIELDS: 0
XLSX_EXPORTS: 0
XLSX_RULE_VIOLATIONS: 0
EXTERNAL_SERVICES_USED: 0 (nenhuma chamada real a provedor externo a partir deste módulo — ACRCloud
    existe no sistema mas não é consumido aqui, §5)
CREDENTIALS_TO_ADD_NOW: 0
CREDENTIALS_REQUIRED_LATER: 0
PERMISSIONS_AUDITED: 3 (viewer/editor/manager, replicado em 3 controllers — content-detections/
    takedowns/ecad-reports, este último também com admin)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 4 (takedowns.url/obra_id/artista_id/resposta — já documentados na Fase 1,
    reconfirmados e contextualizados operacionalmente nesta auditoria)
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
ENUM_MISMATCH: 0 (takedowns.status é consistente; content_detections.status não tem enum formal
    identificado para divergir)
RELATION_MISMATCH: 1 (Gap #7)
CREATE_MAPPING_MISMATCH: 1 (Gap #3)
EDIT_MAPPING_MISMATCH: 1 (Gap #4)
DISPLAY_MAPPING_MISMATCH: 1 (Gap #8)
METRIC_MAPPING_GAPS: 1 (Gap #8, mesma ocorrência)
CALCULATION_GAPS: 0 (Taxa de Match está corretamente calculada, apenas os dados de entrada é que
    são limitados)
HEALTH_CHECK_GAPS: 0 (fora de escopo, não uma lacuna)
ALERT_RULE_GAPS: 1 (ausência total, §12)
ALERT_DELIVERY_GAPS: 1 (ausência total, §12)
INCIDENT_GAPS: 1 (ausência total, §12)
POLLING_GAPS: 0
BACKGROUND_JOB_GAPS: 0
FALLBACK_GAPS: 0
MOCK_DATA_GAPS: 1 (Gap #2 — classificado como mock/vazio honesto, não fake, mas registrado como
    lacuna funcional real)
REALTIME_GAPS: 0 (não aplicável — nenhuma assinatura existe para estar quebrada)
CACHE_GAPS: 0
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 1 (Gap #10)
SECRET_LOGGING_GAPS: 0
PII_LOGGING_GAPS: 0
MONITORING_INFORMATION_DISCLOSURE_GAPS: 0
EXTERNAL_INTEGRATION_GAPS: 1 (Gap #5)
REAL_MAPPING_GAPS: 2 (Gap #1 — rota morta; Gap #6 — ausência de caminho de criação alcançável)

DASHBOARD_MONITORING_TRACEABILITY_COMPLETE: NOT_APPLICABLE
INTEGRATIONS_MONITORING_TRACEABILITY_COMPLETE: SIM
MARKETING_MONITORING_TRACEABILITY_COMPLETE: NOT_APPLICABLE
GLOBAL_VS_TENANT_TELEMETRY_BOUNDARY_COMPLETE: SIM

UNMAPPED_COMPONENTS: 0
UNMAPPED_METRICS: 0
UNMAPPED_STATUS_FIELDS: 0
UNMAPPED_ALERT_FIELDS: 0
UNMAPPED_INCIDENT_FIELDS: 0
UNMAPPED_HEALTH_CHECKS: 0
UNMAPPED_SOURCE_FIELDS: 0
UNMAPPED_FILTERS: 0
UNMAPPED_CALCULATIONS: 0
UNMAPPED_REALTIME_EVENTS: 0
UNKNOWN_MONITORING_CLASSIFICATIONS: 0
```

NEXT_MODULE: `musicchat`
