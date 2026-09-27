# Signatários inline no formulário de contrato

## What & Why
O formulário de criação/edição de contrato precisa de uma secção de signatários directamente nele, sem sair da página nem navegar para qualquer wizard. O utilizador preenche os dados do contrato e os signatários no mesmo formulário, tudo de uma vez.

## Done looks like
- O formulário de contrato (`ContratoFormModal`) tem uma nova secção "Signatários" no final, antes de "Observações"
- O utilizador pode adicionar signatários inline: clicar "Adicionar Signatário" expande uma linha com campos nome, email e select de role (artista, label, testemunha, etc.)
- Cada signatário tem um botão de remover; limite de 10 signatários
- Os signatários são guardados junto ao contrato no localStorage ao submeter o formulário
- A aba "Assinatura Digital" no modal de visualização do contrato mostra os signatários guardados (lidos directamente de `contrato.signers`) — sem botão de redirect para wizard, sem navegação para outra página
- O botão "Iniciar Processo de Assinatura" (que redirigia para `/contratos/assinatura/novo`) é removido completamente
- tsc --noEmit → 0 erros

## Out of scope
- Qualquer wizard de assinatura — o `DocumentWizard` (contracts-v2) não é tocado
- Navegação para outras páginas durante o fluxo de contratos
- Integração real com Autentique (continua mock)
- Templates com variáveis — não são alterados

## Steps
1. **Estender o schema e tipo** — Adicionar campo `signers` (array de `{ name, email, role }`) ao `contratoSchema` e ao tipo `Contrato` em mock data, com default `[]`
2. **Secção Signatários no ContratoFormModal** — Adicionar card "Signatários" no formulário. Botão "Adicionar Signatário" insere uma linha inline com campos nome, email e select de role. Cada linha tem botão ×. Os valores ficam em `useFieldArray` do react-hook-form.
3. **Persistir no mock data** — Garantir que os signatários são guardados ao submeter (criar/editar contrato) via o mapper/hook existente.
4. **Atualizar aba "Assinatura Digital"** — Remover o botão "Iniciar Processo de Assinatura" e o redirect para o wizard. Mostrar directamente a lista de signatários de `contrato.signers`. Se a lista estiver vazia, mostrar mensagem "Adicione signatários no formulário do contrato".
5. **Validação tsc** — Correr `cd client && npx tsc --noEmit` e resolver todos os erros de tipo.

## Relevant files
- `client/src/modules/contracts/components/ContratoFormModal.tsx`
- `client/src/modules/contracts/lib/contrato-schema.ts`
- `client/src/modules/contracts/components/ContratoViewModal.tsx`
- `client/src/modules/contracts-v2/types/index.ts`
- `client/src/shared/data/mockData.ts`
