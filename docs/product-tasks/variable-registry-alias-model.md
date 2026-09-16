# Variable Registry — Alias + Nomenclatura Interna + Pré-seeds

## What & Why
A especificação define que a variável de template tem dois eixos:

1. **Alias Visual/Jurídico** (campo esquerdo) — o nome que aparece no contrato e no placeholder: `ARTISTA`, `GRAVADORA`, `LICENCIANTE`. É o prefixo do placeholder: `{{ARTISTA.CPF}}`.
2. **Nomenclatura Interna/Técnica** (campo direito) — organização lógica interna: `artist`, `label`, `licensor`. Não aparece no placeholder; serve para busca, agrupamento e documentação interna.

O registry actual usa "Grupo / Contexto" para o que conceptualmente é o Alias, e não tem o campo de nomenclatura interna. Além disso, o utilizador precisa de ver exemplos já criados para entender o padrão antes de criar as suas próprias variáveis.

## Done looks like
- Formulário "Nova Variável" com dois campos renomeados:
  - Campo esquerdo: **Alias Visual / Jurídico** (placeholder: "ARTISTA") — normalizado UPPERCASE
  - Campo direito (novo): **Nomenclatura Interna** (placeholder: "artist") — guardado mas não aparece no placeholder gerado
  - Campo existente: **Campo** (placeholder: "NAME") — mantido igual
- Preview automático mostra `{{ALIAS.CAMPO}}` (como antes, mas conceptualmente correcto)
- Tabela mostra coluna extra "Nomenclatura Interna" (se preenchida)
- Ao abrir `/contratos/variaveis` pela primeira vez (localStorage vazio), carrega automaticamente ~10 variáveis de exemplo:
  - ARTISTA.NAME, ARTISTA.CPF, ARTISTA.EMAIL, ARTISTA.CNPJ (internalGroup: artist)
  - GRAVADORA.NAME, GRAVADORA.CNPJ (internalGroup: label)
  - LICENCIANTE.NAME, LICENCIANTE.CPF (internalGroup: licensor)
  - CONTRATANTE.NAME, CONTRATANTE.CPF (internalGroup: contractor)
- Criar, editar e apagar variáveis funciona tal como antes
- TypeScript: EXIT:0

## Out of scope
- Usar `internalGroup` para filtragem automática no editor de templates (futuro)
- Migrar variáveis DEFAULT_VARIABLE_GROUPS do editor para usar este modelo
- Backend persistence (localStorage apenas, por design)

## Steps
1. **Atualizar interface `RegistryVariable`** — adicionar campo opcional `internalGroup?: string` ao tipo em `useVariableRegistry.ts`
2. **Adicionar pré-seeds** — quando o hook carrega e o localStorage está vazio, popular com os ~10 exemplos acima (ARTISTA, GRAVADORA, LICENCIANTE, CONTRATANTE com campos NAME, CPF, EMAIL, CNPJ conforme aplicável)
3. **Atualizar formulário modal** — renomear "Grupo / Contexto" → "Alias Visual / Jurídico", adicionar campo "Nomenclatura Interna" (opcional, não afecta o placeholder), atualizar lógica de `addVariable`/`updateVariable` para persistir `internalGroup`
4. **Atualizar tabela** — adicionar coluna "Nomenclatura Interna" entre "Grupo/Alias" e "Campo"; mostrar o valor ou dash se vazio

## Relevant files
- `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`
- `apps/web/src/modules/contracts/pages/VariableRegistry.tsx`
