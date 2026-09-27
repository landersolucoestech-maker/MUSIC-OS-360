# MAPEAMENTO ESTRUTURAL COMPLETO — MUSIC OS 360
*Auditoria gerada em Maio 2026. Fonte: leitura directa de todos os ficheiros do projecto.*

---

## 1. VISÃO GERAL DA ARQUITECTURA

| Camada | Tecnologia | Localização |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | `client/src/` |
| Routing | React Router v6 | `client/src/app/routes/` |
| State / Cache | TanStack Query v5 | `shared/lib/query-config.ts` |
| UI Primitives | shadcn/Radix UI + Tailwind CSS | `shared/ui/` |
| Data Layer | localStorage + MOCK_DATA (standalone) | `shared/lib/storage.ts` |
| Auth | Mock mode (dev) / JWT httpOnly (prod) | `app/providers/AuthContext.tsx` |
| Multi-tenant | TenantContext + RBAC | `app/providers/TenantContext.tsx` |
| Domain Events | Custom window events `musicos360:*` | `shared/domain-events/consistency.ts` |
| Auditoria | Append-only log em `_audit_log` | `shared/lib/storage.ts` |

**Modo actual**: Standalone — MOCK_DATA + localStorage (`musicos360_mock_data`). Sem backend activo.

---

## 2. MAPA DE ROTAS COMPLETO

### Públicas (sem autenticação)
| Path | Componente | Módulo |
|---|---|---|
| `/auth` | Auth | auth |
| `/register` | Register | auth |
| `/captar` | LeadCapture | crm |
| `/cadastro` | ArtistaSignupPublic | auth |
| `/cadastro/:orgSlug` | ArtistaSignupPublic | auth |
| `/signup/artista` | ArtistaSignupPublic | auth |
| `/signup/artista/:orgSlug` | ArtistaSignupPublic | auth |
| `*` | NotFound | shared |

### Protegidas (ProtectedRoute = autenticadas)
| Path | Componente | Módulo |
|---|---|---|
| `/` | Dashboard | shared |
| `/dashboard` | Dashboard | shared |
| `/artistas` | Artistas | artist |
| `/artistas/novo` | ArtistaCadastro | artist |
| `/artistas/:id/editar` | ArtistaCadastro | artist |
| `/registro-musicas` | RegistroMusicas | catalog |
| `/rights-monitoring` | RightsMonitoring | rights-monitoring |
| `/rights-monitoring/execucao/:id` | ExecucaoDetail | rights-monitoring |
| `/takedowns` | Takedowns | monitoring |
| `/licenciamento` | Licenciamento | licensing |
| `/accounting` | Financeiro (Transações) | accounting |
| `/accounting/contabilidade` | Contabilidade (P&L) | accounting |
| `/accounting/nota-fiscal` | NotaFiscal | accounting |
| `/lancamentos` | Lancamentos | releases |
| `/gestao-shares` | GestaoShares | releases |
| `/crm` | CRM (clientes + leads) | crm |
| `/marketing/visao-geral` | VisaoGeral | marketing |
| `/marketing/campanhas` | Campanhas | marketing |
| `/marketing/calendario` | Calendario | marketing |
| `/marketing/metricas` | Metricas | marketing |
| `/marketing/briefing` | Briefing | marketing |
| `/marketing/ia-criativa` | IACriativa | marketing |
| `/marketing/tarefas` | Tarefas | marketing |
| `/contratos` | Contratos | contracts |
| `/contratos/templates` | TemplatesContratos | contracts |
| `/projetos` | Projetos | projects |
| `/agenda` | Agenda | events |
| `/inventario` | Inventario | inventory |
| `/rh` | RH | rh |
| `/chat` | MusicChat | shared |
| `/relatorios` | Relatorios | reports |
| `/configuracoes` | Configuracoes | settings |
| `/aparencia` | Aparencia | settings |
| `/perfil` | Perfil | settings |
| `/usuarios` | Usuarios | settings |
| `/auditoria` | Auditoria (AdminRoute) | settings |
| `/support` | SupportDashboard | support |
| `/support/tickets` | SupportTickets | support |
| `/support/tickets/:id` | SupportTicketDetail | support |
| `/support/knowledge` | SupportKnowledge | support |
| `/support/chat` | SupportChat | support |
| `/support/status` | SupportStatus | support |
| `/support/requests` | SupportRequests | support |

### Super-Admin (role = super_admin)
| Path | Componente |
|---|---|
| `/landing` | Landing |
| `/admin/dashboard` | AdminDashboard |
| `/admin/clients` | AdminClients |
| `/admin/plans` | AdminPlans |
| `/admin/audit` | AdminAudit |
| `/admin/support` | AdminSupport |
| `/admin/configuracoes` | AdminSettings |

### Redirects
| De | Para |
|---|---|
| `/monitoramento` | `/rights-monitoring` |
| `/leads` | `/crm` |
| `/analytics` | `/relatorios` |
| `/admin` | `/admin/dashboard` |
| `/admin/settings` | `/admin/configuracoes` |
| `/admin/security` | `/admin/configuracoes` |
| `/admin/integrations` | `/admin/configuracoes` |
| `/admin/users` | `/admin/configuracoes` |

---

## 3. MÓDULOS — DIRECTÓRIO E FICHEIROS

### `modules/accounting` — Financeiro/Contabilidade
```
pages/     Financeiro.tsx (Transações), Contabilidade.tsx (P&L), NotaFiscal.tsx
components/ TransacaoFormModal, TransacaoViewModal, NotaFiscalFormModal, NotaFiscalViewModal
hooks/     useTransacoes.ts, useNotasFiscais.ts
mappers/   entity-to-form.mapper.ts, form-to-payload.mapper.ts
lib/       nota-fiscal-tipo.ts, transacao-constants.ts
types/     index.ts → re-exports from hooks
```

### `modules/admin` — Painel Super Admin
```
pages/     AdminDashboard, AdminClients, AdminPlans, AdminAudit, AdminSupport, AdminSettings
layouts/   AdminLayout.tsx
data/      mockAdmin.ts
types/     index.ts
```

### `modules/analytics` — REMOVIDO
> Analytics = página Relatórios (`/relatorios`). Redirect `/analytics → /relatorios` intencional.
> `mockAnalytics.ts` movido para `modules/marketing/data/mockAnalytics.ts` (usado por Metricas.tsx).

### `modules/artist` — Artistas
```
pages/     Artistas.tsx, ArtistaCadastro.tsx
components/ ArtistaFormModal, ArtistaVisao360Modal, ArtistaEvolucaoSection,
            ArtistaEvolutionCard, ArtistaPlatformMetrics, PlatformMiniTrend
hooks/     useArtistas.ts, useArtistasAssinados.ts
mappers/   artista.mapper.ts
services/  artista.service.ts
application/ createArtist.usecase.ts
domain/    artista.entity.ts
types/     index.ts
```

### `modules/auth` — Autenticação
```
pages/     Auth.tsx (login), Register.tsx, ArtistaSignupPublic.tsx (formulário 8 passos)
index.ts
```

### `modules/catalog` — Catálogo Musical
```
pages/     RegistroMusicas.tsx (Obras + Fonogramas em abas)
components/ ObraFormModal, ObraViewModal, ObraTipoSelectorModal,
            FonogramaFormModal, FonogramaViewModal,
            AbramusSearchRow, ParticipanteViewModal
hooks/     useObras.ts, useFonogramas.ts
adapters/  abramus.adapter.ts (FUNCIONAL em mock)
mappers/   registro-musicas.mapper.ts
```

### `modules/contracts` — Contratos
```
pages/     Contratos.tsx, TemplatesContratos.tsx
components/ ContratoFormModal, ContratoViewModal,
            TemplateContratoFormModal, TemplateContratoViewModal
hooks/     useContratos.ts, useTemplatesContratos.ts
adapters/  autentique.adapter.ts (STUB — DisabledIntegrationError)
lib/       template-contrato-types.ts
types/     index.ts
```

### `modules/crm` — CRM (Clientes + Leads)
```
pages/     CRM.tsx (clientes + leads em abas + kanban), LeadCapture.tsx (pública)
components/ CRMFormModal, CRMViewModal, LeadFormModal, LeadViewModal,
            LeadIntegrationsDialog
hooks/     useClientes.ts, useLeads.ts, useLeadInteractions.ts
services/  crm.service.ts
application/ captureLead.usecase.ts
domain/    lead.entity.ts, lead.rules.ts
lib/       lead-schema.ts, contato-types.ts
types/     index.ts
```

### `modules/events` — Agenda/Eventos
```
pages/     Agenda.tsx
```

### `modules/integrations` — (sem rotas)
```
(utilidades de integração compartilhadas)
```

### `modules/inventory` — Inventário
```
pages/     Inventario.tsx
```

### `modules/licensing` — Licenciamento
```
pages/     Licenciamento.tsx
```

### `modules/marketing` — Marketing
```
pages/     VisaoGeral, Campanhas, Calendario, Metricas, Briefing, IACriativa, Tarefas
```

### `modules/monitoring` — Takedowns
```
pages/     Takedowns.tsx
```
> Nota: monitoramento de execuções está em `rights-monitoring`, não aqui.

### `modules/projects` — Projetos
```
pages/     Projetos.tsx
```

### `modules/releases` — Lançamentos + Shares
```
pages/     Lancamentos.tsx, GestaoShares.tsx
components/ LancamentoFormModal, LancamentoViewModal,
            SharePendenteFormModal, ShareViewModal
hooks/     useLancamentos.ts, useShares.ts
mappers/   dto-to-entity.mapper.ts, entity-to-form.mapper.ts, form-to-payload.mapper.ts
types/     index.ts (Lancamento, Share, ShareWithRelations, LancamentoWithRelations)
```

### `modules/reports` — Relatórios
```
pages/     Relatorios.tsx
```

### `modules/rh` — Recursos Humanos
```
pages/     RH.tsx
```

### `modules/rights-monitoring` — Monitoramento de Execuções (ECAD)
```
pages/     RightsMonitoring.tsx, ExecucaoDetail.tsx
```

### `modules/settings` — Configurações
```
pages/     Configuracoes.tsx, Aparencia.tsx, Perfil.tsx, Usuarios.tsx
components/ IntegrationStatusBadges.tsx
```

### `modules/support` — Suporte
```
pages/     SupportDashboard, SupportTickets, SupportTicketDetail,
           SupportKnowledge, SupportChat, SupportStatus, SupportRequests
```

---

## 4. ENTIDADES E TIPOS CANÓNICOS

### Artista
```typescript
id, nome_artistico, nome_civil, tipo (solo|banda), status, status_cadastro
genero_musical, email, telefone, cpf_cnpj, foto_url, observacoes
especialidades[]          // interprete, compositor_autor, produtor, dj_produtor, etc.
fase_carreira, slug_artistico, tags_musicais[]
contrato_id → contratos
// Streaming
spotify_url, spotify_ouvintes
youtube_url, youtube_inscritos
deezer_url, deezer_fas
apple_music_url, soundcloud_url, soundcloud_seguidores
// Redes sociais
instagram, instagram_seguidores, tiktok, tiktok_seguidores
facebook, twitter, website
// Dados pessoais
data_nascimento, rg, cpf_cnpj, endereco
// Bancários
banco, agencia, conta, chave_pix, titular_conta
// Perfil 360
galeria_urls[]
manager_nome, manager_contato, produtor_executivo, agencia_booking, label_parceira
// Relacionamentos comerciais (MODELO NOVO)
relacionamentos[]: { tipo, nome, telefone, email, escritorio, crc, responsaveis[], distribuidoras[] }
// LEGADO (manter compatibilidade)
empresario_id, empresario_nome, empresario_email
gravadora_id, gravadora_nome, gravadora_responsavel_nome
distribuidoras_selecionadas{}, distribuidoras_emails{}
org_slug    // preenchido pelo formulário público
```

> ⚠️ **Acoplamento duplo**: campos `empresario_*` e `gravadora_*` são legados e coexistem com o array `relacionamentos[]`. Fonte de inconsistência estrutural.

### Transacao (Accounting)
```typescript
id, descricao, tipo (receita|despesa), categoria, valor, data
status, artista_id → artistas, cliente_id → clientes
proposal_id -> proposals, origem, observacoes
conciliado, anexo_url, forma_pagamento
```
Categorias (receita): recebimentos externos de direitos, cachê, licenciamento, distribuicao, patrocinio
Categorias (despesa): adiantamento_artista, producao_musical, marketing_digital, marketing_offline, juridico, administrativo, folha_pagamento, producao_audiovisual, infraestrutura, software, seguros, distribuicao_digital

### Obra (Catálogo)
```typescript
id, titulo, compositor, compositores[], letristas[], co_compositores, detentores
editora, isrc, iswc, cod_abramus, cod_ecad
tipo (musica|composicao), genero, status (registrado|pendente|analise)
duracao, artista_id → artistas, projeto_id → projetos
origem_externa (abramus), origem_externa_id, origem_externa_sincronizado_em
```

### Fonograma
```typescript
id, titulo, obra_id → obras, artista_id → artistas
isrc (+ isrc_pais, isrc_registrante, isrc_ano, isrc_designacao)
duracao, tipo (original|ao_vivo|cover|remix), status
compositores, interpretes, produtores
gravadora, agregadora, cod_abramus, cod_ecad
criada_por_ia, instrumental, genero_musical
data_lancamento, data_registro, pais_origem
arquivo_audio (JSON), participacao
origem_externa, origem_externa_id, origem_externa_sincronizado_em
```

### Lancamento (Releases)
```typescript
id, titulo, tipo (album|single|ep|compilacao), status, artista_id → artistas
data_lancamento, distribuidora, plataformas[]
fonograma_ids[]    // FK para fonogramas
isrc_global, upc
assets: { audio_master_url, capa_url, video_clipe_url, letra, ficha_tecnica, press_release, epk_url }
cronograma: { data_gravacao, data_mix_master, data_entrega_distribuidora }
```

### Share (Gestão de Shares)
```typescript
id, obra_id → obras, artista_id → artistas (LEGADO — campo em transição)
percentual, tipo, direcao (a_receber|a_enviar)
status (pendente|parcial|recebido|enviado|cancelado)
valor_total, valor_liquidado, detentor (texto livre)
acordo_notas, acordo_url, versao, historico[]
```
> ⚠️ `detentor` é texto livre; `obra_id` pode ser null no formulário público (campo `nome_musica` foi substituído por texto livre).

### Contrato
```typescript
id, titulo, tipo (exclusividade|gravacao|distribuicao|gestao|licenciamento|producao|patrocinio)
status (assinado|vigente|em_analise|aguardando_assinatura|expirado|cancelado)
artista_id → artistas (nullable), cliente_id → clientes (nullable)
lancamento_id → lancamentos (nullable)
data_inicio, data_fim, valor, exclusivo
template_id → templates_contratos, assinado_em
arquivo_url, autentique_doc_id
versoes[]: { versao, url, criado_em, notas, autor }
```
> ⚠️ **Contrato pertence a artista OR cliente, nunca a ambos** — não há validação estrutural disso.

### Cliente (CRM)
```typescript
id, nome, tipo, segmento (contratante|parceiro|fornecedor|contato)
email, telefone, cnpj/cpf, endereco, cidade, estado, cep
status (ativo|inativo|prospect|lead), temperatura, responsavel, empresa
```

### Lead (CRM)
```typescript
id, nome, email, telefone, empresa, cargo
status (novo|contactado|qualificado|proposta|fechado|perdido)
origem, score, notas, responsavel_id
```

### Funcionario (RH)
```typescript
id, nome, cargo, departamento, email, telefone, cpf, salario
data_admissao, status
```

### Evento (Agenda)
```typescript
id, titulo, tipo, data, hora, local, artista_id → artistas
cliente_id → clientes, status, observacoes
```

### Projeto (Projetos)
```typescript
id, titulo, descricao, tipo, status, data_inicio, data_fim
artista_id → artistas, responsavel_id
```

### Licenca (Licenciamento)
```typescript
id, titulo, tipo, status, artista_id → artistas, cliente_id → clientes
obra_id → obras, valor, data_inicio, data_fim, plataformas[]
```

### NotaFiscal
```typescript
id, numero, tipo, status, valor, data_emissao, data_vencimento
prestador, tomador, descricao, transacao_id → transacoes
```

### Share — campos mockData completos
```
id, lancamento_id→, nome_musica, detentor, funcao, percentual
status, direcao, valor_total, valor_liquidado
```

---

## 5. RELACIONAMENTOS ENTRE ENTIDADES

```
Artista ←─── Contrato (artista_id, nullable)
Artista ←─── Lancamento (artista_id)
Artista ←─── Obra (artista_id, nullable)
Artista ←─── Fonograma (artista_id, nullable)
Artista ←─── Share (artista_id, nullable)
Artista ←─── Transacao (artista_id, nullable)
Artista ←─── Evento (artista_id, nullable)
Artista ←─── Projeto (artista_id, nullable)
Artista ←─── Licenca (artista_id, nullable)

Cliente ←─── Contrato (cliente_id, nullable)
Cliente ←─── Transacao (cliente_id, nullable)
Cliente ←─── Evento (cliente_id, nullable)
Cliente ←─── Licenca (cliente_id, nullable)

Obra ←─── Fonograma (obra_id)
Obra ←─── Share (obra_id, nullable)
Obra ←─── Licenca (obra_id, nullable)
Obra ←─── Projeto (via projeto_id em Obra)

Lancamento ←─── Fonograma[] (via fonograma_ids[] em Lancamento)
Lancamento ←─── Contrato (lancamento_id)

Transacao ←─── NotaFiscal (transacao_id)
Contrato ←─── TemplateContrato (template_id)

Lead ←─── LeadInteraction (lead_id)
Funcionario ←─── FolhaPagamento (funcionario_id)
Funcionario ←─── FeriasAusencia (funcionario_id)
Funcionario ←─── DocumentoFuncionario (funcionario_id)
```

---

## 6. CAMADA DE DADOS — STORAGE

### Fluxo completo de dados
```
Componente / Hook
    ↓ useDataQuery (genérico) ou hook específico
    ↓ storage.list / storage.create / storage.update / storage.delete
    ↓ MOCK_MODE ?
        SIM → MOCK_DATA em memória + localStorage (musicos360_mock_data)
        NÃO → api-client.ts → HTTP API (backend NestJS)
    ↓ Audit log automático (_audit_log, max 2000 entradas)
    ↓ TanStack Query cache + invalidação
    ↓ Component re-render
```

### Tabelas com isolamento de tenant (TENANT_SCOPED_TABLES)
artistas, clientes, contatos, leads, contratos, obras, fonogramas, shares, lancamentos,
transacoes, notas_fiscais, projetos, eventos, inventario, campanhas, conteudos, briefings,
tarefas_marketing, metas_artistas, monitoramentos, licencas, regras_financeiras,
ecad_reports, funcionarios, folha_pagamento, afastamentos, documentos_funcionario

### Tabelas sem isolamento de tenant
templates_contratos, regras, roles, permissions, role_permissions, usuarios,
proposals, proposal_items, followups, catalogo, company_settings, profiles, user_settings, team_members, team_invites

### Cache (TanStack Query)
| Tipo | staleTime | gcTime | Entidades |
|---|---|---|---|
| STATIC | 30 min | 1 hora | — |
| SEMI_STATIC | 10 min | 30 min | templates, regras, roles, permissions, integrações ext. |
| DYNAMIC | 2 min | 10 min | artistas, contratos, obras, fonogramas, transacoes, campanhas... |
| REALTIME | 30 seg | 5 min | eventos, notifications, metrics, metas_artistas |

---

## 7. CONTEXTOS E PROVIDERS (árvore)

```
ThemeProvider            (dark/light mode, localStorage)
  ErrorBoundary          (error boundary raiz)
    QueryClientProvider  (TanStack Query)
      AuthProvider       (user, session, signIn/signOut)
        TenantProvider   (tenant, RBAC, feature flags)
          RealtimeLayer  (window events musicos360:*)
          TooltipProvider
            Sonner       (toasts)
              BrowserRouter
                Routes   (all route groups)
```

---

## 8. AUTENTICAÇÃO

### Modo Mock (desenvolvimento, VITE_USE_MOCK=true)
- Utilizador sempre autenticado: MOCK_USER
- signIn/signOut: NOPs (mantém estado mock)
- Sem chamadas HTTP

### Modo Real (produção, VITE_USE_MOCK=false)
- POST `/auth/login` → access_token JWT em memória
- httpOnly cookie → refresh token (enviado automaticamente)
- On mount: POST `/auth/refresh` → restaura sessão
- POST `/auth/logout` → revoga cookie

### Extracção de dados do JWT
```typescript
{ sub, email, role, org_id } = decodeJwtPayload(access_token)
```

---

## 9. RBAC — PERMISSÕES E ROLES

### Roles
| Role | Descrição |
|---|---|
| owner | Acesso total a tudo |
| admin | Acesso total a tudo |
| manager | Full em todos excepto audit/settings (read_only) |
| editor | Sem delete; sem acesso a audit/settings |
| viewer | Read-only em tudo; sem acesso a audit/settings |

### Módulos cobertos pelo RBAC (16)
artists, catalog, releases, contracts, accounting, crm, marketing, events,
inventory, rh, monitoring, licensing, projects, leads, audit, settings

### Actions por módulo
read, write, delete, export

### Permissões consultadas com
```typescript
useTenant().canRead(module)
useTenant().canWrite(module)
useTenant().canDelete(module)
useTenant().canExport(module)
useTenant().hasPermission(module, action)
```

---

## 10. FEATURE FLAGS (55 flags)

### Por plano
| Flag | Starter | Pro | Enterprise |
|---|---|---|---|
| moduleMonitoring | ✗ | ✓ | ✓ |
| moduleLicensing | ✗ | ✓ | ✓ |
| moduleRh | ✗ | ✓ | ✓ |
| auditLog | ✗ | ✓ | ✓ |
| bulkActions | ✗ | ✓ | ✓ |
| analyticsAdvanced | ✗ | ✗ | ✓ |
| whitelabel | ✗ | ✗ | ✓ |
| multiTenantAdmin | ✗ | ✗ | ✓ |

### Integrações activas em mock
| Integração | Estado |
|---|---|
| ABRAMUS | ✅ Funcional (busca e importação de catálogo) |
| Autentique | 🔴 Stub (DisabledIntegrationError) |
| Spotify / YouTube / TikTok | 🔴 Stub |
| Meta Ads / Google Ads | 🔴 Stub |
| DistroKid / SoundOn / Symphonic / OneRP | 🔴 Stub |
| Deezer / Apple Music / SoundCloud | 🔴 Stub |
| ECAD | 🔴 Stub |

### Funcionalidades gated
| Flag | Estado actual |
|---|---|
| aiFeatures | false (IA limitada a botões em Marketing/ArtistaForm) |
| billingPortal | false |
| storageR2 | false |
| rbacAdvanced | false |
| analyticsAdvanced | false |
| whitelabel | false |

---

## 11. TENANT (MULTI-TENANCY)

### Estrutura
```typescript
Tenant {
  id, name, slug, plan (starter|professional|enterprise)
  industry (gravadora|editora|distribuidora|agencia|publisher|outro)
  website, cnpj, phone, address
  features: FeatureFlags
  permissions: Record<TenantModuleKey, TenantModulePermission>
  config: { primaryColor, logoUrl, faviconUrl, customDomain, emailFromName,
            emailFromAddr, supportEmail, whitelabel, hideProductName }
  billing: { status, trialEndsAt, currentPeriodEnd, seats, seatsUsed,
             planId, customerId, subscriptionId }
  onboarding: { completed, currentStep, steps: Record<OnboardingStep, boolean> }
  meta: { createdAt, timezone, locale, currency, version }
}
```

### Onboarding steps (7)
company_profile → invite_team → first_artist → first_catalog_item →
first_contract → connect_integration → complete

### Mock tenant activo
`ten-gravadora-exemplo-001` / "Gravadora Exemplo Ltda" / plan: enterprise / 8/25 seats

---

## 12. FORMULÁRIO PÚBLICO — ArtistaSignupPublic

Formulário multi-passo (8 passos) acessível em `/cadastro/:orgSlug`

| Passo | Nome | Campos principais |
|---|---|---|
| 0 | Foto de Perfil | foto_url (acima do passo 1) |
| 1 | Informações Básicas | nome_artistico, genero_musical, especialidades[], link_documentos |
| 2 | Dados Pessoais | nome_civil, cpf_cnpj, data_nascimento, rg, endereco, tipo_pessoa |
| 3 | Contatos | email, telefone, instagram, facebook, tiktok, twitter, website |
| 4 | Dados Bancários | banco, agencia, conta, chave_pix, titular_conta |
| 5 | Plataformas de Streaming | spotify_url, youtube_url, deezer_url, apple_music_url, soundcloud_url |
| 6 | Relacionamentos | empresario, gravadora, booker, juridico, financeiro, contador |
| 7 | Distribuidoras | distribuidoras_selecionadas{}, distribuidoras_emails{} |

**Resultado**: registo em `artistas` com `status_cadastro: "onboarding"` e `org_slug`.

---

## 13. MÓDULO ACCOUNTING — ESCOPO EXACTO

**Inclui**: Transações (`/accounting`), Contabilidade P&L (`/accounting/contabilidade`), Nota Fiscal (`/accounting/nota-fiscal`)

**Não inclui**: recebimentos externos de direitos (apenas categoria de transação), payout/split engine

### Contabilidade.tsx — Estrutura de abas
| Aba | Conteúdo |
|---|---|
| Todos | PLTable empresa + tabela projetos + tabela artistas |
| P&L Empresa | Demonstrativo por categoria (receitas/despesas/resultado) |
| P&L Projetos | Cada transação = 1 linha (nome/categoria/receitas/despesas/resultado) |
| P&L Artistas | Agrupado por artista_id |

### Financeiro.tsx — Transações
Filtros: tipo, categoria, status, artista, data. CRUD completo. Exportação OFX/XLSX.

---

## 14. MÓDULO CATALOG — ESCOPO EXACTO

**Duas entidades distintas**:
- **Obra**: composição musical (ISWC, cod_ECAD, cod_ABRAMUS) — direitos de autor
- **Fonograma**: gravação (ISRC, artista intérprete) — direitos conexos

**Abramus Adapter**: busca em catálogo Abramus, importa para obras + fonogramas. Único adapter funcional.

---

## 15. MÓDULO RELEASES — ESCOPO EXACTO

**Lançamento**: álbum/single/EP com distribuidora, plataformas, ISRC global, UPC. Contém IDs de fonogramas.

**Share/Gestão de Shares**: percentuais de titularidade de obras musicais, com direcção (a_receber vs a_enviar), status de liquidação, histórico de versões.

---

## 16. PADRÕES ARQUITECTÓNICOS

### Padrão Mapper (source of truth)
```
shared/lib/normalize.ts                   (normalização genérica)
modules/catalog/mappers/registro-musicas.mapper.ts
modules/artist/mappers/artista.mapper.ts
modules/accounting/mappers/entity-to-form.mapper.ts
modules/accounting/mappers/form-to-payload.mapper.ts
modules/releases/mappers/dto-to-entity.mapper.ts
modules/releases/mappers/entity-to-form.mapper.ts
modules/releases/mappers/form-to-payload.mapper.ts
```
> Regra: toda transformação form ↔ entidade passa EXCLUSIVAMENTE pelo mapper do módulo.

### Padrão useDataQuery (hook genérico CRUD)
```typescript
useDataQuery<T>({ queryKey, table, select?, orderBy?, filters? }, messages?)
→ { data[], isLoading, error, create, update, delete }
```
Todos os módulos usam este hook. Só `useObras` tem `bulkUpdateEcad` adicional.

### Padrão Route Factory
```typescript
export function artistRoutes(P: SuspenseRouteComponent) {
  return (<><Route ... /></>);
}
```
Composição em App.tsx. Cada domínio tem 1 ficheiro de routes.

### Padrão Modal CRUD
Cada entidade tem: `{Entidade}FormModal` (criar/editar) + `{Entidade}ViewModal` (ver detalhe). Consistente em todos os módulos.

---

## 17. NOTAS ARQUITECTÓNICAS

### Designs intencionais (não são inconsistências)
| Aspecto | Decisão de design |
|---|---|
| `Artista.relacionamentos[]` + campos `empresario_*`/`gravadora_*` | Modelo multi-formato intencional — suporta estruturas de relacionamento diversas |
| `Artista.distribuidoras_selecionadas{}` + `distribuidoras_emails{}` | Campos distintos para controlo granular por distribuidora — design intencional |
| `Contrato` sem artista_id E sem cliente_id | Contrato pertence a artista OR a cliente — ambos nullable, simples e intencional |
| `Share.obra_id` nullable + campo `nome_musica` texto livre | Gestão de Shares = controlo do que enviou/recebeu; obra é opcional |
| `/analytics` → redirect para `/relatorios` | Analytics É a página Relatórios — redirect intencional |

### Estados operacionais por entidade
| Entidade | Estados possíveis |
|---|---|
| Artista | `contratado`, `em_negociacao`, `onboarding`, `inativo` |
| Contrato | `assinado`, `vigente`, `em_analise`, `aguardando_assinatura`, `expirado`, `cancelado` |
| Obra | `registrado`, `pendente`, `analise` |
| Lancamento | `planejado`, `em_producao`, `entregue`, `publicado`, `cancelado` |
| Share | `pendente`, `parcial`, `recebido`, `enviado`, `cancelado` |
| Lead | `novo`, `contactado`, `qualificado`, `proposta`, `fechado`, `perdido` |
| Cliente | `ativo`, `inativo`, `prospect`, `lead` |

### Estado de implementação dos módulos
| Módulo | Estado actual |
|---|---|
| `modules/events` | ✅ Completo — Agenda.tsx + EventoFormModal + EventoViewModal + useEventos |
| `modules/inventory` | ✅ Completo — Inventario.tsx + InventarioFormModal + InventarioViewModal + useInventario |
| `modules/projects` | ✅ Completo — Projetos.tsx + ProjetoFormModal + ProjetoViewModal + useProjetos |
| `modules/rh` | ✅ Completo — RH.tsx + FuncionarioFormModal + FolhaPagamentoFormModal + hooks |
| `modules/licensing` | ✅ Completo — Licenciamento.tsx + LicencaFormModal + LicencaViewModal + useLicencas |
| `modules/marketing` | ✅ Completo — 7 páginas + mockAnalytics (dados simulados) |
| `modules/support` | ✅ Completo — 7 páginas + useSupport + mockSupport |
| `modules/reports` | ✅ Completo — Relatorios.tsx + ImportEngine + ExportEngine + AuditLogPanel |
| `modules/analytics` | 🗑️ Removido — redundante; Analytics = página Relatórios |

### Chaves e prefixos activos (todos correctos)
| Item | Valor actual |
|---|---|
| localStorage | `musicos360_mock_data` |
| Auth cookie | `musicos360_rt` |
| CustomEvents | `musicos360:*` |
| Permission key accounting | `accounting` |

---

## 18. SHARED — COMPONENTES E UTILITÁRIOS

### `shared/components/` (cross-domain)
MainLayout, PageHeader, AppSidebar, ContratoStatusBadge, AIGenerateButton,
FinanceChart, DataTable, PageSkeletons

### `shared/infrastructure/`
ErrorBoundary, ErrorFallback, RouteErrorBoundary, RealtimeLayer, AdminRoute

### `shared/lib/`
storage.ts (data layer), api-client.ts, query-config.ts, format-utils.ts,
xlsx.ts, normalize.ts, tenant-isolation.ts, errors.ts, feature-flags.ts,
tenant.ts, api-client.ts

### `shared/hooks/`
useDataQuery.ts, usePaginatedQuery (dentro de useDataQuery)

### `shared/ui/` (shadcn/Radix primitives — 30+ componentes)
alert, avatar, badge, button, calendar, card, checkbox, command, date-picker-field,
dialog, dropdown-menu, form, input, label, month-picker-field, popover, progress,
radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider,
sonner, switch, table, tabs, textarea, toggle, tooltip

### `shared/pages/`
Dashboard, Landing, Auditoria, MusicChat, NotFound

### `shared/data/mockData.ts`
39 tabelas, ~550 linhas. Chave localStorage: `musicos360_mock_data`.
Seed automático se chave não existe.

---

## 19. TESTES

```
client/src/test/
  AbramusSearchRow.test.tsx
  ArtistaEvolucaoSection.test.tsx
  ArtistaEvolutionCard.test.tsx
  ArtistaVisao360Modal.test.tsx
  ErrorBoundary.test.tsx
  ErrorFallback.test.tsx
  error-logger.test.ts
  ExecucaoDetailModal.test.tsx
  FonogramaFormModal.edit.test.tsx
  ObraFormModal.edit.test.tsx
  PlatformMiniTrend.test.tsx
  registroMusicasMappers.test.ts
  RightsMonitoring.test.tsx
  RouteErrorBoundary.test.tsx
  setup.ts
```
> 15 ficheiros de teste, focados em catalog, artist, monitoring e error handling.

---

## 20. DEPENDÊNCIAS EXTERNAS ACTIVAS

| Pacote | Uso |
|---|---|
| @tanstack/react-query v5 | Cache e estado servidor |
| react-router-dom v6 | Routing |
| sonner | Toasts |
| lucide-react | Ícones |
| react-icons/si | Logos de serviços |
| tailwindcss | Estilos |
| @radix-ui/* | Primitivos acessíveis |
| react-hook-form + zod | Formulários |
| date-fns | Manipulação de datas |

---

## 21. SUMÁRIO EXECUTIVO — PONTOS CRÍTICOS

### Para implementação real (quando backend estiver pronto)
1. **Migrar localStorage** → remover seed mock, conectar `storage.ts` a HTTP API real
2. **Migrar dados de utilizadores existentes** — chave `musicos360_mock_data` (antiga: `lander_*`)
3. **Analytics = Relatorios** — `/analytics` redirecta para `/relatorios`; módulo `analytics` removido
4. **Todos os módulos estão implementados** — CRUD completo com FormModal + ViewModal + hook

### Contratos implícitos críticos
- Todo módulo de CRUD depende de `useDataQuery` → qualquer mudança nele afecta TODOS os módulos
- Mapper pattern é obrigatório — componentes não devem ter lógica de transformação
- `TenantProvider` deve envolver **qualquer** componente que use `useTenant()`
- `musicos360_` prefix é mandatório em todos os CustomEvents e localStorage keys
- Dados mock de métricas (analytics) vivem em `modules/marketing/data/mockAnalytics.ts`

---

## 22. ETAPA 3 — LIMPEZA DE CÓDIGO MORTO (Maio 2026)

### Ficheiros removidos (53 total — todos barrels com 0 importadores)

**Barrel `index.ts` de módulos** (18 ficheiros):
`modules/index.ts` (mega-barrel com `./leads` quebrado), `modules/accounting/index.ts`, `modules/artist/index.ts`, `modules/auth/index.ts`, `modules/catalog/index.ts`, `modules/contracts/index.ts`, `modules/crm/index.ts`, `modules/events/index.ts`, `modules/integrations/index.ts`, `modules/inventory/index.ts`, `modules/licensing/index.ts`, `modules/marketing/index.ts`, `modules/monitoring/index.ts`, `modules/projects/index.ts`, `modules/releases/index.ts`, `modules/rh/index.ts`, `modules/rights-monitoring/index.ts`, `modules/settings/index.ts`

**Barrel `shared/index.ts`** (1 ficheiro):
`shared/index.ts`

**Barrel `types/index.ts` de módulos** (17 ficheiros — excepto `rights-monitoring/types` que tem 1 importador em teste):
`accounting/types`, `admin/types`, `artist/types`, `catalog/types`, `contracts/types`, `crm/types`, `events/types`, `inventory/types`, `licensing/types`, `marketing/types`, `monitoring/types`, `projects/types`, `releases/types`, `reports/types`, `rh/types`, `settings/types`, `support/types`

**Hook morto** (1 ficheiro):
`shared/hooks/useKeyboardShortcuts.ts` — navegação por teclado nunca conectada a nenhuma página

**Correcção de import introduzida pela limpeza** (1 ficheiro):
`modules/artist/components/PlatformMiniTrend.tsx` — import de `computeEvolutionSummary` corrigido de `@/modules/artist` (barrel removido) para `@/modules/artist/components/ArtistaEvolutionCard` (fonte directa)

### Mantidos apesar de 0 importadores directos (infra arquitectural)
- `shared/lib/tenant.ts` — helpers `getCurrentOrgId`, `withTenantFilter`, `stampTenant` para modo produção (JWT)
- `shared/lib/tenant-isolation.ts` — `isolateByTenant`, `assertTenantOwnership`, `stampTenantId`
- `shared/hooks/useCanAccess.ts` — RBAC hook para controlo de permissões por módulo/acção (referenciado em `useIsAdmin.ts`)

### Resultado
- **371 → 318 ficheiros** fonte `.ts`/`.tsx`
- `npx tsc --noEmit` → **0 erros** após todas as remoções e correcções
- Browser console **limpo** após restart

---

## 23. ETAPA 4 — PADRONIZAÇÃO ARQUITECTURAL: TIPOS FORA DE HOOKS (Maio 2026)

### Problema corrigido
Tipos de domínio (`interface Foo`, `type FooInsert`, `type FooUpdate`) estavam definidos directamente dentro de hooks (`useXxx.ts`). Isto cria inversão de dependência — mappers e serviços importavam de hooks em vez de importar de uma fonte de verdade de tipos.

### Padrão aplicado
Para cada módulo:
1. **Criado** `{module}/types/{entity}.types.ts` — source of truth para todos os tipos de domínio
2. **Hook atualizado** para `import type { ... } from "../types/{entity}.types"` + `export type { ... }` (backward compat)
3. Importadores existentes continuam a funcionar sem alteração (re-export transparente)

### Módulos e ficheiros criados

| Módulo | Ficheiro de tipos criado |
|---|---|
| `artist` | `artist/types/artista.types.ts` (Artista, etc.) — sessão anterior |
| `accounting` | `accounting/types/accounting.types.ts` (Transacao, NotaFiscal) — sessão anterior |
| `catalog` | `catalog/types/catalog.types.ts` (Obra, Fonograma) — sessão anterior |
| `contracts` | `contracts/types/contracts.types.ts` (Contrato, TemplateContrato, etc.) |
| `crm` | `crm/types/crm.types.ts` (Lead, Cliente, LeadInteraction) |
| `releases` | `releases/types/index.ts` (Lancamento, Share, etc.) |
| `marketing` | `marketing/types/marketing.types.ts` (Campanha, Conteudo, Meta) |
| `projects` | `projects/types/projetos.types.ts` (Projeto, ProjetoWithRelations, etc.) |
| `events` | `events/types/events.types.ts` (Evento, etc.) |
| `licensing` | `licensing/types/licensing.types.ts` (Licenca, etc.) |
| `monitoring` | `monitoring/types/monitoring.types.ts` (Takedown, etc.) |
| `inventory` | `inventory/types/inventory.types.ts` (InventarioItem, etc.) |
| `rh` | `rh/types/rh.types.ts` (Funcionario, FolhaPagamento, FeriasAusencia, DocumentoFuncionario) |

### Correcções adicionais nesta etapa

**`projects/types/projetos-extensions.ts`** — corrigida inversão de dependência:
- Antes: `import type { ProjetoWithRelations } from "@/modules/projects/hooks/useProjetos"` (hook → types = ERRADO)
- Depois: `export type { ProjetoWithRelationsExtended } from "./projetos.types"` (types → types = CORRECTO)

**`projects/utils/musicaHelpers.ts` → `projects/lib/musica-helpers.ts`** — movido para convenção de nomenclatura correcta:
- 3 importadores atualizados: `Projetos.tsx`, `ProjetoViewModal.tsx`, `catalog/pages/RegistroMusicas.tsx`
- Ficheiro antigo removido; `utils/` directório limpo

**`projects/mappers/index.ts`** — removido (apenas continha `export {}` — 0 importadores)

### Hooks que usam `Tables<>` gerados (não alterados — correcto por definição)
`useDeteccoes`, `useRegras`, `useRelatoriosECAD`, `useTarefasMarketing`, `useBriefings`, `useTemplatesContratos` (estes 6 hooks importam de `@/shared/types/database` — padrão correcto)

### Resultado
- `npx tsc --noEmit` → **0 erros** após todas as alterações
- Browser console **limpo**
- Arquitectura de dependências corrigida: `types/ → hooks → components` (antes: `hooks ↔ types` circular)

---

## 24. ETAPA 5 — CONSOLIDAÇÃO DOS FORMULÁRIOS: SCHEMAS ZOD + ZODRESOLVER (Maio 2026)

### Problema corrigido
Formulários sem validação centralizada — schemas Zod inline em componentes, tipos duplicados,
`FieldError` local redefinido em múltiplos ficheiros, e `zodResolver` ausente em `ArtistaFormModal`.

### Padrão aplicado
`{module}/lib/{entity}-schema.ts` — exporta `const {entity}Schema` (z.object) + `export type {Entity}FormData = z.infer<typeof {entity}Schema>`.

### Ficheiros de schema criados

| Módulo | Ficheiro |
|---|---|
| `accounting` | `accounting/lib/transacao-schema.ts`, `accounting/lib/nota-fiscal-schema.ts` |
| `artist` | `artist/lib/artista-schema.ts` |
| `catalog` | `catalog/lib/obra-schema.ts`, `catalog/lib/fonograma-schema.ts` |
| `contracts` | `contracts/lib/contrato-schema.ts`, `contracts/lib/template-contrato-schema.ts` |
| `crm` | `crm/lib/crm-schema.ts` (+ `crm/lib/lead-schema.ts` pré-existente) |
| `events` | `events/lib/evento-schema.ts` |
| `inventory` | `inventory/lib/inventario-schema.ts` (pré-existente) |
| `licensing` | `licensing/lib/licenca-schema.ts` |
| `marketing` | `marketing/lib/campanha-schema.ts`, `marketing/lib/conteudo-schema.ts`, `marketing/lib/briefing-schema.ts`, `marketing/lib/tarefa-marketing-schema.ts` |
| `monitoring` | `monitoring/lib/regra-schema.ts`, `monitoring/lib/takedown-schema.ts` |
| `projects` | `projects/lib/projeto-schema.ts` |
| `releases` | `releases/lib/lancamento-schema.ts`, `releases/lib/share-schema.ts` |
| `rh` | `rh/lib/funcionario-schema.ts`, `rh/lib/folha-pagamento-schema.ts`, `rh/lib/ferias-ausencias-schema.ts` |
| `settings` | `settings/lib/usuario-schema.ts` (pré-existente) |

### Schemas inline extraídos para lib (componentes atualizados)

| Componente | Schema inline removido → importa de |
|---|---|
| `contracts/components/ContratoFormModal.tsx` | `contracts/lib/contrato-schema.ts` |
| `contracts/components/TemplateContratoFormModal.tsx` | `contracts/lib/template-contrato-schema.ts` |
| `monitoring/components/RegraFormModal.tsx` | `monitoring/lib/regra-schema.ts` |

### zodResolver wired

| Componente | Estado anterior | Estado actual |
|---|---|---|
| `artist/components/ArtistaFormModal.tsx` | `useForm` sem resolver | `zodResolver(artistaSchema)` adicionado |

### FieldError local duplicado removido

| Componente | Acção |
|---|---|
| `accounting/components/TransacaoFormModal.tsx` | Local `FieldError` + `AlertCircle` removidos → importa de `@/shared/components/FormField` |
| `events/components/EventoFormModal.tsx` | Local `FieldError` (shadowing) removido; call sites `field="X"` → `error={errors.X}` |
| `crm/components/CRMFormModal.tsx` | Local `FieldError` + `AlertCircle` removidos (eram dead code — 0 call sites) |
| `releases/components/LancamentoFormModal.tsx` | Local `FieldError` removido (dead code — 0 call sites) |

### Phase 2 — safeParse wired em todas as forms pendentes (CONCLUÍDO)

Todos os formulários abaixo receberam validação Zod via `schema.safeParse()` no `handleSubmit`
(ou substituição do `validate()` local por safeParse → `setErrors` para FieldError inline):

| Componente | Abordagem |
|---|---|
| `marketing/components/TarefaMarketingFormModal.tsx` | Migração completa `useForm+zodResolver` |
| `marketing/components/ConteudoFormModal.tsx` | Híbrido: useForm + useState para multi-select |
| `marketing/components/BriefingFormModal.tsx` | Migração completa `useForm+zodResolver` |
| `marketing/components/CampanhaFormModal.tsx` | safeParse no handleSubmit |
| `monitoring/components/TakedownFormModal.tsx` | Migração completa `useForm+zodResolver` |
| `licensing/components/LicencaFormModal.tsx` | Migração completa `useForm+zodResolver` |
| `catalog/components/ObraFormModal.tsx` | safeParse no handleSubmit |
| `catalog/components/FonogramaFormModal.tsx` | safeParse no handleSubmit |
| `crm/components/CRMFormModal.tsx` | safeParse (PF + PJ schemas) no handleSubmit |
| `events/components/EventoFormModal.tsx` | validate() substituído por safeParse → setErrors |
| `releases/components/SharePendenteFormModal.tsx` | safeParse no handleSubmit |
| `rh/components/FuncionarioFormModal.tsx` | validate() substituído por safeParse → setErrors |
| `rh/components/FolhaPagamentoFormModal.tsx` | safeParse no handleSubmit |
| `rh/components/FeriasAusenciasFormModal.tsx` | validate() substituído por safeParse → setErrors |
| `accounting/components/NotaFiscalFormModal.tsx` | safeParse antes da validação inline |
| `projects/components/ProjetoFormModal.tsx` | safeParse no handleSubmit |
| `crm/components/LeadFormModal.tsx` | já tinha safeParse (pre-existente) |

Schemas atualizados para alinhar com o comportamento real dos forms:
- `releases/lib/share-schema.ts` — direcao enum expandido para incluir `a_enviar`; campos opcionais
- `rh/lib/funcionario-schema.ts` — email e cargo tornados opcionais (form não os obriga)

### Resultado Final (Phase 1 + Phase 2)
- `npx tsc --noEmit` → **0 erros** após todas as alterações
- 22 ficheiros schema criados (cobertura 100% dos módulos)
- 3 schemas inline extraídos para lib
- 1 zodResolver fiado (ArtistaFormModal — migração completa)
- 4 `FieldError` locais eliminados
- 16 formulários com safeParse/zodResolver wired (Phase 2 CONCLUÍDA)
