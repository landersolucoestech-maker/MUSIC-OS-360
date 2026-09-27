# Artistas — Perfil 360 Completo

## What & Why
Expandir a gestão de artistas para cobrir todo o ciclo de vida operacional: histórico de interações, galeria de mídia, documentos vinculados, relacionamentos (manager, produtor, label parceira), e visão completa de contratos + lançamentos + financeiro por artista — tudo dentro do modal Visão 360. O objetivo é que a equipe possa operar o artista inteiramente de um lugar.

## Done looks like
- Modal Visão 360 do artista ganha aba **Histórico** com timeline de eventos (criação, alterações de status, contratos assinados, lançamentos publicados) — alimentada por dados existentes do sistema
- Aba **Mídia** no 360: galeria de fotos (URLs, múltiplas), campo de banner/capa, campo de vídeo-apresentação (YouTube embed)
- Aba **Documentos**: lista de documentos vinculados (press kit URL, bio PDF URL, rider técnico URL), com botão "Abrir" para cada um
- Aba **Relacionamentos**: campos para manager (nome + contato), produtor executivo, label parceira, agência de booking
- Lista de artistas ganha filtro por status `onboarding` além dos existentes
- Badge de status `onboarding` aparece no StatusBadge com cor warning/amarelo
- Formulário de edição de artista (`ArtistaFormModal`) inclui novos campos: galeria de fotos (JSON array de URLs), vídeo YouTube, manager, produtor, agência, documentos

## Out of scope
- Upload real de arquivos (usar URLs por enquanto)
- Automação de histórico em tempo real (alimentar pelo mock data existente)
- Integração com plataformas de streaming para puxar dados automaticamente

## Steps
1. **Expandir modelo de dados do artista** — Adicionar campos no mockData e nos tipos TypeScript: `galeria_urls`, `video_apresentacao_url`, `manager_nome`, `manager_contato`, `produtor_executivo`, `agencia_booking`, `label_parceira`, `documentos` (array de `{nome, url}`)
2. **Atualizar `ArtistaFormModal`** — Adicionar seção "Mídia" (galeria de URLs com add/remove dinâmico, vídeo YouTube), seção "Relacionamentos" (manager, produtor, agência, label), seção "Documentos" (lista de nome+URL)
3. **Aba Mídia no 360** — Galeria de fotos em grid, embed de vídeo YouTube (iframe), campo de banner exibido no topo do modal
4. **Aba Documentos no 360** — Lista dos documentos com ícone, nome e botão "Abrir" (abre URL em nova aba)
5. **Aba Relacionamentos no 360** — Cards compactos para manager, produtor, agência, label com nome e contato
6. **Aba Histórico no 360** — Timeline vertical com eventos derivados dos dados existentes (data de criação, contratos, lançamentos vinculados ao artista)
7. **Filtro `onboarding` na listagem** — Adicionar opção na listagem de artistas + badge correto no StatusBadge

## Relevant files
- `client/src/modules/artist/pages/Artistas.tsx`
- `client/src/modules/artist/components/ArtistaVisao360Modal.tsx`
- `client/src/modules/artist/components/ArtistaFormModal.tsx`
- `client/src/modules/artist/hooks/useArtistas.ts`
- `client/src/shared/components/StatusBadge.tsx`
- `client/src/shared/data/mockData.ts`
