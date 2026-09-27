# Lançamentos — Pipeline Operacional e Assets

## What & Why
Transformar o módulo de Lançamentos em uma ferramenta operacional real: pipeline visual de status, checklist de assets obrigatórios por tipo de lançamento (single/EP/álbum), cronograma com data de entrega de materiais, e visão completa de cada release. A equipe precisa saber o que está faltando para publicar cada lançamento.

## Done looks like
- Página de Lançamentos ganha **view toggle** entre lista (atual) e **Kanban** (colunas: Planejado → Em Produção → Aguardando Distribuição → Publicado → Cancelado)
- No Kanban, cada card de lançamento exibe: nome, artista, tipo, data-alvo e % de conclusão do checklist de assets
- **Checklist de assets** por lançamento: áudio master (WAV/FLAC URL), capa do álbum (3000×3000 URL), vídeo clipe (URL YouTube), letra (texto ou URL), ficha técnica (texto), press release (texto/URL), EPK (URL) — obrigatórios variam por tipo
- Modal de **View do Lançamento** ganha aba "Assets" com checklist visual (✓/✗ por item) e aba "Cronograma" com datas-chave (gravação, mix/master, entrega à distribuidora, publicação)
- **Formulário de Lançamento** expandido com: campos de assets (URLs), datas de cronograma, campo ISRC global (para singles), campo UPC, notas internas
- KPIs na página: total de lançamentos, quantos têm assets incompletos (checklist < 100%), próximos 30 dias, publicados este mês
- Filtro "Assets incompletos" na listagem

## Out of scope
- Upload real de arquivos de áudio/vídeo (usar URLs por enquanto)
- Integração com distribuidoras (envio automático)
- Aprovação/workflow digital com assinaturas

## Steps
1. **Expandir modelo de dados** — Adicionar campos no mockData e tipos: `assets` (objeto com campos de URL por tipo), `cronograma` (datas: gravacao, mix_master, entrega_distribuidora), `isrc_global`, `upc`, `notas_internas`
2. **Atualizar formulário de Lançamento** — Adicionar seções "Assets" (URLs para cada tipo de material) e "Cronograma" (date pickers para cada etapa), ISRC/UPC
3. **Aba Assets no modal de visualização** — Checklist visual dos assets com status ✓/✗, links para abrir cada material, % de completude calculada dinamicamente
4. **Aba Cronograma no modal** — Timeline vertical com as datas-chave e indicação de atrasos (data passada sem conclusão)
5. **View Kanban** — Implementar toggle lista/kanban na página; columns mapeadas por status; cards com % de assets; drag entre colunas atualiza status no localStorage
6. **KPIs e filtros** — Adicionar MetricCards para assets incompletos e próximos lançamentos; filtro "incompleto" na barra de filtros

## Relevant files
- `client/src/modules/releases/pages/Lancamentos.tsx`
- `client/src/modules/releases/components/LancamentoFormModal.tsx`
- `client/src/modules/releases/components/LancamentoViewModal.tsx`
- `client/src/modules/releases/hooks/useLancamentos.ts`
- `client/src/shared/data/mockData.ts`
