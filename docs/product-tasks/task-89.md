---
title: Wizard Novo Contrato — Template-Driven
---
# Wizard "Novo Contrato" — Template-Driven

## What & Why
O modal `ContratoFormModal` ainda usa campos fixos (`client_type`, `artist_id`, `company_id`, `contractor_contact`, `responsible_person`) que são arquitecturalmente incompatíveis com a engine semântica de templates já existente no sistema. O modal deve ser substituído por um wizard profissional de 6 etapas, totalmente controlado pelo template seleccionado. O formulário nunca mais assume "cliente + artista + empresa" — tudo é derivado do semantic manifest do template.

## Done looks like
- Clicar "Novo Contrato" abre um wizard de página inteira (ou dialog fullscreen) dividido em dois painéis: esquerda (wizard steps + form dinâmico) e direita (preview jurídico em tempo real).
- Etapa 1 — Template: dropdown mostra apenas os templates activos com o seu label da CategoryRegistry; ao seleccionar, o sistema lê o `variables_manifest` e extrai placeholders, partes e signatários.
- Etapa 2 — Partes: o sistema detecta automaticamente os roles presentes nos placeholders do template (ex: `{{REPRESENTANTE.NAME}}` gera o role "REPRESENTANTE") e renderiza um formulário por role com os campos corrects (PF: nome, CPF, RG, endereço, profissão, estado civil; PJ: razão social, CNPJ, endereço, representante legal; Artista: nome artístico, nome civil, CPF). Cada parte pode ser preenchida manualmente, vinda do CRM ou dos Artistas.
- Etapa 3 — Variáveis: inputs gerados dinamicamente a partir do manifest (`text`, `textarea`, `number`, `percentage`, `currency`, `boolean`, `select`, `date`). Nenhum campo financeiro hardcoded.
- Etapa 4 — Documento: o template é renderizado com as variáveis/partes preenchidas; o preview à direita atualiza em tempo real; placeholders não resolvidos ficam destacados em amarelo com ⚠.
- Etapa 5 — Signatários: signatários detectados automaticamente via `{{SIGNATURE.ROLE}}` no template; cada signatário tem nome, email, obrigatório, ordem, provider (DocuSign / Clicksign / Autentique).
- Etapa 6 — Revisão: resumo de tudo antes de guardar. Botão "Guardar Rascunho" cria o contrato com `status: draft`. Botão "Enviar para Assinatura" cria o contrato e simula o envio.
- O modal de edição (`mode: "edit"`) hidrata o wizard com os dados existentes.
- Os campos `client_type`, `artist_id`, `company_id`, `contractor_contact`, `responsible_person` são completamente removidos do modal.
- TypeScript sem erros (`tsc --noEmit` EXIT:0).

## Out of scope
- Integração real com DocuSign / Clicksign / Autentique (infra de webhook, OAuth) — apenas a UI e estrutura de dados.
- PDF export / geração de ficheiro PDF (apenas preview HTML).
- Alteração da engine de templates (ContractImportWorkspace, parseContractText, useTemplatesContratos).
- Alteração de backend/API.
- Módulo de assinatura separado — apenas o fluxo dentro do wizard.

## Steps

1. **Novo componente `ContratoWizard`** — Criar `apps/web/src/modules/contracts/components/ContratoWizard.tsx`. Wizard de 6 etapas com sidebar de navegação (Template → Partes → Variáveis → Documento → Signatários → Revisão). Layout: painel esquerdo 55% (form) + painel direito 45% (preview). Usa `useState` para etapa actual e dados do wizard. Substituir a abertura do `ContratoFormModal` em `Contratos.tsx` por este wizard (dialog fullscreen ou drawer).

2. **Etapa 1 — Selecção de template** — Dropdown com os templates activos (hook `useTemplatesContratos`). Ao seleccionar, fazer parse do `variables_manifest` (JSON) para extrair variáveis, e parse do `conteudo` via regex `\{\{([A-Z_]+)\.([A-Z_]+)\}\}` para extrair roles de partes (ex: `REPRESENTANTE`, `REPRESENTADO`, `TESTEMUNHA_1`). Guardar no estado do wizard: `{ templateId, manifest, detectedRoles, rawContent }`.

3. **Etapa 2 — Partes contratuais dinâmicas** — Para cada role detectado, renderizar um card com: selector de origem (Manual / CRM / Artistas) e campos corrects conforme tipo esperado (PF / PJ / Artista). Os campos de PF/PJ/Artista devem estar num sub-componente `PartyForm`. A escolha "CRM" mostra um Select com `useClientes()`; "Artistas" mostra um Select com artistas; "Manual" mostra os campos directamente.

4. **Etapa 3 — Variáveis dinâmicas** — Ler as variáveis do manifest (array `variables` ou todos os `{{PLACEHOLDER}}` do conteúdo que não sejam roles de partes nem `SIGNATURE.*`). Para cada variável, renderizar o input correcto pelo tipo (`text` → `<Input>`, `textarea` → `<Textarea>`, `number`/`currency`/`percentage` → `<Input type="number">`, `date` → `<DatePickerField>`, `boolean` → `<Checkbox>`, `select` → `<Select>`). Guardar valores em `Record<string, string>`.

5. **Etapa 4 — Preview do documento** — Renderizar o `conteudo` do template substituindo todos os placeholders pelos valores preenchidos nas etapas 2 e 3. Placeholders não resolvidos ficam em `<span class="bg-yellow-100 text-yellow-800">⚠ {{PLACEHOLDER}}</span>`. Preview em painel direito com scroll, tipografia jurídica (font IBM Plex Mono ou serif), header/footer images do template se existirem.

6. **Etapa 5 — Signatários** — Detectar automaticamente `{{SIGNATURE.ROLE}}`, `{{INITIALS.ROLE}}`, `{{SIGN_DATE.ROLE}}` do conteúdo. Para cada role de assinatura, criar uma linha de signatário com: nome (pré-preenchido da Etapa 2 se o role coincide), email, obrigatório (checkbox), ordem (number), provider (Select: DocuSign / Clicksign / Autentique). Permitir adicionar signatários adicionais manualmente.

7. **Etapa 6 — Revisão e gravação** — Mostrar resumo: template seleccionado, partes preenchidas, nº de variáveis, nº de signatários, provider. Botão "Guardar Rascunho": chamar `createContrato.mutate({ titulo, template_id, status: "rascunho", signers, ... })` onde os dados das partes e variáveis ficam em `observacoes` (JSON serializado) até existir schema dedicado. Botão "Enviar para Assinatura": mesmo mas `status: "aguardando_assinatura"` + `toast.info("Envio simulado — integração com [provider] não activa")`.

8. **Limpar ContratoFormModal** — Remover completamente os campos `client_type`, `artist_id`, `company_id`, `contractor_contact`, `responsible_person` do schema Zod `contrato-schema.ts` e do componente. Atualizar `Contratos.tsx` para usar `ContratoWizard` em vez de `ContratoFormModal` para criação. O modal de edição pode continuar a existir em forma simplificada (apenas status, datas, observações) ou também usar o wizard com hidratação.

## Relevant files
- `apps/web/src/modules/contracts/components/ContratoFormModal.tsx`
- `apps/web/src/modules/contracts/pages/Contratos.tsx`
- `apps/web/src/modules/contracts/lib/contrato-schema.ts`
- `apps/web/src/modules/contracts/types/contracts.types.ts`
- `apps/web/src/modules/contracts/hooks/useTemplatesContratos.ts`
- `apps/web/src/modules/contracts/hooks/useContractServiceTypes.ts`
- `apps/web/src/modules/contracts/hooks/useCategoryRegistry.ts`
- `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`
- `apps/web/src/modules/contracts/hooks/useContratos.ts`
- `apps/web/src/modules/crm/hooks/useClientes.ts`