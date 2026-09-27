# V5 — Correções de Backend e Infraestrutura

## What & Why
Corrigir o HrService (bug crítico de criptografia onde o frontend tentava enviar campos
já criptografados — impossível pois a chave fica só no servidor), adicionar paginação
nos três serviços que não têm, gerar e aplicar a migration das 6 novas tabelas que
existem no schema mas não existem no banco, limpar PENDING_TABLES no api-client,
adicionar FeatureGate na Agenda, e criar os serviços YouTube e Deezer no backend.

## Done looks like
- HR: criar/editar funcionário aceita `email`, `telefone`, `cpf` em texto claro; o servidor
  criptografa antes de persistir; ao ler, retorna decriptografado (sem expor _encrypted)
- artist-goals, content-detections, ecad-reports listam com `{ data, meta: { total, offset, limit } }`
- Migration gerada e aplicada: 6 novas tabelas existem no banco Neon
- api-client.ts: `PENDING_TABLES = {}` vazio; as 4 entradas movidas para `TABLE_ENDPOINT`
- Agenda.tsx envolvida com `<FeatureGate feature="moduleEvents">`
- Endpoints `/integrations/youtube/*` e `/integrations/deezer/*` respondem no backend
- `tsc --noEmit` da API: 0 erros após todas as mudanças

## Out of scope
- Novos serviços de integração (SoundCloud, Apple Music, Instagram, TikTok, Google Ads,
  Abramus) — isso é a próxima task
- Migração dos hooks frontend — outra task
- Testes automatizados

## Steps
1. **Fix HrService — DTOs** — Substituir `CreateEmployeeDto` e `UpdateEmployeeDto`:
   campos `email_encrypted`, `telefone_encrypted`, `cpf_encrypted` viram `email`,
   `telefone`, `cpf` (texto claro). O campo `cpf_encrypted` no DTO era impossível de
   preencher pelo frontend pois ele não tem acesso à chave de criptografia.
2. **Fix HrService — injetar EncryptionService** — Adicionar `private readonly enc: EncryptionService`
   ao construtor do HrService (EncryptionService é `@Global()` via CoreModule, não precisa
   importar o módulo). Criar `mapEmployee()` que decripta antes de retornar. No `create` e
   `update`, chamar `enc.encryptNullable()` nos campos sensíveis.
3. **Fix HrService — paginação** — Adicionar `count`, `offset`, `limit` ao `listEmployees`
   e retornar `{ data, meta }`. Atualizar o controller para aceitar query params.
4. **Paginação em artist-goals** — Substituir `async list(tenantId)` por versão com filtros
   `artista_id`, `status`, `offset`, `limit`, retornando `{ data, meta }`. Adicionar `count`
   ao import drizzle-orm. Atualizar controller.
5. **Paginação em content-detections** — Mesma operação: filtros `status`, `plataforma`,
   `offset`, `limit`. Atualizar controller.
6. **Paginação em ecad-reports** — Filtros `periodo`, `status`, `offset`, `limit`. Atualizar controller.
7. **Gerar e aplicar migration** — Rodar `npx drizzle-kit generate` e depois
   `npx drizzle-kit push` para criar as 6 tabelas (`artist_goals`, `content_detections`,
   `ecad_reports`, `employees`, `payroll_entries`, `leave_requests`) no banco Neon.
8. **Limpar PENDING_TABLES no api-client** — Mover as 4 entradas para TABLE_ENDPOINT
   com os paths corretos (`/artist-goals`, `/ecad-reports`, `/content-detections`,
   `/hr/employees`). Setar `PENDING_TABLES = {}`.
9. **FeatureGate na Agenda** — Envolver o retorno de `Agenda.tsx` com
   `<FeatureGate feature="moduleEvents" featureName="Agenda & Eventos">`.
10. **Criar YouTubeService** — Criar `apps/api/src/modules/integrations/youtube/youtube.service.ts`
    com `getChannelStats`, `getVideoStats`, `searchVideos` usando YOUTUBE_API_KEY do env.
    Adicionar `YOUTUBE_API_KEY: z.string().optional()` ao env.schema.ts.
11. **Criar DeezerService** — Criar `apps/api/src/modules/integrations/deezer/deezer.service.ts`
    com `getArtistStats`, `searchArtist`, `getTopTracks`, `getAlbum` usando API pública.
12. **Registrar YouTube e Deezer** — Adicionar ambos aos `providers` e `exports` do
    `IntegrationsModule`. Adicionar ao constructor do `IntegrationsController` e criar
    os endpoints: `GET youtube/status`, `GET youtube/channel/:id`, `GET youtube/video/:id`,
    `GET youtube/search`, `GET deezer/artist/:id`, `GET deezer/artist/:id/top`,
    `GET deezer/album/:id`, `GET deezer/search`. Adicionar `Query` ao import se faltar.
13. **TypeCheck final** — Rodar `cd apps/api && npx tsc --noEmit` e corrigir qualquer
    erro de TypeScript.

## Relevant files
- `apps/api/src/modules/hr/hr.service.ts`
- `apps/api/src/modules/hr/dto/create-employee.dto.ts`
- `apps/api/src/modules/hr/dto/update-employee.dto.ts`
- `apps/api/src/modules/hr/hr.controller.ts`
- `apps/api/src/modules/artist-goals/artist-goals.service.ts`
- `apps/api/src/modules/artist-goals/artist-goals.controller.ts`
- `apps/api/src/modules/content-detections/content-detections.service.ts`
- `apps/api/src/modules/content-detections/content-detections.controller.ts`
- `apps/api/src/modules/ecad-reports/ecad-reports.service.ts`
- `apps/api/src/modules/ecad-reports/ecad-reports.controller.ts`
- `apps/api/src/core/security/encryption.service.ts`
- `apps/api/src/core/config/env.schema.ts`
- `apps/api/src/modules/integrations/integrations.module.ts`
- `apps/api/src/modules/integrations/integrations.controller.ts`
- `client/src/shared/lib/api-client.ts`
- `client/src/modules/events/pages/Agenda.tsx`
- `client/src/shared/components/FeatureGate.tsx`
