# MUSIC OS 360 — Governança e Documentação Operacional Oficial

> Versão canónica da arquitectura, convenções, entidades, estados, permissões, fluxos e contratos da plataforma.
> Este documento é normativo — toda contribuição ao codebase deve estar em conformidade.

---

## Índice

1. [Visão Geral da Plataforma](#1-visão-geral-da-plataforma)
2. [Stack Técnico](#2-stack-técnico)
3. [Estrutura de Directórios](#3-estrutura-de-directórios)
4. [Convenções Obrigatórias de Nomenclatura](#4-convenções-obrigatórias-de-nomenclatura)
5. [Módulos do Sistema](#5-módulos-do-sistema)
6. [Entidades de Domínio e Relacionamentos](#6-entidades-de-domínio-e-relacionamentos)
7. [Máquinas de Estado](#7-máquinas-de-estado)
8. [Sistema de Permissões RBAC](#8-sistema-de-permissões-rbac)
9. [Feature Flags e Planos de Billing](#9-feature-flags-e-planos-de-billing)
10. [Fluxos Operacionais](#10-fluxos-operacionais)
11. [Integrações](#11-integrações)
12. [Contratos de Integração](#12-contratos-de-integração)
13. [Padrões Visuais](#13-padrões-visuais)
14. [Padrões de Componentes](#14-padrões-de-componentes)
15. [Padrões de Formulários](#15-padrões-de-formulários)
16. [Camada de Dados (Standalone)](#16-camada-de-dados-standalone)
17. [Segurança e Dados Sensíveis](#17-segurança-e-dados-sensíveis)
18. [Limitações de Âmbito](#18-limitações-de-âmbito)
19. [Fontes de Verdade no Codebase](#19-fontes-de-verdade-no-codebase)

---

## 1. Visão Geral da Plataforma

**MUSIC OS 360** é um ERP Musical SaaS multi-tenant que centraliza todas as operações de uma empresa de música — label, editora ou distribuidora — numa única plataforma 360°.

### Proposta de valor

| Área | O que a plataforma resolve |
|------|---------------------------|
| Artistas | Perfil centralizado, métricas de plataformas, visão 360° |
| Catálogo | Obras, fonogramas, ISRC/ISWC, shares de direitos |
| Contratos | Templates, assinatura digital, alertas de vencimento |
| Accounting | P&L por artista/projecto, fluxo de caixa, notas fiscais |
| CRM | Clientes, contactos, leads em pipeline Kanban |
| Marketing | Campanhas, calendário editorial, IA Criativa |
| Operações | Eventos, inventário, RH |
| Monitoramento | Takedowns, conciliação ECAD |
| Licenciamento | Sincronia, mecânica, streaming, performance |

### Público-alvo

- Labels independentes
- Editoras musicais
- Distribuidoras
- Gestoras de artistas (multi-artista)

### Modelo de negócio

SaaS multi-tenant com planos **Starter**, **Professional** e **Enterprise**.  
Billing via Stripe (futuro). Trial gratuito no onboarding.

---

## 2. Stack Técnico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React | 18 |
| Linguagem | TypeScript | strict |
| Build | Vite + SWC | — |
| Roteamento | React Router | v6 |
| Dados (cliente) | TanStack Query | v5 |
| UI Components | shadcn/ui + Radix | — |
| CSS | Tailwind CSS | — |
| Formulários | react-hook-form + Zod | — |
| Gráficos | Recharts | — |
| Ícones | lucide-react + react-icons/si | — |
| Dados | MOCK_DATA + localStorage | standalone |
| Fontes | Plus Jakarta Sans + IBM Plex Mono | — |

**Modo actual:** standalone (sem backend). Todos os dados vivem em `localStorage` sob a chave `musicos360_mock_data`.

---

## 3. Estrutura de Directórios

```
client/src/
├── app/
│   ├── providers/          # AuthProvider, TenantProvider, TenantContext
│   └── routes/             # Ficheiros de rotas por domínio (*.routes.tsx)
├── modules/                # Módulos de domínio
│   ├── <domínio>/
│   │   ├── adapters/       # Adaptadores domínio ↔ contratos externos
│   │   ├── application/    # Use-cases e orquestradores de UI
│   │   ├── components/     # Componentes React do módulo
│   │   ├── domain/         # Regras de negócio puras
│   │   ├── hooks/          # Hooks React do módulo
│   │   ├── mappers/        # FONTE ÚNICA: form ↔ entidade
│   │   ├── pages/          # Páginas (route components)
│   │   ├── services/       # Acesso a dados
│   │   └── types/          # Interfaces e tipos do domínio
│   └── integrations/
│       └── hooks/          # Stub hooks para todas as integrações
└── shared/
    ├── components/         # Componentes genuinamente cross-domain
    ├── config/             # queryClient, CACHE_TIMES
    ├── data/               # mockData.ts (MOCK_DATA)
    ├── design-system/      # Design tokens e padrões
    ├── governance/         # ESTA CAMADA — convenções e documentação
    ├── hooks/              # Hooks cross-domain
    ├── infrastructure/     # ErrorBoundary, AdminRoute, RealtimeLayer
    ├── integrations/       # Tipos, registry e contratos de integração
    ├── layouts/            # MainLayout, PageHeader
    ├── lib/                # Utilitários puros cross-domain
    ├── providers/          # Barrels de providers e hooks
    ├── types/              # Tipos partilhados (enums, refs)
    └── ui/                 # shadcn/Radix primitivos
```

---

## 4. Convenções Obrigatórias de Nomenclatura

> Fonte TypeScript: `shared/governance/naming.ts`

### Ficheiros

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Componente React | `PascalCase.tsx` | `ArtistaCard.tsx` |
| Hook | `use{Name}.ts` | `useArtistaForm.ts` |
| Serviço | `{name}.service.ts` | `artist.service.ts` |
| Mapper | `{entity}Mappers.ts` | `artistaMappers.ts` |
| Tipos | `{entity}.types.ts` | `artista.types.ts` |
| Contrato | `{concern}.contract.ts` | `auth.contract.ts` |
| Adaptador | `{concern}.adapter.ts` | `streaming.adapter.ts` |
| Constantes | `{concern}-constants.ts` | `transacao-constants.ts` |
| Rotas | `{domain}.routes.tsx` | `artist.routes.tsx` |

### Componentes — sufixos obrigatórios

`Card` · `Table` · `Modal` · `Form` · `Page` · `Badge` · `Panel` · `Drawer` · `Section` · `Widget` · `Chart` · `Skeleton` · `Empty` · `Header`

**Proibido:** `Component`, `Container`, `Wrapper`, `Index`, `Manager`, `Handler`, `Controller`

### Hooks — categorias

| Categoria | Padrão | Exemplo |
|-----------|--------|---------|
| Dados | `use{Entity}List` / `use{Entity}Detail` | `useArtistaList` |
| Formulário | `use{Entity}Form` | `useContratoForm` |
| Mutação | `use{Verb}{Entity}` | `useCreateTransacao` |
| Integração | `use{ServiceName}` | `useSpotify` |
| UI | `use{Concern}` | `useCommandPalette` |
| Contexto | `use{ContextName}` | `useTenant` |

### Língua

- **Português** para nomes de domínio (entidades, campos, enums)
- **Inglês** para infra-estrutura (props, estado UI, utilitários)

### Enums

**Proibido:** `enum TypeScript`  
**Correcto:** `type Status = 'ativo' | 'inativo'` em `shared/types/enums.ts`

### Chaves localStorage

Prefixo obrigatório: `musicos360_`

| Chave | Uso |
|-------|-----|
| `musicos360_mock_data` | Dados mock principais |
| `musicos360_rt` | Refresh token |
| `musicos360_tenant` | Dados do tenant activo |
| `musicos360_<id>_credentials` | Credenciais de integração |

**Proibido:** chaves com prefixo `lander_` ou `lander360_` (obsoletas)

### Eventos de window

Prefixo obrigatório: `musicos360:`

`musicos360:dataChanged` · `musicos360:tenantChanged` · `musicos360:authChanged` · `musicos360:themeChanged`

---

## 5. Módulos do Sistema

> Fonte TypeScript: `shared/governance/modules.ts`

| Módulo | Rota | Entidades Primárias | Status |
|--------|------|---------------------|--------|
| `artists` | `/artistas` | Artista | production |
| `catalog` | `/catalogo` | Obra, Fonograma | production |
| `releases` | `/lancamentos` | Lancamento, Share | production |
| `contracts` | `/contratos` | Contrato, TemplateContrato | production |
| `accounting` | `/accounting` | Transacao, NotaFiscal | production |
| `crm` | `/crm` | Cliente, Contato | production |
| `marketing` | `/marketing` | Campanha, Conteudo | production |
| `events` | `/operacoes/eventos` | Evento | production |
| `inventory` | `/operacoes/inventario` | Inventario | production |
| `rh` | `/operacoes/rh` | Funcionario, FeriasAusencia | production |
| `monitoring` | `/monitoramento` | Takedown | production |
| `licensing` | `/licencas` | Licenca | production |
| `projects` | `/projetos` | Projeto | production |
| `leads` | `/crm/leads` | Lead | production |
| `audit` | `/admin/auditoria` | AuditLog | stub |
| `settings` | `/configuracoes` | Tenant, User, Role | production |

### Regra da camada `shared/`

**Pode ir em `shared/`:** tipos cross-domain (2+ módulos), primitivos UI, componentes genuinamente cross-domain, infra-estrutura de app, providers, config, hooks cross-domain, utilitários puros, contratos de integração, governance.

**Não pode ir em `shared/`:** lógica de módulo único, componentes de módulo único, serviços com domínio específico, mappers de entidade.

---

## 6. Entidades de Domínio e Relacionamentos

> Fonte TypeScript: `shared/governance/entities.ts`

### Mapa de relacionamentos

```
Artista ──────────────────────────────────────────────────────────────────────┐
  │ 1:N → Contrato (contrato_id)                                              │
  │ N:N → Obra (via Share.artista_id)                                         │
  │ N:N → Lancamento (via artista_ids[])                                      │
  │ 1:N → ArtistaRelacionamento (relacionamentos[])                            │
  └── central de todas as entidades operacionais                              │
                                                                              │
Obra ─────────────────────────────────────────────────────────────────────────┤
  │ ISWC · cod_ecad · cod_ubc                                                 │
  │ 1:N → Fonograma (obra_id)                                                 │
  │ 1:N → Share (composição)                                                  │
  │ 1:N → Licenca (obra_id)                                                   │
  └── base de arrecadação ECAD/UBC                                           │
                                                                              │
Fonograma ───────────────────────────────────────────────────────────────────┤
  │ ISRC · cod_ecad · UPC                                                     │
  │ N:1 → Obra (obra_id) [obrigatório]                                        │
  │ N:N → Lancamento (fonograma_ids[])                                        │
  │ 1:N → Share (master)                                                      │
  └── base de Content ID e claims de streaming                               │
                                                                              │
Share ───────────────────────────────────────────────────────────────────────┤
  │ tipo: composição | master | editorial | performance | sincronia           │
  │ direção: entrada | saída                                                  │
  │ N:1 → Obra · N:1 → Fonograma · N:1 → Artista                            │
  └── soma de percentuais deve ser 100% por tipo                             │
                                                                              │
Lancamento ──────────────────────────────────────────────────────────────────┤
  │ UPC · EAN                                                                 │
  │ N:N → Artista · N:N → Fonograma                                           │
  └── produto comercial de distribuição                                      │
                                                                              │
Contrato ────────────────────────────────────────────────────────────────────┤
  │ autentique_document_id                                                    │
  │ N:1 → Artista · N:1 → Cliente                                             │
  └── suporte a assinatura digital                                           │
                                                                              │
Transacao ───────────────────────────────────────────────────────────────────┤
  │ ofx_id · nota_fiscal_id                                                   │
  │ N:1 → Artista · N:1 → Projeto · N:1 → NotaFiscal                         │
  └── base de P&L, fluxo de caixa, recoupment                               │
                                                                              │
Lead ─────────────────────────────────────────────────────────────────────────┤
  │ N:1 → Cliente · N:1 → Artista                                             │
  └── pipeline Kanban: novo→fechado/perdido                                  │
                                                                              │
Takedown ─────────────────────────────────────────────────────────────────────┤
  │ url_infracao                                                              │
  │ N:1 → Obra · N:1 → Fonograma                                              │
  └── protecção de direitos cross-plataforma                                 │
                                                                              │
Licenca ──────────────────────────────────────────────────────────────────────┘
  │ N:1 → Obra · N:1 → Cliente · N:1 → Contrato
  └── sincronia · mecânica · performance · streaming
```

### EntityRef — referências cross-domain

Módulos nunca importam a entidade completa de outro módulo.  
Usam `{NomeEntidade}Ref` de `shared/types/refs.ts`:

```typescript
// CORRECTO
import type { ArtistaRef } from "@/shared/types/refs";

// PROIBIDO
import type { Artista } from "@/modules/artist/types/artista.types";
// (em módulos que não sejam o artist)
```

Refs disponíveis: `ArtistaRef` · `ClienteRef` · `ObraRef` · `FonogramaRef` · `LancamentoRef` · `ProjetoRef` · `ContratoRef` · `FuncionarioRef`

---

## 7. Máquinas de Estado

> Fonte TypeScript: `shared/governance/states.ts`

### Regra de cor semântica (obrigatória)

| Cor | Estados |
|-----|---------|
| 🟢 Verde | activo · vigente · publicado · concluído · aprovado · emitido · fechado · registado |
| 🔵 Azul | em curso · agendado · enviado · processando · em contacto · produção · entregue |
| 🟡 Amarelo | pendente · rascunho · análise · planeamento · a vencer · suspenso · negociação |
| ⚫ Cinza | inactivo · arquivado · encerrado · ex-artista · liquidado · pausado |
| 🔴 Vermelho | **EXCLUSIVO:** cancelado · rejeitado · vencido · desligado · falhou · perdido |

**Proibido:** usar vermelho para estados neutros ou de progresso.

### Entidades com máquina de estado documentada

`Artista` · `Contrato` · `Transacao` · `NotaFiscal` · `Obra` · `Fonograma` · `Lancamento` · `Share` · `Lead` · `Takedown` · `Evento` · `Projeto` · `Campanha` · `Funcionario` · `Licenca`

### Exemplo — Contrato

```
rascunho → aguardando_assinatura → vigente → vencendo → vencido → encerrado
                                ↘ cancelado                    ↗ (renovar)
```

---

## 8. Sistema de Permissões RBAC

> Fonte TypeScript: `shared/governance/permissions.ts`  
> Implementação: `app/providers/TenantContext.tsx`

### Hierarquia de papéis

```
owner > admin > manager > editor > viewer
```

### Matriz de permissões (read / write / delete / export)

| Módulo | owner | admin | manager | editor | viewer |
|--------|-------|-------|---------|--------|--------|
| Todos os módulos operacionais | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓✓ | ✓✓✗✓ | ✓✗✗✓ |
| audit | ✓✓✓✓ | ✓✓✓✓ | ✓✗✗✓ | ✗✗✗✗ | ✗✗✗✗ |
| settings | ✓✓✓✓ | ✓✓✓✓ | ✓✗✗✓ | ✗✗✗✗ | ✗✗✗✗ |

### Padrão de uso na UI

```tsx
// Verificar acesso a módulo
const { tenant } = useTenant();
if (!tenant.permissions.artists.read) return <NoAccess />;

// Verificar operação
const canWrite = tenant.permissions.accounting.write;
<Button disabled={!canWrite}>Criar Transação</Button>

// Verificar feature flag
if (!tenant.features.moduleMonitoring) return <UpgradePrompt />;

// Rota restrita
<AdminRoute roles={["owner", "admin"]}>
  <AuditPage />
</AdminRoute>
```

**Proibido:** verificar `tenant.role` directamente nos componentes.

---

## 9. Feature Flags e Planos de Billing

> Fonte TypeScript: `shared/lib/feature-flags.ts`

### Módulos por plano

| Módulo/Feature | Starter | Professional | Enterprise |
|----------------|---------|-------------|------------|
| Módulos core | ✓ | ✓ | ✓ |
| monitoring | ✗ | ✓ | ✓ |
| licensing | ✗ | ✓ | ✓ |
| rh | ✗ | ✓ | ✓ |
| auditLog | ✗ | ✓ | ✓ |
| bulkActions | ✗ | ✓ | ✓ |
| analyticsAdvanced | ✗ | ✗ | ✓ |
| whitelabel | ✗ | ✗ | ✓ |
| multiTenantAdmin | ✗ | ✗ | ✓ |

### Integrações activas por plano (standalone)

Apenas **Abramus** está funcional em modo standalone.  
Todas as outras integrações lançam `DisabledIntegrationError` (status 503).

---

## 10. Fluxos Operacionais

> Fonte TypeScript: `shared/governance/flows.ts`

| ID | Fluxo | Módulos envolvidos |
|----|-------|-------------------|
| F01 | Integração de Novo Artista | crm → artists → contracts → catalog |
| F02 | Lançamento Musical | catalog → releases → marketing → monitoring |
| F03 | Ciclo de Contrato | contracts + artists + crm |
| F04 | Ciclo Financeiro | accounting + artists + projects |
| F05 | Lead → Cliente → Contrato | crm → contracts |
| F06 | Campanha de Marketing | marketing + releases |
| F07 | Takedown de Conteúdo | monitoring + catalog |
| F08 | Conciliação ECAD | monitoring → catalog → accounting |
| F09 | Licenciamento de Obra | licensing → catalog → contracts → accounting |
| F10 | Onboarding de Novo Tenant | settings → artists → catalog → contracts |

### Fluxo F01 — Integração de Artista (resumo)

```
Lead (CRM) → Artista (prospecto) → Contrato (rascunho)
  → Enviar Autentique → Artista (contratado) → Obras/Fonogramas (catálogo)
  → Artista (ativo)
```

### Fluxo F02 — Lançamento (resumo)

```
Obras+Fonogramas (catálogo) → Lançamento (análise)
  → Shares definidos → Aprovado → Entregue (distribuidora)
  → Campanha de marketing → Publicado → Monitoramento activo
```

---

## 11. Integrações

> Fonte TypeScript: `shared/integrations/registry.ts`  
> Hooks: `modules/integrations/hooks/`

### Registry das 19 integrações

| ID | Nome | Categoria | Estado | Hook |
|----|------|-----------|--------|------|
| `Supabase Auth` | Supabase Auth | auth | stub | `useSupabaseAuth` |
| `r2` | Cloudflare R2 | storage | stub | `useR2` |
| `resend` | Resend | email | stub | `useResend` |
| `stripe` | Stripe | payments | stub | `useStripe` |
| `autentique` | Autentique | signing | stub | `useAutentique` |
| `posthog` | PostHog | monitoring | stub | `usePostHog` |
| `sentry` | Sentry | monitoring | stub | `useSentry` |
| `spotify` | Spotify for Artists | streaming | stub | `useSpotify` |
| `youtube` | YouTube Analytics | streaming | stub | `useYouTube` |
| `tiktok` | TikTok for Business | streaming | stub | `useTikTok` |
| `instagram` | Instagram Insights | streaming | stub | `useInstagram` |
| `google-ads` | Google Ads | ads | stub | `useGoogleAds` |
| `deezer` | Deezer | streaming | stub | `useDeezer` |
| `apple-music` | Apple Music for Artists | streaming | stub | `useAppleMusic` |
| `soundcloud` | SoundCloud | streaming | stub | `useSoundCloud` |
| `ecad` | ECAD | rights | stub | `useEcad` |
| `ubc` | UBC | rights | stub | `useUbc` |
| `abramus` | Abramus | rights | **funcional** | `useAbramus` |
| `musicroomchat` | MusicChat | chat | stub | `useChat` |

### Padrão de integração desabilitada

```typescript
// Todas as integrações stub lançam DisabledIntegrationError
export function disabledIntegration(name: string): never {
  throw new DisabledIntegrationError(name); // status: 503
}
```

### Migração de integração (roadmap)

Para activar uma integração stub:
1. Instalar o SDK da integração
2. Configurar credenciais via variáveis de ambiente (`VITE_*`)
3. Implementar o contrato (`shared/integrations/contracts/`)
4. Substituir o hook stub pela implementação real
5. Atualizar o registry (status: `active`)

---

## 12. Contratos de Integração

> Fonte TypeScript: `shared/integrations/contracts/`

| Contrato | Ficheiro | Providers cobertos |
|----------|----------|-------------------|
| Auth | `auth.contract.ts` | Supabase Auth |
| Storage | `storage.contract.ts` | Cloudflare R2 |
| Email | `email.contract.ts` | Resend |
| Payments | `payments.contract.ts` | Stripe |
| Signing | `signing.contract.ts` | Autentique |
| Monitoring | `monitoring.contract.ts` | PostHog, Sentry |
| Streaming | `streaming.contract.ts` | Spotify, YouTube, TikTok, Instagram, Google Ads, Deezer, Apple Music, SoundCloud |
| Rights | `rights.contract.ts` | ECAD, UBC, Abramus |
| Chat | `chat.contract.ts` | MusicChat |

### Adaptadores de domínio

| Adaptador | Localização | Propósito |
|-----------|-------------|-----------|
| `streaming.adapter.ts` | `modules/artist/adapters/` | Artista ↔ perfis de streaming |
| `rights.adapter.ts` | `modules/monitoring/adapters/` | Takedown ↔ APIs ECAD/UBC/Abramus |

---

## 13. Padrões Visuais

### Design tokens

```css
/* Cor principal */
--primary: hsl(217, 91%, 60%);    /* enterprise blue */
--background: hsl(222, 47%, 4%); /* dark navy */

/* Fontes */
font-family: 'Plus Jakarta Sans', sans-serif;
font-family: 'IBM Plex Mono', monospace; /* dados numéricos */
```

### Hierarquia de superfícies

1. Background da página (`bg-background`)
2. Cards e painéis (`bg-card` / `bg-muted/30`)
3. Inputs e campos (`bg-input`)
4. Elementos elevados (`shadow-md` + `ring-1 ring-border`)

### Regras de cor semântica (reforço)

- **Verde** → activo, publicado, concluído, aprovado, emitido
- **Azul** → em curso, agendado, processando, enviado
- **Amarelo** → pendente, rascunho, análise, a vencer
- **Cinza** → inactivo, arquivado, encerrado
- **Vermelho** → **EXCLUSIVO**: cancelado, rejeitado, vencido, falhou, valores negativos

### Sidebar

O cabeçalho da sidebar exibe obrigatoriamente:
- Nome: **MUSIC OS 360**
- Subtítulo: **ERP OPERACIONAL MUSICAL**
- Badge: **SISTEMA MULTI-TENANT**
- Label **Tenant Atual** + nome do tenant

---

## 14. Padrões de Componentes

### Estrutura obrigatória de um componente de página

```tsx
// 1. Import de tipos e hooks
// 2. Definição de tipos locais (se necessário)
// 3. Componente principal com data-testid no elemento raiz
// 4. Estados de loading (Skeleton)
// 5. Estado vazio (Empty)
// 6. Conteúdo principal
// 7. Modais e drawers no fim do JSX
```

### data-testid obrigatório

Todo elemento interactivo e todo dado dinâmico relevante deve ter `data-testid`:

```tsx
<Button data-testid="button-create-artista">Criar Artista</Button>
<input data-testid="input-nome-artistico" />
<div data-testid="card-artista-{artista.id}" />
<span data-testid="text-saldo-total">{saldo}</span>
```

### Skeleton durante loading

```tsx
if (isLoading) return <ArtistaCardSkeleton />;
if (!data?.length) return <ArtistaEmpty />;
```

### Modais

Sempre usar `Dialog` do Radix via shadcn.  
Nomear: `{Entidade}FormModal` para criação/edição, `{Entidade}ViewModal` para visualização.

---

## 15. Padrões de Formulários

### Stack obrigatória

```tsx
const form = useForm<ArtistaFormValues>({
  resolver: zodResolver(artistaFormSchema),
  defaultValues: { ... },
});
```

### Schema Zod

```typescript
// em módulo (não em shared)
const artistaFormSchema = z.object({
  nome_artistico: z.string().min(1, "Obrigatório"),
  // ...
});
type ArtistaFormValues = z.infer<typeof artistaFormSchema>;
```

### Mapper — fonte única de verdade

```typescript
// Nunca transformar dados directamente no componente
// Sempre usar o mapper do módulo
import { toFormArtista, fromFormArtista } from "@/modules/artist/mappers/artistaMappers";
```

### Validação

- `zodResolver` para validação declarativa
- `form.formState.errors` para debug de erros de validação
- Mensagens de erro em Português
- Campos com `required` explícitos no schema

---

## 16. Camada de Dados (Standalone)

### MockData

```typescript
// Chave localStorage
const KEY = "musicos360_mock_data";

// Estrutura
interface MockData {
  artistas: Artista[];
  obras: Obra[];
  fonogramas: Fonograma[];
  contratos: Contrato[];
  transacoes: Transacao[];
  // ... todas as entidades
}
```

### Padrão de serviço

```typescript
// modules/{domain}/services/{entity}.service.ts
export function getAllArtistas(): Artista[] {
  const data = getMockData();
  return data.artistas;
}

export function createArtista(payload: ArtistaInsert): Artista {
  const data = getMockData();
  const novo = { id: uuid(), ...payload };
  data.artistas.push(novo);
  setMockData(data);
  dispatchDataChanged(); // musicos360:dataChanged
  return novo;
}
```

### TanStack Query

```typescript
// Nunca definir queryFn inline em componentes
// Usar hook do módulo
const { data, isLoading } = useArtistaList();

// Cache times: CACHE_TIMES de shared/config
// Invalidar após mutações
queryClient.invalidateQueries({ queryKey: ["artistas"] });
```

---

## 17. Segurança e Dados Sensíveis

| Campo | Visível para | Mascarado para |
|-------|-------------|----------------|
| CPF/CNPJ | owner, admin, manager | editor, viewer |
| Salários | owner, admin | manager, editor, viewer |
| Credenciais de integração | ninguém (UI) | todos |
| Tokens de auth | ninguém | todos |

### Regras

- Credenciais em localStorage apenas em modo standalone; backend Vault no futuro
- `musicos360_rt` eliminado no logout
- Nunca logar tokens, chaves ou passwords em `console.*`
- Dados sensíveis mascarados com `***` em listas e exportações para papéis sem acesso

---

## 18. Limitações de Âmbito

### O que o sistema NÃO faz (por design)

| Tema | Clarificação |
|------|-------------|
| **Recebimentos externos de direitos como domínio** | "Recebimentos externos de direitos" é APENAS uma categoria de transação no Accounting. Não existe módulo de recebimentos externos de direitos. Não existe motor de splits/distribuição. |
| **Contabilidade de artistas** | O módulo Accounting é da empresa (label/editora), não do artista individual |
| **Analytics individual de artista** | Analytics é apenas para perfis de empresa (YouTube, TikTok, Instagram, Meta Ads, Google Ads). Análise individual → Visão 360° modal no módulo Artists |
| **IA como módulo** | Não existe módulo "IA Assistente". IA existe apenas como botões de formulário em Marketing e Artists (`AIGenerateButton`) |
| **Motor de pagamentos** | Stripe é para billing SaaS do tenant, não para pagamentos a artistas |
| **Cálculo de splits** | Shares documentam participações percentuais mas não calculam distribuição de receitas |

### Âmbito exacto do Accounting

```
Accounting = receita - despesa = lucro líquido
           + P&L por artista e projecto
           + recoupment tracking
           + fluxo de caixa
           + conciliação OFX
           + emissão de notas fiscais

NÃO inclui:
  - Cálculo de recebimentos externos de direitos
  - Motor de splits / distribuição
  - Pagamentos a artistas
  - Integração com sistemas de distribuição
```

---

## 19. Fontes de Verdade no Codebase

| Assunto | Localização canónica |
|---------|---------------------|
| Enums de status e tipos | `shared/types/enums.ts` |
| EntityRefs cross-domain | `shared/types/refs.ts` |
| Feature flags | `shared/lib/feature-flags.ts` |
| Registry de integrações | `shared/integrations/registry.ts` |
| Contratos de integração | `shared/integrations/contracts/` |
| Convenções de nomenclatura | `shared/governance/naming.ts` |
| Registo de módulos | `shared/governance/modules.ts` |
| Catálogo de entidades | `shared/governance/entities.ts` |
| Máquinas de estado + cores | `shared/governance/states.ts` |
| Permissões RBAC | `shared/governance/permissions.ts` |
| Fluxos operacionais | `shared/governance/flows.ts` |
| Permissões por papel (impl.) | `app/providers/TenantContext.tsx` |
| Design tokens | `client/src/index.css` |
| Tailwind config | `tailwind.config.ts` |
| Mock data principal | `shared/data/mockData.ts` |
| Mapper de artistas | `modules/artist/mappers/artistaMappers.ts` |
| Mapper de catálogo | `modules/catalog/mappers/registroMusicasMappers.ts` |
| Normalização cross-domain | `shared/lib/normalize.ts` |
| Isolamento multi-tenant | `shared/lib/tenant-isolation.ts` |
| Integração desabilitada | `shared/lib/disabled-integration.ts` |

---

*Este documento é gerado a partir das fontes TypeScript em `shared/governance/` e é normativo para toda a contribuição ao MUSIC OS 360.*

*Última atualização sincronizada com: ETAPA 11 — Governança Definitiva*
