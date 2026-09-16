---
title: Template preview toggle no Contract Import Workspace
---
# Template Preview Toggle no Import Workspace

## What & Why

Durante a etapa de revisão (step "review") do `ContractImportWorkspace`, o painel esquerdo mostra o texto **original do contrato** com os valores reais destacados a azul (ex: `João da Silva`, `R$ 5.000,00`). O utilizador não consegue ver como ficará o template final com os placeholders impostos nos lugares certos (ex: `{{CONTRATADO.NOME}}`, `{{PAYMENT.AMOUNT}}`). A substituição só acontece internamente no momento de guardar.

O objectivo é mostrar ao utilizador **em tempo real** como ficará o template após substituição, para que possa validar se cada placeholder foi colocado no sítio correcto antes de confirmar.

## Done looks like

- Na etapa "review" do ContractImportWorkspace, o painel esquerdo tem dois botões de toggle no cabeçalho: **"Original"** e **"Template"**
- Modo **Original** (comportamento actual): texto do contrato com os valores reais destacados a azul, com scroll para o elemento activo
- Modo **Template** (novo): texto com todos os `{{NAMESPACE.CAMPO}}` placeholders aceites já substituídos nos sítios correctos, destacados a amarelo. Reactivo — atualiza automaticamente quando o utilizador aceita/rejeita variáveis ou edita placeholders
- O toggle mantém o estado durante toda a etapa de revisão
- O modo "Template" usa a função `applyVariablesToText` já existente para calcular o texto transformado
- Zero erros TypeScript (`EXIT:0`)

## Out of scope

- Edição do texto transformado directamente no painel de preview
- Persistência do modo seleccionado entre sessões
- Mudanças na etapa "naming" ou no fluxo de gravação (`handleSave` já chama `applyVariablesToText` correctamente)

## Steps

1. **Estado do toggle** — Adicionar estado `previewMode: "original" | "template"` no componente `ContractImportWorkspace`, com valor inicial `"original"`
2. **Cabeçalho do painel esquerdo** — Adicionar dois botões de toggle (estilo segmented control) no cabeçalho da coluna esquerda da etapa "review", ao lado do título "Documento com variáveis destacadas"
3. **Renderização condicional** — No corpo do painel esquerdo, renderizar `highlightVariablesInText(rawText, variables, activeVariableId)` quando `previewMode === "original"`, e o texto transformado com placeholders amarelos (usando `applyVariablesToText` + função auxiliar de highlight semelhante à `renderPreviewWithPlaceholders` já existente no `TemplateEditModal`) quando `previewMode === "template"`
4. **Reactivo** — Garantir que o modo "Template" recalcula sempre que `variables` muda (os `useState` já propagam; sem `useMemo` adicional necessário)
5. **TypeScript check** — Confirmar `EXIT:0` após as alterações

## Relevant files

- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx:63-105`
- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx:590-640`
- `apps/web/src/modules/contracts/services/semantic-parser.service.ts:182-196`
- `apps/web/src/modules/contracts/components/TemplateEditModal.tsx:93-109`