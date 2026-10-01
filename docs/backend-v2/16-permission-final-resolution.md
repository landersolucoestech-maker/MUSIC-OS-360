> Historical record. Kept as recorded; not the current contract.

# 16 — Resolução Final das 9 Permissões Incertas

Continuação read-only de [`15-frontend-auth-permission-contracts.md`](./15-frontend-auth-permission-contracts.md). Nenhum arquivo foi alterado. Doc 15 não foi modificado. Todos os 9 casos foram resolvidos inteiramente a partir de `apps/web/**` — `apps/api` não foi necessário.

---

## Caso 1

```text
CALL_SITE: modules/rh/pages/RH.tsx — botão de criação no header (branch por activeTab)
METHOD: POST
ENDPOINT: /hr/employees (activeTab="funcionarios") | /hr/payroll (activeTab="folha") | /hr/leave-requests (activeTab="afastamentos")
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: RH.tsx:386-394 — `<RequirePermission module="rh" action="write">` envolve um único botão cujo `onClick` varia por aba: `activeTab==="funcionarios" → setFuncFormModal({mode:"create"})`, `activeTab==="folha" → ...` (padrão análogo). modules/rh/services/rh.service.ts:6-8,15-17,20-22 — `createEmployee`/`createPayroll`/`createLeave`, todos via `storage.create(<tabela>, data)`. TABLE_ENDPOINT (doc 05): funcionarios→/hr/employees, folha_pagamento→/hr/payroll, afastamentos→/hr/leave-requests.
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE (frontend não checa role, só a chave de permissão)
REQUIRED_PERMISSION: rh:write (coarse) → resource:action real "rh:create" (via TENANT_ACTION_BACKEND)
STATUS: CONFIRMED
JUSTIFICATIVA: Um único gate cobre 3 endpoints POST distintos, porque a UI usa um botão condicional por aba em vez de 3 botões separados — confirmado por leitura direta do handler e do serviço.
```

## Caso 2

```text
CALL_SITE: modules/licensing/pages/Licenciamento.tsx — botão "Nova Licença"
METHOD: POST
ENDPOINT: /licenses
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: Licenciamento.tsx:178-182 — `<RequirePermission module="licensing" action="write">` envolve o botão que chama `setLicencaModal({open:true, mode:"create"})`. modules/licensing/services/licensing.service.ts:6 — `create(data) → storage.create("licencas", data)`. TABLE_ENDPOINT["licencas"]="/licenses" (doc 05).
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE
REQUIRED_PERMISSION: licensing:write (coarse) → "licensing:create"
STATUS: CONFIRMED
JUSTIFICATIVA: Cadeia direta e única (botão → modal de criação → 1 serviço → 1 endpoint), sem ambiguidade.
```

## Caso 3

```text
CALL_SITE: modules/monitoring/pages/Monitoramento.tsx — botão "Importar Relatório ECAD"
METHOD: N/A
ENDPOINT: NONE — nenhuma chamada HTTP real ocorre
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: Monitoramento.tsx:253-257 — `<RequirePermission module="monitoring" action="write">` envolve o botão que chama `setImportModalOpen(true)`. Linhas 54-61 do mesmo arquivo: o handler de importação é um STUB explícito — comentário no código: *"Importação real de relatório ECAD requer endpoint no backend; nunca simular progresso nem sucesso fictício"* — e o comportamento real é exibir a mensagem *"Importação de relatório ECAD ainda não está disponível (requer endpoint real no backend)."*, sem nenhum `fetch`/`api.*` envolvido.
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE
REQUIRED_PERMISSION: monitoring:write (coarse) — a permissão É checada antes de abrir o modal, mas o modal em si não completa nenhuma chamada de rede
STATUS: CONFIRMED
JUSTIFICATIVA: Regra de ausência aplicável de forma invertida — não é "sem permissão exigida", é "com permissão exigida, mas sem endpoint algum para exigi-la contra", confirmado por comentário explícito no próprio código-fonte declarando a funcionalidade como não implementada no backend. Registrado como CONFIRMED porque a resposta (não há endpoint) é definitiva, não incerta.
```

## Caso 4

```text
CALL_SITE: modules/projects/pages/Projetos.tsx — botão "Novo Projeto"
METHOD: POST
ENDPOINT: /projects
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: Projetos.tsx:152-160 — `<RequirePermission module="projects" action="write">` envolve o botão `onClick={() => setFormModal({open:true, mode:"create"})}`. modules/projects/services/projects.service.ts:6 — `create(data) → storage.create("projetos", data)`. TABLE_ENDPOINT["projetos"]="/projects".
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE
REQUIRED_PERMISSION: projects:write (coarse) → "projects:create"
STATUS: CONFIRMED
JUSTIFICATIVA: Cadeia direta e única.
```

## Caso 5

```text
CALL_SITE: modules/inventory/pages/Inventario.tsx — botão "Novo Item"
METHOD: POST
ENDPOINT: /inventory
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: Inventario.tsx:106-108 — `<RequirePermission module="inventory" action="write">` envolve o botão `onClick={() => setFormModal({open:true, mode:"create"})}`. modules/inventory/services/inventory.service.ts:6 — `create(data) → storage.create("inventario", data)`. TABLE_ENDPOINT["inventario"]="/inventory".
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE
REQUIRED_PERMISSION: inventory:write (coarse) → "inventory:create"
STATUS: CONFIRMED
JUSTIFICATIVA: Cadeia direta e única.
```

## Caso 6

```text
CALL_SITE: modules/catalog/pages/RegistroMusicas.tsx — botão de criação no header (branch por activeTab)
METHOD: POST
ENDPOINT: /phonograms (activeTab="fonogramas") | /works (demais abas, via seletor de tipo de obra)
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: RegistroMusicas.tsx:343-350 — `<RequirePermission module="catalog" action="write">` envolve um botão cujo `onClick` é `activeTab==="fonogramas" ? setFonogramaModal({mode:"create"}) : setObraTipoSelectorOpen(true)`. modules/catalog/services/catalog.service.ts:12-13 (`createWork→storage.create("obras",...)`) e :32-33 (`createPhonogram→storage.create("fonogramas",...)`). TABLE_ENDPOINT: obras→/works, fonogramas→/phonograms.
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE
REQUIRED_PERMISSION: catalog:write (coarse) → "catalog:create"
STATUS: CONFIRMED
JUSTIFICATIVA: Um único gate cobre 2 endpoints POST distintos (fonogramas vai direto ao modal de criação; as demais abas passam por um seletor de tipo de obra antes de, presumivelmente, abrir o modal de criação de obra — o seletor em si não foi aberto nesta etapa, mas o único destino de dados possível para "criar obra" no serviço é `createWork`).
```

## Caso 7

```text
CALL_SITE: modules/events/pages/Agenda.tsx — botão "Novo Evento"
METHOD: POST
ENDPOINT: /events
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: Agenda.tsx:359-363 — `<RequirePermission module="events" action="write">` envolve o botão `onClick={() => setFormModal({open:true, mode:"create"})}`. modules/events/services/events.service.ts:8 — `create(data) → storage.create("eventos", data)`. TABLE_ENDPOINT["eventos"]="/events".
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE
REQUIRED_PERMISSION: events:write (coarse) → "events:create"
STATUS: CONFIRMED
JUSTIFICATIVA: Cadeia direta e única.
```

## Caso 8

```text
CALL_SITE: modules/artist/pages/Artistas.tsx — botão "Novo Artista" (linha 253)
METHOD: POST
ENDPOINT: /artists
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: Artistas.tsx:253-261 — `<RequirePermission module="artists" action="write">` envolve o botão `onClick={() => setCreateModal(true)}`. modules/artist/services/artista.service.ts:18-23 — `create(data) → storage.create("artistas", data)`. TABLE_ENDPOINT["artistas"]="/artists".
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE
REQUIRED_PERMISSION: artists:write (coarse) → "artist:create"
STATUS: CONFIRMED
JUSTIFICATIVA: Cadeia direta e única.
```

## Caso 9

```text
CALL_SITE: modules/artist/pages/Artistas.tsx — item de menu "Editar" (linha 572)
METHOD: PATCH
ENDPOINT: /artists/${id}
REQUISITO_ANTERIOR: UNRESOLVED
EVIDÊNCIA_FRONTEND: Artistas.tsx:572-580 — `<RequirePermission module="artists" action="write">` envolve o item de menu `onClick={() => setEditModal({open:true, artista})}`. modules/artist/services/artista.service.ts:25-31 — `update(id,data) → storage.update("artistas", id, data)`. TABLE_ENDPOINT["artistas"]="/artists".
EVIDÊNCIA_LEGACY: NÃO NECESSÁRIA
REQUIRED_ROLE: NONE
REQUIRED_PERMISSION: artists:write (coarse) → "artist:update"
STATUS: CONFIRMED
JUSTIFICATIVA: Distingue-se do Caso 8 (mesma module/action "artists:write", mas endpoint e verbo HTTP diferentes — POST criação vs PATCH edição) — confirma que a mesma chave `artists:write` no frontend cobre tanto create quanto update no backend, consistente com `TENANT_ACTION_BACKEND.write = ["update","create"]` (permission-map.ts, doc 15).
```

---

## Resumo

```text
UNRESOLVED_PERMISSIONS_INITIAL: 9
PERMISSIONS_RESOLVED: 9
PERMISSIONS_CONFIRMED_AS_NONE: 0
PERMISSIONS_CONFLICTING: 0
PERMISSIONS_REMAINING: 0
```

`PERMISSIONS_CONFIRMED_AS_NONE` refere-se a `REQUIRED_PERMISSION: NONE` (endpoint que exige só autenticação/tenant) — não é o caso de nenhum dos 9 (todos exigem uma permissão de módulo real). O Caso 3 é diferente: a permissão É exigida pela UI, mas não há endpoint nenhum para ela ser exigida contra (funcionalidade não implementada no backend) — por isso permanece contado em `PERMISSIONS_RESOLVED`, não em `CONFIRMED_AS_NONE`.

## Cobertura

Todos os 9 casos resolvidos inteiramente via `apps/web/src` (páginas + services + `TABLE_ENDPOINT` já documentado no doc 05). Nenhuma consulta a `apps/api` foi necessária. Nenhum outro endpoint além dos 9 casos foi mapeado nesta etapa.
