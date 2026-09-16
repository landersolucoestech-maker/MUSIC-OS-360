/**
 * shared/governance/naming.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Convenções Obrigatórias de Nomenclatura
 *
 * Este ficheiro é NORMATIVO. Toda a contribuição ao codebase deve seguir
 * estas convenções sem excepção. São as regras canónicas do projecto.
 *
 * Categorias:
 *   1. Ficheiros e directórios
 *   2. Componentes React
 *   3. Hooks
 *   4. Serviços e utilitários
 *   5. Entidades e tipos
 *   6. DTOs
 *   7. Constantes e enums
 *   8. Rotas e URLs
 *   9. Chaves localStorage
 *  10. Eventos customizados
 *  11. IDs de teste (data-testid)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1. FICHEIROS E DIRECTÓRIOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: kebab-case para todos os ficheiros. PascalCase apenas para
 *        componentes React (*.tsx que exportam um componente por defeito).
 *
 * Extensões obrigatórias por type:
 *   .tsx  → componentes React (JSX)
 *   .ts   → lógica pura, tipos, hooks, serviços, utilitários
 *   .css  → estilos standalone (raramente usado; preferir Tailwind)
 *   .md   → documentação
 *
 * Padrões de nomenclatura por camada:
 *   Componente       → PascalCase.tsx              ex: ArtistCard.tsx
 *   Hook             → camelCase.ts (prefixo use)  ex: useArtistForm.ts
 *   Serviço          → kebab-case.ts (sufixo .service) ex: artist.service.ts
 *   Mapper           → kebab-case.ts (sufixo Mappers) ex: artistaMappers.ts
 *   Tipos            → kebab-case.ts (sufixo .types)  ex: artista.types.ts
 *   Contrato         → kebab-case.ts (sufixo .contract) ex: auth.contract.ts
 *   Adaptador        → kebab-case.ts (sufixo .adapter) ex: streaming.adapter.ts
 *   Constantes       → kebab-case.ts (sufixo -constants) ex: transaction-constants.ts
 *   Rotas            → kebab-case.tsx (sufixo .routes) ex: artist.routes.tsx
 *
 * Estrutura interna de módulo (ordem obrigatória):
 *   modules/<domínio>/
 *     adapters/   → adaptadores de integração (domínio → contrato externo)
 *     application/→ use-cases e orquestradores de UI
 *     components/ → componentes React do módulo
 *     domain/     → regras de negócio puras (sem dependência de UI)
 *     hooks/      → hooks React do módulo
 *     mappers/    → mappers form ↔ entidade (fonte única de verdade)
 *     pages/      → páginas (route components)
 *     services/   → acesso a dados (localStorage, API futura)
 *     types/      → interfaces e tipos do domínio
 */
export const FILE_NAMING_RULES = {
  component:  "PascalCase.tsx",
  hook:       "use{Name}.ts",
  service:    "{name}.service.ts",
  mapper:     "{entity}Mappers.ts",
  types:      "{entity}.types.ts",
  contract:   "{concern}.contract.ts",
  adapter:    "{concern}.adapter.ts",
  constants:  "{concern}-constants.ts",
  routes:     "{domain}.routes.tsx",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COMPONENTES REACT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: PascalCase. Sempre um componente por ficheiro.
 *        Nomes descrevem o que o componente É, não o que FAZ.
 *
 * Sufixos obrigatórios por papel:
 *   Card     → item de lista compacto               ex: ArtistaCard
 *   Table    → tabela de dados paginada             ex: TransacaoTable
 *   Modal    → diálogo/modal (Dialog do Radix)      ex: ContractFormModal
 *   Form     → formulário standalone                ex: ArtistaForm
 *   Page     → componente de rota (página)          ex: ArtistaListPage
 *   Badge    → badge de estado inline               ex: ContractStatusBadge
 *   Panel    → painel colapsável ou lateral         ex: FiltrosPanel
 *   Drawer   → drawer lateral (Sheet do Radix)      ex: ArtistaDrawer
 *   Section  → secção de página                    ex: FinanceiroSummarySection
 *   Widget   → widget de dashboard                  ex: ReceitaWidget
 *   Chart    → gráfico (recharts)                   ex: FluxoCaixaChart
 *   Skeleton → estado de carregamento               ex: ArtistaCardSkeleton
 *   Empty    → estado vazio                         ex: CatalogoEmpty
 *   Header   → cabeçalho de secção                  ex: PageHeader
 *
 * PROIBIDO:
 *   - Nomes genéricos: Component, Container, Wrapper, Index
 *   - Nomes com "Manager", "Handler", "Controller" (papel de serviço, não componente)
 *   - Abreviações opacas: ArtCtrl, TxModal, etc.
 */
export const COMPONENT_NAMING = {
  suffixes: ["Card", "Table", "Modal", "Form", "Page", "Badge",
             "Panel", "Drawer", "Section", "Widget", "Chart",
             "Skeleton", "Empty", "Header"] as const,
  forbidden: ["Component", "Container", "Wrapper", "Index",
              "Manager", "Handler", "Controller"] as const,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 3. HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: prefixo `use` obrigatório. camelCase. Verbo ou substantivo após `use`.
 *
 * Categorias e padrões:
 *   Dados       → use{Entity}List, use{Entity}Detail   ex: useArtistaList
 *   Formulário  → use{Entity}Form                      ex: useContratoForm
 *   Mutação     → use{Verb}{Entity}                    ex: useCreateTransacao
 *   Integração  → use{ServiceName}                     ex: useSpotify, useAbramus
 *   UI/Estado   → use{Concern}                         ex: useCommandPalette
 *   Contexto    → use{ContextName}                     ex: useTenant, useAuth
 *
 * Regras de retorno:
 *   - Hooks de dados devem retornar o objecto UseQueryResult completo
 *     ou desestruturar explicitamente: { data, isLoading, error }
 *   - Hooks de mutação devem expor { mutate, isPending, error }
 *   - Hooks de formulário devem retornar o objecto form (react-hook-form)
 *   - Hooks de integração desabilitada devem retornar IntegrationRuntimeStatus
 *
 * PROIBIDO:
 *   - Hooks sem prefixo `use`
 *   - Lógica de negócio dentro de componentes (extrair para hook)
 *   - Chamadas a serviços directamente em componentes (usar hook intermediário)
 */
export const HOOK_NAMING = {
  prefix:     "use",
  categories: {
    data:        "use{Entity}List | use{Entity}Detail",
    form:        "use{Entity}Form",
    mutation:    "use{Verb}{Entity}",
    integration: "use{ServiceName}",
    ui:          "use{Concern}",
    context:     "use{ContextName}",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SERVIÇOS E UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: camelCase para funções, kebab-case para ficheiros.
 *
 * Serviços (sufixo .service.ts):
 *   - Único ponto de acesso a localStorage / API futura por domínio
 *   - Funções puras: getAll, getById, create, update, remove
 *   - Sem lógica de UI, sem useState, sem useEffect
 *   - Tipos de retorno explícitos (nunca `any`)
 *
 * Mappers (sufixo Mappers.ts):
 *   - ÚNICA fonte de verdade para transformações form ↔ entidade
 *   - Funções: toForm{Entity}, fromForm{Entity}, normalize{Entity}
 *   - Importados apenas por hooks de formulário e serviços
 *
 * Utilitários (shared/lib/):
 *   - Funções puras sem dependências de UI ou domínio
 *   - Nomes descritivos: formatCurrency, slugify, truncate
 *   - Exportados individualmente (sem namespace objects)
 *
 * Adaptadores (adapters/):
 *   - Convertem entidades locais ↔ formato de APIs externas
 *   - Sem efeitos colaterais; apenas transformações de dados
 *   - Funções: to{ExternalFormat}, from{ExternalFormat}
 */
export const SERVICE_NAMING = {
  localStorageGet:  "getAll{Entities} | get{Entity}ById",
  localStorageSet:  "create{Entity} | update{Entity} | remove{Entity}",
  mapperToForm:     "toForm{Entity}",
  mapperFromForm:   "fromForm{Entity}",
  adapterToExt:     "to{ExternalFormat}",
  adapterFromExt:   "from{ExternalFormat}",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ENTIDADES E TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: Português para nomes de domínio (entidades, campos, enums).
 *        Inglês para infra-estrutura (props, estado UI, utilitários).
 *
 * Entidades de domínio (Português):
 *   Artista, Obra, Fonograma, Lançamento, Contrato, Transacao,
 *   NotaFiscal, Cliente, Lead, Campanha, Evento, Projeto,
 *   Funcionario, Inventario, Licenca, Takedown, Share
 *
 * Interfaces de entidade:
 *   interface {NomeEntidade}          → entidade completa (ex: Artista)
 *   type {NomeEntidade}Insert         → campos para criação (sem id, timestamps)
 *   type {NomeEntidade}Update         → campos para atualização (Partial<Insert>)
 *   interface {NomeEntidade}WithRelations → entidade com refs expandidas
 *
 * EntityRef (shared/types/refs.ts):
 *   interface {NomeEntidade}Ref → referência leve cross-domain
 *   Regra: sem index signature; apenas campos explícitos.
 *
 * PROIBIDO:
 *   - Campos `any` — usar `unknown` ou type específico
 *   - Index signatures em refs (ex: [key: string]: unknown) — usar campos explícitos
 *   - Tipos inline em componentes (extrair para .types.ts do módulo)
 *   - Duplicação de tipos entre módulos (usar EntityRef cross-domain)
 */
export const ENTITY_NAMING = {
  full:          "interface {NomeEntidade}",
  insert:        "type {NomeEntidade}Insert",
  update:        "type {NomeEntidade}Update",
  withRelations: "interface {NomeEntidade}WithRelations",
  ref:           "interface {NomeEntidade}Ref  // em shared/types/refs.ts",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 6. DTOs (DATA TRANSFER OBJECTS)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: DTOs descrevem dados em trânsito (API, localStorage, forms).
 *        Distinção obrigatória entre entidade (domínio) e DTO (transporte).
 *
 * Padrões de DTO:
 *   {Entity}FormValues    → valores do formulário react-hook-form
 *   {Entity}ApiPayload    → corpo da requisição para API (futura)
 *   {Entity}ApiResponse   → resposta da API (futura)
 *   {Entity}LocalPayload  → payload para localStorage (modo standalone)
 *   {Entity}ExportRow     → linha de exportação XLSX/PDF
 *
 * Localização:
 *   FormValues → no módulo que usa o formulário
 *   ApiPayload/Response → em shared/types/ ou no módulo de serviço
 *   LocalPayload → no serviço do módulo
 *
 * Validação:
 *   - Todos os formulários usam zodResolver + schema Zod
 *   - Schemas Zod nomeados: {entity}FormSchema
 *   - Schemas de inserção: {entity}InsertSchema
 */
export const DTO_NAMING = {
  formValues:    "{Entity}FormValues",
  apiPayload:    "{Entity}ApiPayload",
  apiResponse:   "{Entity}ApiResponse",
  localPayload:  "{Entity}LocalPayload",
  exportRow:     "{Entity}ExportRow",
  zodFormSchema: "{entity}FormSchema",
  zodInsert:     "{entity}InsertSchema",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CONSTANTES E ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: SCREAMING_SNAKE_CASE para constantes de valor fixo.
 *        Literal union types (não enum TypeScript) para campos enumerados.
 *
 * Localização:
 *   Enums de domínio    → shared/types/enums.ts (fonte única de verdade)
 *   Constantes visuais  → design tokens em index.css (CSS vars)
 *   Constantes de rota  → no ficheiro de rotas do módulo
 *   Constantes de forma → no módulo (ex: transaction-constants.ts)
 *   Constantes de integração → shared/integrations/registry.ts
 *
 * PROIBIDO:
 *   - enum TypeScript (usar literal union type)
 *   - Constantes de domínio definidas em componentes
 *   - Strings mágicas — extrair para constante nomeada
 */
export const CONSTANTS_NAMING = {
  value:       "SCREAMING_SNAKE_CASE",
  unionType:   "type {Name} = 'valor_a' | 'valor_b'  // em shared/types/enums.ts",
  noTsEnum:    "PROIBIDO: enum TypeScript. Usar literal union type.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ROTAS E URLs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: kebab-case. Português para nomes de domínio. Sem trailing slash.
 *
 * Estrutura de rotas por módulo:
 *   /artistas                  → lista de artistas
 *   /artistas/:id              → detalhe de artista
 *   /artistas/:id/editar       → edição de artista
 *   /catalogo/obras            → catálogo de obras
 *   /catalogo/fonogramas       → catálogo de fonogramas
 *   /accounting/*              → módulo de contabilidade
 *   /contratos                 → lista de contratos
 *   /crm/clientes              → CRM — clientes
 *   /leads                     -> Leads comerciais
 *   /marketing/campanhas       → marketing — campanhas
 *   /lancamentos               → lançamentos musicais
 *   /gestao-shares             → gestão de shares/participações
 *   /monitoramento             → monitoramento e takedowns
 *   /licencas                  → licenciamento
 *   /operacoes/eventos         → eventos
 *   /operacoes/inventario      → inventário
 *   /operacoes/rh              → recursos humanos
 *   /projetos                  → projetos
 *   /chat                      → MusicChat
 *   /configuracoes             → configurações
 *   /admin/*                   → área administrativa (AdminRoute)
 *
 * Query params: snake_case.  ex: ?page=1&per_page=20&status=ativo
 * Params de rota: :id, :slug — sempre snake_case.
 */
export const ROUTE_PATTERNS = {
  list:   "/:dominio",
  detail: "/:dominio/:id",
  edit:   "/:dominio/:id/editar",
  create: "/:dominio/novo",
  sub:    "/:dominio/:submodulo",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CHAVES LOCALSTORAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: Prefixo obrigatório `musicos360_`. snake_case após o prefixo.
 *
 * Chaves registadas:
 *   musicos360_mock_data               → dados mock principais (MOCK_DATA)
 *   musicos360_rt                      → refresh token de autenticação
 *   musicos360_tenant                  → dados do tenant activo
 *   musicos360_<id>_credentials        → credenciais de integração por ID
 *   musicos360_sidebar_collapsed       → estado da sidebar
 *   musicos360_command_palette_history → histórico do command palette
 *
 * PROIBIDO:
 *   - Chaves sem prefixo `musicos360_`
 *   - Chaves com prefixo antigo `lander_` ou `lander360_` (obsoletas)
 *   - Dados sensíveis em localStorage sem encriptação
 */
export const LOCALSTORAGE_KEYS = {
  mockData:          "musicos360_mock_data",
  refreshToken:      "musicos360_rt",
  tenant:            "musicos360_tenant",
  credentials:       "musicos360_<integration_id>_credentials",
  sidebarCollapsed:  "musicos360_sidebar_collapsed",
  commandHistory:    "musicos360_command_palette_history",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 10. EVENTOS CUSTOMIZADOS (window CustomEvents)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: Prefixo `musicos360:`. camelCase após o prefixo.
 *
 * Eventos registados:
 *   musicos360:dataChanged   → MOCK_DATA foi alterado (trigger de refetch)
 *   musicos360:tenantChanged → tenant activo foi alterado
 *   musicos360:authChanged   → estado de autenticação alterado
 *
 * PROIBIDO:
 *   - Eventos sem prefixo `musicos360:`
 *   - Eventos sem tipo de detalhe tipado (CustomEvent<T>)
 */
export const CUSTOM_EVENTS = {
  dataChanged:   "musicos360:dataChanged",
  tenantChanged: "musicos360:tenantChanged",
  authChanged:   "musicos360:authChanged",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 11. IDs DE TESTE (data-testid)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * REGRA: Formato `{type}-{alvo}` para elementos interactivos.
 *        Formato `{type}-{conteúdo}-{id}` para listas dinâmicas.
 *
 * Tipos de prefixo por categoria:
 *   button-   → botões                ex: button-create-artista
 *   input-    → campos de formulário  ex: input-nome-artistico
 *   link-     → links de navegação    ex: link-artista-profile
 *   select-   → dropdowns             ex: select-status
 *   table-    → tabelas               ex: table-artistas
 *   row-      → linhas de tabela      ex: row-artista-{id}
 *   card-     → cards                 ex: card-artista-{id}
 *   badge-    → badges de estado      ex: badge-status-ativo
 *   modal-    → modais                ex: modal-contrato-form
 *   text-     → textos dinâmicos      ex: text-saldo-total
 *   img-      → imagens               ex: img-artista-avatar
 *   status-   → mensagens de estado   ex: status-payment-pending
 *
 * REGRA: IDs estáveis — não usar índices de array, usar IDs de entidade.
 * OBRIGATORIO: todo elemento interactivo e todo dado dinâmico relevante.
 */
export const TEST_ID_PATTERNS = {
  interactive:   "{type}-{alvo}",
  dynamic:       "{type}-{descricao}-{id}",
  prefixes: ["button", "input", "link", "select", "table",
             "row", "card", "badge", "modal", "text", "img", "status"] as const,
} as const;

