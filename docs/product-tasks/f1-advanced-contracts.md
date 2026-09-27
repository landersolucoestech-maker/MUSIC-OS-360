# Contratos — Upload, Versionamento e Vínculos

## What & Why
Elevar o módulo de Contratos ao nível operacional: permitir anexar o arquivo PDF do contrato (via URL), manter histórico de versões (v1, v2, v3...), vincular contratos a artistas e lançamentos de forma visível, e preparar a arquitetura para integração futura com Autentique (assinatura digital). Atualmente o módulo apenas registra metadados — sem o arquivo real e sem rastreabilidade de versões.

## Done looks like
- Formulário de contrato ganha campo **"URL do arquivo"** (PDF) com botão "Abrir" no modal de visualização
- Modal de visualização exibe link de download/abertura do PDF, status de assinatura atual e histórico de versões
- **Histórico de versões**: cada contrato pode ter N versões; ao editar e salvar com mudança de documento, cria uma nova entrada de versão (v1, v2...) com data e autor; lista de versões no modal de view
- **Vínculos explícitos**: ao criar/editar um contrato, campo para vincular a um Lançamento específico (select); na view, link direto para o lançamento vinculado
- Na página de **Artistas → Visão 360**, aba Contratos lista todos os contratos do artista com status, valor e link para abrir o contrato
- Na página de **Lançamentos → View**, seção "Contratos" mostra contratos vinculados ao lançamento
- Campo de status `aguardando_assinatura` adicionado (além de ativo/expirado/cancelado) — preparação para Autentique
- KPI novo na página: "Aguardando assinatura" com badge de contagem
- Alerta visual em contratos com data de vencimento nos próximos 30 dias (badge `expirando`)

## Out of scope
- Integração real com Autentique (API calls reais)
- Geração automática de PDF a partir de template
- Múltiplos signatários / workflow de aprovação
- Upload real de arquivo para storage (apenas URL por enquanto)

## Steps
1. **Expandir modelo de dados** — Adicionar `arquivo_url`, `lancamento_id`, `versoes` (array com `{versao, url, criado_em, notas}`), status `aguardando_assinatura` aos tipos e mockData
2. **Atualizar formulário de contrato** — Campos: URL do arquivo, select de lançamento vinculado, notas de versão (campo livre ao salvar uma nova versão)
3. **Modal de visualização expandido** — Seção "Arquivo": botão abrir PDF; seção "Histórico de Versões": lista de versões com data e notas; seção "Lançamento vinculado": link para o lançamento
4. **Alerta de vencimento** — Lógica que detecta contratos com `data_fim` nos próximos 30 dias e exibe badge `expirando` na lista e no KPI
5. **Integração reversa com Artistas e Lançamentos** — Na aba Contratos do Visão 360 do artista, exibir lista dos contratos; na aba de um lançamento, mostrar contratos vinculados
6. **Arquitetura Autentique** — Adicionar campo `autentique_doc_id` (nullable string) e botão "Enviar para assinatura" (disabled com tooltip "em breve — integração Autentique") no modal de view

## Relevant files
- `client/src/modules/contracts/pages/Contratos.tsx`
- `client/src/modules/contracts/components/ContratoFormModal.tsx`
- `client/src/modules/contracts/components/ContratoViewModal.tsx`
- `client/src/modules/contracts/hooks/useContratos.ts`
- `client/src/modules/artist/components/ArtistaVisao360Modal.tsx`
- `client/src/modules/releases/components/LancamentoViewModal.tsx`
- `client/src/shared/data/mockData.ts`
