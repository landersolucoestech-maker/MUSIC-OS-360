---
title: Unificar módulo Contratos (v1 + v2)
---
# Unificar Módulo Contratos (v1 + v2)

## What & Why

Existem dois módulos de contratos visíveis no sidebar ("Contratos" e "Contratos v2"), o que confunde os utilizadores e duplica funcionalidade. O v1 tem o fluxo operacional completo (CRUD, KPIs, filtros, bulk, ligação artista/cliente/lançamento). O v2 acrescenta a integração de assinatura electrónica (wizard 7 passos, templates com variáveis tipadas, rastreio por signatário, timeline de auditoria).

A unificação é um **fluxo linear contínuo**, não duas abas paralelas: criar contrato → revisar → enviar para assinatura → acompanhar assinaturas. Tudo dentro de um único módulo, uma única entrada no sidebar.

## Done looks like

- O sidebar mostra **apenas** "Contratos" (uma entrada, sem "Contratos v2")
- A página `/contratos` é **idêntica** à versão v1 actual (lista, KPIs, filtros, bulk) — sem novas abas na página principal
- O `ContratoViewModal` (modal de detalhe de um contrato) ganha uma aba **"Assinatura Digital"** com dois estados:
  - **Sem documento vinculado**: botão "Iniciar Processo de Assinatura" que abre o wizard v2 pré-preenchido com o `contract_id`, título e artista do contrato
  - **Com documento vinculado**: mostra status do documento (badge), lista de signatários com estado individual (assinou / pendente / data de assinatura), e a timeline de auditoria completa (DocumentTimeline do v2)
- O wizard de 7 passos do v2 funciona como página full-screen em `/contratos/assinatura/novo` (acessível via botão no modal, não directamente no sidebar)
- A rota `/contratos/templates` absorve os templates do v2: a página existente de TemplatesContratos ganha uma segunda sub-aba "Templates com Variáveis" com o TemplateBuilder do v2
- As rotas `/contratos-v2/*` são eliminadas do App.tsx (redirect para `/contratos` para não quebrar bookmarks antigos)
- tsc --noEmit → 0 erros após a unificação

## Out of scope

- Alteração do layout da página principal `/contratos` (lista v1 preservada intacta)
- Backend real do Autentique (continua stub em MOCK_MODE — já era assim)
- Migração de dados localStorage entre v1 e v2 (chaves separadas mantêm-se)
- Redesign visual de qualquer componente existente
- Alterações ao módulo `releases/` (PROTECTED)
- Remoção da pasta `contracts-v2/` (código mantém-se, apenas rotas directas são eliminadas)

## Steps

1. **Remover "Contratos v2" do sidebar** — Eliminar a entrada `{ title: "Contratos v2", href: "/contratos-v2", ... }` de `AppSidebar.tsx`. Uma única entrada "Contratos" permanece.

2. **Adicionar aba "Assinatura Digital" ao ContratoViewModal** — Na lista de abas do modal de detalhe (Informações, Signatários, Histórico, Versões), adicionar a aba "Assinatura Digital". Quando não existe documento vinculado ao `contract_id`, mostrar botão "Iniciar Processo de Assinatura" que navega para `/contratos/assinatura/novo?contract_id=<id>&titulo=<titulo>&artista_id=<artista_id>`. Quando existe documento (lookup via `useDocuments()` filtrando por `contract_id`), mostrar DocumentStatusBadge, lista de signatários com estado individual, e DocumentTimeline.

3. **Criar rota `/contratos/assinatura/novo`** — Adicionar esta rota a `contracts.routes.tsx`. A página `NewDocument.tsx` do v2 deve ler os query params `contract_id`, `titulo` e `artista_id` para pré-preencher o wizard. Após completar o wizard, redirecionar de volta para `/contratos`.

4. **Unificar página de Templates** — Em `/contratos/templates`, a página `TemplatesContratos.tsx` existente ganha duas sub-abas internas: "Templates Simples" (conteúdo actual) e "Templates com Variáveis" (TemplateBuilder do v2). A navegação para templates não muda.

5. **Desactivar rotas v2 no App.tsx** — Remover o import de `contractsV2Routes` e a sua inclusão nas rotas. Adicionar um `<Route path="/contratos-v2/*" element={<Navigate to="/contratos" replace />} />` para redirecionar bookmarks antigos.

6. **Validação TypeScript** — Correr `tsc --noEmit` e corrigir qualquer erro de tipos introduzido pela integração (especialmente imports cruzados entre `contracts/` e `contracts-v2/`).

## Relevant files

- `client/src/shared/components/layout/AppSidebar.tsx:113-114`
- `client/src/modules/contracts/pages/Contratos.tsx`
- `client/src/modules/contracts/components/ContratoViewModal.tsx`
- `client/src/modules/contracts/pages/TemplatesContratos.tsx`
- `client/src/modules/contracts-v2/pages/DocumentEngine.tsx`
- `client/src/modules/contracts-v2/pages/NewDocument.tsx`
- `client/src/modules/contracts-v2/pages/TemplateBuilder.tsx`
- `client/src/modules/contracts-v2/hooks/useDocumentEngine.ts`
- `client/src/modules/contracts-v2/types/index.ts`
- `client/src/modules/contracts-v2/components/wizard/DocumentWizard.tsx`
- `client/src/modules/contracts-v2/components/timeline/DocumentTimeline.tsx`
- `client/src/modules/contracts-v2/components/shared/DocumentStatusBadge.tsx`
- `client/src/app/routes/contracts.routes.tsx`
- `client/src/app/routes/contracts-v2.routes.tsx`
- `client/src/app/App.tsx`