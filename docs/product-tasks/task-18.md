---
title: Calendário Editorial — Media Upload, Feed View & Plataformas
---
# Calendário Editorial — Upgrade Visual e Media

## What & Why
Elevar o módulo Calendário de Conteúdo de um CRUD funcional a uma plataforma editorial moderna de social media, com upload real de mídia, configurações avançadas por plataforma (Instagram/TikTok/YouTube), vista Feed em grade, e serviços stub prontos para ligar às APIs públicas das plataformas.

O módulo já tem a estrutura base (WeeklyCalendar, CalendarCard, ContentModal dois painéis, filtros, navegação). Este upgrade preenche as lacunas visuais e funcionais descritas no prompt de refatoração.

## Done looks like
- **MediaUploader** dedicado com drag-and-drop visual, barra de progresso simulada, validação de formato (mp4/mov/jpg/png/gif/webp) e tamanho (200MB), geração de thumbnail para vídeo via canvas, e preview instantâneo da mídia selecionada — integrado no painel esquerdo do ContentModal
- **Configurações avançadas por plataforma** no ContentModal: quando Instagram está selecionado, mostrar campos de hashtags (chips editáveis), localização, e toggle de carrossel; quando YouTube, mostrar campos de tags, privacy status (público/não-listado/privado) e campo de thumbnail separado; quando TikTok, mostrar campo de duração e thumbnail personalizado
- **Vista Feed** nova no seletor de view — grade responsiva (3 colunas) de CalendarCards em modo visual amplo, com thumbnail dominante e botão de ação de publicação visível
- **CalendarCard visual upgrade** — na vista semanal (modo compact) mostrar pill com cor da plataforma + dot de status; no modo normal, thumbnail em aspecto 4:5 para Stories/Reels ou 16:9 para vídeo/post, badge de plataforma no canto superior direito, horário em fonte mono, e indicador de status com cor semântica
- **Serviços stub** para `instagram.service.ts`, `tiktok.service.ts`, `youtube.service.ts` sob `modules/marketing/services/` — cada um exporta funções tipadas (`schedulePost`, `publishNow`, `getAnalytics`) que em modo mock retornam dados simulados e em modo real lançarão para a API — prontos para integração futura sem alterar os chamadores
- **`useMediaUpload` hook** em `modules/marketing/hooks/` — encapsula estado do ficheiro (file, preview URL, progress, error, isUploading), função `upload(file)` com validação e progresso, `reset()`, e `generateThumbnail(videoFile)` via canvas/URL.createObjectURL
- **`useContentScheduler` hook** — wrapper de `useConteudos` com lógica de scheduling: `scheduleContent(payload)`, `publishNow(id)`, `getScheduledForWeek(weekStart)`, `getByStatus(status)`
- Sem regressões: sidebar, layout global, roteamento, e todos os outros módulos permanecem intactos

## Out of scope
- OAuth real com Instagram/TikTok/YouTube (requer credenciais de produção e domínio verificado)
- Publicação real nas plataformas (as funções stub simulam sucesso em mock mode)
- Workers BullMQ / Redis / FFmpeg (backend infra — tarefa separada)
- Drag-and-drop de cards entre slots do calendário
- Vista Kanban
- Media Library standalone (painel separado de gestão de assets)
- Analytics reais (os dados são mock da tabela `monitoramentos` existente)
- Implementação de monetização YouTube / music library TikTok / Instagram collab
- Alterações na sidebar ou no layout global

## Steps
1. **`useMediaUpload` hook** — criar hook em `hooks/useMediaUpload.ts` com estado (file, previewUrl, progress, error, isUploading), validação de formato e tamanho, geração de thumbnail via `URL.createObjectURL` + canvas para vídeo, e reset. Usar `setTimeout` para simular progresso em mock mode.

2. **`MediaUploader` component** — criar `components/calendar/MediaUploader.tsx` com zona de drag-and-drop visual (borda dashed animada ao drag-over), indicador de progresso (barra animada), preview da imagem/vídeo com botão de remoção, e mensagens de erro inline. Consumir o `useMediaUpload` hook. Substituir o upload básico existente no painel esquerdo do ContentModal por este componente.

3. **Configurações avançadas por plataforma no ContentModal** — expandir a secção "Configurações avançadas" existente com campos condicionais por plataforma:
   - Instagram: campo de hashtags (input chip-style com parse por espaço/vírgula e remoção por ×), campo de localização (texto livre), toggle de carrossel
   - YouTube: seletor de privacy status (Público/Não-listado/Privado), campo de tags (mesmo chip-style), campo de thumbnail separado com seu próprio MediaUploader mini
   - TikTok: toggle de privacidade (Público/Amigos/Privado), campo de thumbnail
   - Salvar estes campos no payload como JSON no campo `descricao` ou estender o tipo `ConteudoInsert` com campo `meta_plataforma` (JSONB compatível com o campo `[key: string]: unknown` do tipo `Conteudo`)

4. **CalendarCard visual upgrade** — modo compact (semana): pill com cor sólida da plataforma (usando variáveis PLAT_COLOR), dot de status colorido, e truncate no título; modo normal: thumbnail em aspecto correto por tipo (9:16 para Reels/Stories, 16:9 para Post/Vídeo, 1:1 para Carrossel), badge de plataforma no canto superior direito sobre a thumbnail, horário em `font-mono text-xs`, label de status com cor semântica (azul=agendado, verde=publicado, âmbar=pausado, cinza=rascunho, vermelho=falha).

5. **Vista Feed** — criar `components/calendar/FeedView.tsx` com grade 3-colunas de CalendarCards em modo visual expandido, ordenados por `data_publicacao` DESC. Adicionar `"feed"` ao tipo `ViewMode` em `Calendario.tsx`. Atualizar `CalendarFilters.tsx` para incluir a opção "Feed" no seletor de view. Registar o novo view em `Calendario.tsx` renderizando o `FeedView` quando `viewMode === "feed"`.

6. **Serviços stub de plataforma** — criar `services/instagram.service.ts`, `services/tiktok.service.ts`, `services/youtube.service.ts`. Cada um exporta: `schedulePost(payload) → Promise<{ id: string; scheduledAt: string }>`, `publishNow(conteudoId) → Promise<{ url: string }>`, `getAnalytics(conteudoId) → Promise<Analytics>`. Em mock mode (VITE_MOCK_MODE !== 'false') retornam dados simulados com delay; em modo HTTP lançam `NotImplementedError` com mensagem clara. Criar `services/publishing.service.ts` como facade que despacha para o serviço correcto com base na plataforma.

7. **`useContentScheduler` hook** — criar `hooks/useContentScheduler.ts` como wrapper de `useConteudos` adicionando: `scheduleContent(payload)` que chama `addConteudo` + `schedulePost` do publishing service, `publishNow(conteudo)` que chama `publishNow` do service e atualiza status para "publicado", `getScheduledForWeek(weekStart)` que filtra por data, `getByStatus(status)` que filtra por status. Exportar do barrel `hooks/index.ts`.

## Relevant files
- `apps/web/src/modules/marketing/components/calendar/ContentModal.tsx`
- `apps/web/src/modules/marketing/components/calendar/CalendarCard.tsx`
- `apps/web/src/modules/marketing/components/calendar/WeeklyCalendar.tsx`
- `apps/web/src/modules/marketing/components/calendar/CalendarFilters.tsx`
- `apps/web/src/modules/marketing/components/calendar/platform-icons.tsx`
- `apps/web/src/modules/marketing/hooks/useConteudos.ts`
- `apps/web/src/modules/marketing/pages/Calendario.tsx`
- `apps/web/src/modules/marketing/types/marketing.types.ts`
- `apps/web/src/modules/marketing/services/index.ts`
- `apps/web/src/shared/lib/storage.ts`
- `apps/web/src/shared/data/mockData.ts`