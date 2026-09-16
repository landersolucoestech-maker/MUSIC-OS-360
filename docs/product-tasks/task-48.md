---
title: Contract Template Engine — Refactor Completo
---
# Contract Template Engine — Refactor Completo

## What & Why
O módulo "Tipos de Contratos" actual é um formulário CRUD simples com campos planos. O objectivo é transformá-lo num sistema profissional de templates contratuais musicais: participantes tipados com geração automática de variáveis, editor de cláusulas com autocomplete de variáveis, secções de obra musical, assinatura digital (estrutura), branding, e preview dinâmico — tudo dentro de um modal multi-tab de 8 secções. Nenhuma lógica de negócio existente é removida; o sistema existente de `contract_service_types` é estendido.

## Done looks like
- A aba "Tipos de Contratos" em `/contratos/templates` abre um modal multi-tab com 8 abas: Informações Gerais, Envolvidos, Financeiro, Obra Musical, Cláusulas, Assinaturas, Branding, Preview
- **Aba 1 — Informações Gerais**: nome, categoria, tipo de contrato (select), descrição; slug e ordem ficam em secção "Avançado" colapsável
- **Aba 2 — Envolvidos**: adicionar participantes com role (CONTRATANTE, CONTRATADO, ARTISTA, PRODUTOR, EMPRESA, LABEL, EMPRESÁRIO, COMPOSITOR, TESTEMUNHA, REPRESENTANTE LEGAL), tipo de entidade (PF / PJ); ao seleccionar PF são geradas automaticamente as variáveis `{{ROLE_NOME_COMPLETO}}`, `{{ROLE_CPF}}`, `{{ROLE_RG}}`, `{{ROLE_EMAIL}}` etc.; ao seleccionar PJ são geradas `{{ROLE_RAZAO_SOCIAL}}`, `{{ROLE_CNPJ}}`, `{{ROLE_REPRESENTANTE_LEGAL}}` etc.; as variáveis geradas são exibidas como badges na linha do participante
- **Aba 3 — Financeiro**: checkboxes para royalties, valor fixo, adiantamento, suporte mensal, parcelamento; campos de moeda padrão, frequência de pagamento, multa, juros, vencimento; categoria financeira padrão
- **Aba 4 — Obra Musical**: título, ISRC, UPC, género, idioma, data de lançamento, plataformas (multi-select), tipo de distribuição
- **Aba 5 — Cláusulas**: lista de cláusulas (título + conteúdo) com ScrollArea interno; ao digitar `{{` no textarea de conteúdo abre um popover de autocomplete com busca, categorias (Participantes, Financeiro, Obra Musical, Vigência, Sistema, Personalizadas), descrição e exemplo de cada variável; variáveis são destacadas visualmente no editor; variáveis inexistentes mostram indicador de erro
- **Aba 6 — Assinaturas**: toggle "habilitar assinatura digital"; ordem de assinatura (drag ou seleção); opção "exigir testemunhas"; campo de provider (Autentique, DocuSign — placeholder); campo "trilha de auditoria" toggle
- **Aba 7 — Branding**: upload de cabeçalho e rodapé (existentes, mantidos); toggle watermark; campo de logo; alinhamento, margens, fonte do documento, numeração de páginas
- **Aba 8 — Preview**: render dinâmico do contrato substituindo todas as variáveis por valores mock realistas; atualiza em tempo real ao trocar de aba; exibe formatação final com cabeçalho/rodapé/logo se definidos
- O modal tem largura `max-w-5xl` e altura `90vh`; navegação entre abas preserva todos os dados do formulário (state interno sem reset entre abas)
- Sistema de variáveis tem estrutura tipada: `{ id, key, label, type, source, category, required, example, participantReference }`; variáveis de participantes são geradas automaticamente ao adicionar/alterar participantes; variáveis fixas do sistema (datas, obra) sempre disponíveis
- Todas as validações obrigatórias: slug único, cláusulas não vazias, ao menos um participante, datas consistentes
- O payload salvo em `contract_service_types` é retrocompatível com o schema existente — os novos campos (participants, variables, music_work, signature_settings, branding_settings) são armazenados como JSON serializado em campos de texto existentes ou em campos novos no objecto armazenado no localStorage (mock mode); nenhuma migração de dados de produção é necessária
- Visual consistente com o design system MUSIC OS 360: dark mode, card sections, badges, tipografia Plus Jakarta Sans

## Out of scope
- Geração real de PDF
- Integração real com Autentique / DocuSign (estrutura preparada, não funcional)
- Publicação no backend NestJS / TypeORM (permanece mock mode)
- IA para geração de cláusulas (estrutura preparada com campo `aiGenerated` nos tipos, sem implementação)
- Alterações nos módulos fora de `contracts/`
- Alterações em `ContratoFormModal`, `ContratoViewModal`, `TemplateContratoFormModal`

## Steps

1. **Novos tipos TypeScript** — Em `contracts/types/contracts.types.ts`, definir as interfaces `ContractTemplate`, `Participant`, `ContractVariable`, `ContractClause`, `FinancialSettings`, `MusicWork`, `SignatureSettings`, `BrandingSettings`, `ParticipantRole`, `EntityType`. Garantir que `ContractServiceType` existente se mantém ou é um alias/subset de `ContractTemplate` para backward compat.

2. **Sistema de variáveis** — Criar `contracts/utils/contract-variables.ts` com: (a) lista de variáveis fixas do sistema agrupadas por categoria (Vigência, Obra Musical, Sistema); (b) função `generateParticipantVariables(role, entityType)` que retorna o array de `ContractVariable` para um participante PF ou PJ; (c) função `resolveAllVariables(participants)` que junta fixas + geradas e retorna a lista completa ordenada por categoria.

3. **Aba Informações Gerais** — Refatorar a secção equivalente do `ServiceTypeFormModal` para a Aba 1: nome, categoria (select com: Agenciamento, Distribuição, Produção, Licenciamento, Publicação, Outros), tipo de contrato (texto livre), descrição; slug + ordem colapsáveis.

4. **Aba Envolvidos** — Construir `ParticipantEditor`: botão "Adicionar Envolvido" abre um inline form com select de role + toggle PF/PJ; ao confirmar, o participante aparece em card com nome do role, tipo de entidade, e badges das variáveis geradas automaticamente; permitir remover; os cards são reordenáveis por drag (ou botões ↑↓ como fallback).

5. **Aba Financeiro** — Manter os checkboxes existentes (requires_royalties, requires_fixed_value, requires_advance, requires_financial_support, allow_installments) e adicionar: select de moeda (BRL padrão), select de frequência de pagamento (único, mensal, trimestral, anual), campos de multa (%) e juros (% ao mês), campo de vencimento padrão (dias), categoria financeira padrão.

6. **Aba Obra Musical** — Construir form com campos: título da obra, ISRC, UPC, género (select), idioma (select), data de lançamento, plataformas (multi-checkbox: Spotify, Apple Music, YouTube Music, Deezer, Tidal, Amazon Music, outros), tipo de distribuição (exclusiva / não-exclusiva / licença).

7. **Autocomplete de variáveis no editor de cláusulas** — No textarea de conteúdo de cada cláusula, detectar quando o utilizador digita `{{` (via `onChange`) e abrir um `Popover` posicionado com lista de variáveis disponíveis filtrada por busca; clicar numa variável insere `{{VARIABLE_KEY}}` no cursor; variáveis já inseridas que existam na lista são destacadas visualmente (fundo com `bg-primary/10`); variáveis não encontradas na lista ficam com `bg-destructive/10`.

8. **Aba Assinaturas** — Construir form com toggle "habilitar assinatura", lista de participantes em ordem de assinatura (reordenável), toggle "exigir testemunhas", select de provider (Autentique, DocuSign — desabilitados com tooltip "em breve"), toggle "trilha de auditoria".

9. **Aba Branding** — Manter upload de cabeçalho/rodapé existente; adicionar: upload de logo, toggle de watermark (campo de texto do watermark), select de alinhamento do texto (esquerda/centro/justificado), select de fonte (Plus Jakarta Sans, Arial, Times New Roman), toggle de numeração de páginas, campos de margem (top/bottom/left/right em mm com defaults).

10. **Aba Preview** — Construir componente `ContractPreview` que: (a) recolhe todos os dados do formulário via `useWatch` ou passagem de props; (b) substitui cada `{{VARIABLE_KEY}}` por um valor mock da propriedade `example` da variável correspondente; (c) renderiza as cláusulas como HTML formatado num div com classes de tipografia (`prose`-like); (d) mostra cabeçalho e rodapé se definidos como imagens.

11. **Orquestração do modal multi-tab** — Refactorizar `ServiceTypeFormModal` para usar `Tabs`/`TabsList`/`TabsContent` (shadcn); mover toda a lógica de submit e state para o topo do componente; garantir que mudar de aba não apaga dados; o botão "Salvar" no footer funciona em qualquer aba activa; indicadores visuais de abas com erros (ponto vermelho no tab label se `formState.errors` tocar campos dessa aba).

12. **Persistência** — Atualizar `contractsService.createContractServiceType` / `updateContractServiceType` para serializar os novos campos (participants, variables, music_work, signature_settings, branding_settings) como parte do objecto salvo; atualizar `useContractServiceTypes` hook para deserializar e expor os novos campos; garantir retrocompatibilidade com registos antigos sem os novos campos (defaults seguros).

## Relevant files
- `apps/web/src/modules/contracts/components/ServiceTypeFormModal.tsx`
- `apps/web/src/modules/contracts/hooks/useContractServiceTypes.ts`
- `apps/web/src/modules/contracts/pages/TemplatesContratos.tsx`
- `apps/web/src/modules/contracts/services/contracts.service.ts`
- `apps/web/src/modules/contracts/types/contracts.types.ts`
- `apps/web/src/shared/data/mockData.ts`
- `apps/web/src/shared/lib/storage.ts`
- `apps/web/src/shared/ui/tabs.tsx`
- `apps/web/src/shared/ui/popover.tsx`
- `apps/web/src/shared/ui/collapsible.tsx`