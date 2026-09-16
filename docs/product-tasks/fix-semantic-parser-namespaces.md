---
title: Melhorar detecção de variáveis no Contract Intelligence Engine — namespaces e validação
---
# Melhorar detecção de variáveis no Contract Intelligence Engine

## What & Why

A IA está a perder variáveis de partes envolvidas no contrato (ex: AUTOR, COMPOSITOR,
EDITORA, CEDENTE, CESSIONÁRIO) porque:

1. **Namespaces insuficientes no system prompt** — só existem CONTRATANTE/CONTRATADO
   mas contratos musicais têm AUTOR, COMPOSITOR, EDITORA, CEDENTE, CESSIONARIO, etc.
2. **Regra destrutiva no system prompt** — "se não conseguir determinar o namespace
   correto, omita a variável" → a IA descarta em vez de aproximar
3. **Validação rígida no frontend** — `validatePlaceholder()` em
   `semantic-parser.service.ts:87-91` rejeita silenciosamente qualquer namespace
   fora da lista hardcoded — variáveis que a IA detecta correctamente são filtradas

## Done looks like

- A IA detecta os dados de TODOS os envolvidos num contrato (editora, autor,
  compositor, cedente, cessionário, etc.)
- Nenhuma variável válida é descartada por namespace desconhecido
- O frontend aceita qualquer namespace no formato `{{NAMESPACE.CAMPO}}`
  (regex estrutural) sem lista fechada
- TypeScript EXIT:0

## Steps

1. **Expandir namespaces no system prompt** — adicionar ao SYSTEM_PROMPT:
   `AUTOR, COMPOSITOR, EDITORA, CEDENTE, CESSIONARIO, INTERPRETE, GRAVADORA,
   MUSICO, AGENCIA, REPRESENTANTE, LICENCIANTE, LICENCIADO, PARTE_A, PARTE_B`
   e atualizar os exemplos de placeholders para cobrir contratos de cessão

2. **Remover regra "omita"** — substituir a última linha do system prompt:
   - ANTES: "se não conseguir determinar o namespace correto, omita a variável"
   - DEPOIS: "se não conseguir determinar o namespace correto, use PARTE_A ou PARTE_B"

3. **Relaxar validação de namespace no frontend** — em `validatePlaceholder()`:
   - ANTES: verificar `ALLOWED_NAMESPACES.has(namespace)`
   - DEPOIS: apenas verificar formato estrutural `{{NAMESPACE.CAMPO}}` com regex
     `/^\{\{[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\}\}$/`
   - Remover a constante `ALLOWED_NAMESPACES` (já não é necessária)

4. **Atualizar `ALLOWED_NAMESPACES` em `semantic-parser.service.ts`** — se a
   constante for ainda usada para UI/labels, expandir com os novos namespaces;
   caso contrário, remover

5. **TypeCheck**: `cd apps/web && npx tsc --noEmit -p tsconfig.app.json 2>&1; echo "EXIT:$?"`

## Relevant files

- `apps/web/src/modules/contracts/services/semantic-parser.service.ts`
  - linhas 7-61: SYSTEM_PROMPT
  - linhas 81-91: ALLOWED_NAMESPACES + validatePlaceholder
  - linhas 93-108: tryNormalizeVariable (usa validatePlaceholder)
