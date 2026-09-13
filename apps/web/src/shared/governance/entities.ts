/**
 * shared/governance/entities.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Catálogo Canónico de Entidades e Relacionamentos
 *
 * Fonte única de verdade para:
 *   - Todas as entidades do domínio
 *   - Campos obrigatórios e opcionais
 *   - Relacionamentos (cardinalidade e direcção)
 *   - Módulo dono de cada entidade
 *   - Localização dos tipos TypeScript
 *   - Campos de identidade externa (ISRC, ISWC, CNPJ, etc.)
 *
 * REGRA: qualquer nova entidade de domínio deve ser registada aqui
 *        antes de ser implementada nos módulos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Tipos do catálogo ────────────────────────────────────────────────────────

export type RelationshipCardinality =
  | "1:1"    // um para um
  | "1:N"    // um para muitos
  | "N:1"    // muitos para um
  | "N:N";   // muitos para muitos

export interface EntityRelationship {
  /** Entidade destino do relacionamento */
  target: string;
  /** Cardinalidade */
  cardinality: RelationshipCardinality;
  /** Campo(s) que implementa(m) o relacionamento */
  via: string;
  /** Relacionamento obrigatório? */
  required: boolean;
  /** Descrição do relacionamento */
  description: string;
}

export interface EntityDefinition {
  /** Nome da entidade (PascalCase, Português) */
  name: string;
  /** Módulo dono (fonte dos tipos e serviços) */
  ownerModule: string;
  /** Localização do ficheiro de tipos */
  typesFile: string;
  /** Chave primária */
  primaryKey: string;
  /** Campos de identificação externa (padrões da indústria) */
  externalIds: string[];
  /** Campos obrigatórios na criação */
  requiredFields: string[];
  /** Relacionamentos com outras entidades */
  relationships: EntityRelationship[];
  /** Breve descrição */
  description: string;
}

// ─── Catálogo de entidades ────────────────────────────────────────────────────

export const ENTITY_CATALOG: Record<string, EntityDefinition> = {

  // ══════════════════════════════════════════════════════════════════════════
  // ARTISTS MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Artista: {
    name:         "Artista",
    ownerModule:  "artist",
    typesFile:    "modules/artist/types/artista.types.ts",
    primaryKey:   "id",
    externalIds:  [
      "cpf_cnpj",
      "spotify_url",
      "youtube_url",
      "deezer_url",
      "apple_music_url",
      "soundcloud_url",
    ],
    requiredFields: ["id", "nome_artistico"],
    relationships: [
      {
        target:      "Contrato",
        cardinality: "1:N",
        via:         "contrato_id",
        required:    false,
        description: "Contrato activo vinculado ao artista",
      },
      {
        target:      "Obra",
        cardinality: "N:N",
        via:         "Share.artista_id",
        required:    false,
        description: "Participação em obras via shares de composição",
      },
      {
        target:      "Lancamento",
        cardinality: "N:N",
        via:         "Lancamento.artista_ids[]",
        required:    false,
        description: "Artistas participantes num lançamento",
      },
      {
        target:      "ArtistaRelacionamento",
        cardinality: "1:N",
        via:         "relacionamentos[]",
        required:    false,
        description: "Empresário, gravadora, editora, booker, jurídico, etc.",
      },
    ],
    description:
      "Entidade central do sistema. Representa um artista musical: " +
      "solo, banda, duo, trio, grupo ou colectivo. " +
      "Agrega perfil, dados fiscais, relacionamentos, " +
      "métricas de plataformas e histórico de contratos.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATALOG MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Obra: {
    name:         "Obra",
    ownerModule:  "catalog",
    typesFile:    "modules/catalog/types/obra.types.ts",
    primaryKey:   "id",
    externalIds:  ["iswc", "cod_ecad", "cod_entidade"],
    requiredFields: ["id", "titulo"],
    relationships: [
      {
        target:      "Fonograma",
        cardinality: "1:N",
        via:         "Fonograma.obra_id",
        required:    false,
        description: "Gravações (fonogramas) da obra",
      },
      {
        target:      "Share",
        cardinality: "1:N",
        via:         "Share.obra_id",
        required:    false,
        description: "Participações de composição (splits de direitos autorais)",
      },
      {
        target:      "Licenca",
        cardinality: "1:N",
        via:         "Licenca.obra_id",
        required:    false,
        description: "Licenças de uso da obra",
      },
    ],
    description:
      "Composição musical (letra + melodia). Identificada por ISWC. " +
      "Pode ter múltiplos fonogramas (gravações). " +
      "Gerida pelo ECAD / UBC para efeitos de arrecadação.",
  },

  Fonograma: {
    name:         "Fonograma",
    ownerModule:  "catalog",
    typesFile:    "modules/catalog/types/fonograma.types.ts",
    primaryKey:   "id",
    externalIds:  ["isrc", "cod_ecad", "upc"],
    requiredFields: ["id", "titulo", "obra_id"],
    relationships: [
      {
        target:      "Obra",
        cardinality: "N:1",
        via:         "obra_id",
        required:    true,
        description: "Obra da qual este fonograma é gravação",
      },
      {
        target:      "Lancamento",
        cardinality: "N:N",
        via:         "Lancamento.fonograma_ids[]",
        required:    false,
        description: "Lançamentos que incluem este fonograma",
      },
      {
        target:      "Share",
        cardinality: "1:N",
        via:         "Share.fonograma_id",
        required:    false,
        description: "Participações de master (splits de direitos conexos)",
      },
    ],
    description:
      "Gravação específica de uma obra. Identificado por ISRC. " +
      "Pode aparecer em múltiplos lançamentos. " +
      "Ponto de referência para claims ECAD e Content ID.",
  },

  Share: {
    name:         "Share",
    ownerModule:  "releases",
    typesFile:    "modules/releases/types/share.types.ts",
    primaryKey:   "id",
    externalIds:  [],
    requiredFields: ["id", "tipo", "percentage"],
    relationships: [
      {
        target:      "Obra",
        cardinality: "N:1",
        via:         "obra_id",
        required:    false,
        description: "Obra à qual este share de composição pertence",
      },
      {
        target:      "Fonograma",
        cardinality: "N:1",
        via:         "fonograma_id",
        required:    false,
        description: "Fonograma ao qual este share de master pertence",
      },
      {
        target:      "Artista",
        cardinality: "N:1",
        via:         "artista_id",
        required:    false,
        description: "Artista titular do share",
      },
    ],
    description:
      "Participação percentual nos direitos de uma obra ou fonograma. " +
      "Tipos: composição, master, editorial, performance, sincronia. " +
      "Direção: entrada (recebe) ou saída (paga).",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RELEASES MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Lancamento: {
    name:         "Lancamento",
    ownerModule:  "releases",
    typesFile:    "modules/releases/types/lancamento.types.ts",
    primaryKey:   "id",
    externalIds:  ["upc", "ean"],
    requiredFields: ["id", "titulo", "tipo"],
    relationships: [
      {
        target:      "Artista",
        cardinality: "N:N",
        via:         "artista_ids[]",
        required:    true,
        description: "Artistas principais do lançamento",
      },
      {
        target:      "Fonograma",
        cardinality: "N:N",
        via:         "fonograma_ids[]",
        required:    false,
        description: "Fonogramas incluídos no lançamento",
      },
    ],
    description:
      "Produto musical comercial: single, EP, álbum, compilação, live. " +
      "Agrega fonogramas, define distribuidora, plataformas de distribuição, " +
      "datas de entrega e publicação.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONTRACTS MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Contrato: {
    name:         "Contrato",
    ownerModule:  "contracts",
    typesFile:    "modules/contracts/types/contrato.types.ts",
    primaryKey:   "id",
    externalIds:  ["autentique_document_id"],
    requiredFields: ["id", "titulo", "tipo", "status"],
    relationships: [
      {
        target:      "Artista",
        cardinality: "N:1",
        via:         "artista_id",
        required:    false,
        description: "Artista principal do contrato",
      },
      {
        target:      "Cliente",
        cardinality: "N:1",
        via:         "cliente_id",
        required:    false,
        description: "Cliente / contraparte do contrato",
      },
    ],
    description:
      "Contrato jurídico: exclusivo, não exclusivo, licenciamento, " +
      "distribuição, produção, representação, parceria, serviços, gestão. " +
      "Suporte a assinatura digital via Autentique.",
  },

  TemplateContrato: {
    name:         "TemplateContrato",
    ownerModule:  "contracts",
    typesFile:    "modules/contracts/lib/template-contrato-types.ts",
    primaryKey:   "id",
    externalIds:  [],
    requiredFields: ["id", "nome", "tipo", "conteudo"],
    relationships: [
      {
        target:      "Contrato",
        cardinality: "1:N",
        via:         "Contrato.template_id",
        required:    false,
        description: "Contratos gerados a partir deste template",
      },
    ],
    description:
      "Template reutilizável para geração de contratos. " +
      "Suporta variáveis dinâmicas ({{artista}}, {{valor}}, etc.). " +
      "Versionado e categorizado por tipo de contrato.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ACCOUNTING MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Transacao: {
    name:         "Transacao",
    ownerModule:  "accounting",
    typesFile:    "modules/accounting/types/transacao.types.ts",
    primaryKey:   "id",
    externalIds:  ["ofx_id", "nota_fiscal_id"],
    requiredFields: ["id", "tipo", "valor", "data", "descricao"],
    relationships: [
      {
        target:      "Artista",
        cardinality: "N:1",
        via:         "artista_id",
        required:    false,
        description: "Artista vinculado à transação (P&L por artista)",
      },
      {
        target:      "Projeto",
        cardinality: "N:1",
        via:         "projeto_id",
        required:    false,
        description: "Projeto vinculado (P&L por projeto, recoupment)",
      },
      {
        target:      "NotaFiscal",
        cardinality: "N:1",
        via:         "nota_fiscal_id",
        required:    false,
        description: "Nota fiscal associada à transação",
      },
    ],
    description:
      "Transação financeira: receita ou despesa. " +
      "Base do P&L, fluxo de caixa e conciliação OFX. " +
      "Categorias incluem 'recebimentos externos de direitos' apenas como label — " +
      "NÃO é um domínio de produto separado.",
  },

  NotaFiscal: {
    name:         "NotaFiscal",
    ownerModule:  "accounting",
    typesFile:    "modules/accounting/types/nota-fiscal.types.ts",
    primaryKey:   "id",
    externalIds:  ["numero_nf", "chave_acesso"],
    requiredFields: ["id", "tipo", "status", "valor_total"],
    relationships: [
      {
        target:      "Transacao",
        cardinality: "1:N",
        via:         "Transacao.nota_fiscal_id",
        required:    false,
        description: "Transações vinculadas a esta nota fiscal",
      },
      {
        target:      "Cliente",
        cardinality: "N:1",
        via:         "cliente_id",
        required:    false,
        description: "Destinatário da nota fiscal",
      },
    ],
    description:
      "Nota fiscal de serviços ou produtos: NFS-e, NF-e, NFC-e, recibo. " +
      "Fluxo: rascunho → pendente → emitida → cancelada / rejeitada.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CRM MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Cliente: {
    name:         "Cliente",
    ownerModule:  "crm",
    typesFile:    "modules/crm-relationships/types/index.ts",
    primaryKey:   "id",
    externalIds:  ["cnpj", "cpf"],
    requiredFields: ["id", "nome"],
    relationships: [
      {
        target:      "Contrato",
        cardinality: "1:N",
        via:         "Contrato.cliente_id",
        required:    false,
        description: "Contratos em que este cliente é contraparte",
      },
      {
        target:      "Lead",
        cardinality: "1:N",
        via:         "Lead.cliente_id",
        required:    false,
        description: "Leads originados deste cliente",
      },
      {
        target:      "Contato",
        cardinality: "1:N",
        via:         "Contato.cliente_id",
        required:    false,
        description: "Contactos associados a este cliente",
      },
    ],
    description:
      "Cliente ou parceiro de negócio: gravadora, editora, agência, " +
      "marca, produtor, veículo de comunicação. " +
      "Pode ser pessoa física ou jurídica.",
  },

  Lead: {
    name:         "Lead",
    ownerModule:  "crm",
    typesFile:    "modules/leads/types/index.ts",
    primaryKey:   "id",
    externalIds:  [],
    requiredFields: ["id", "nome", "status"],
    relationships: [
      {
        target:      "Cliente",
        cardinality: "N:1",
        via:         "cliente_id",
        required:    false,
        description: "Cliente existente de onde o lead originou",
      },
      {
        target:      "Artista",
        cardinality: "N:1",
        via:         "artista_id",
        required:    false,
        description: "Artista alvo desta oportunidade",
      },
    ],
    description:
      "Oportunidade de negócio em captacao comercial. " +
      "Status: novo → em contacto → proposta → negociação → fechado/perdido. " +
      "Temperatura: quente, morno, frio.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EVENTS & OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════

  Evento: {
    name:         "Evento",
    ownerModule:  "events",
    typesFile:    "modules/events/types/evento.types.ts",
    primaryKey:   "id",
    externalIds:  [],
    requiredFields: ["id", "titulo", "tipo", "data_inicio"],
    relationships: [
      {
        target:      "Artista",
        cardinality: "N:N",
        via:         "artista_ids[]",
        required:    false,
        description: "Artistas participantes no evento",
      },
      {
        target:      "Projeto",
        cardinality: "N:1",
        via:         "projeto_id",
        required:    false,
        description: "Projeto ao qual o evento pertence",
      },
    ],
    description:
      "Evento ao vivo ou em estúdio: show, festival, gravação, " +
      "videoclipe, ensaio, reunião, workshop, lançamento, live, streaming.",
  },

  Projeto: {
    name:         "Projeto",
    ownerModule:  "projects",
    typesFile:    "modules/projects/types/projeto.types.ts",
    primaryKey:   "id",
    externalIds:  [],
    requiredFields: ["id", "titulo", "tipo", "status"],
    relationships: [
      {
        target:      "Artista",
        cardinality: "N:1",
        via:         "artista_id",
        required:    false,
        description: "Artista principal do projecto",
      },
      {
        target:      "Transacao",
        cardinality: "1:N",
        via:         "Transacao.projeto_id",
        required:    false,
        description: "Transações do projecto (P&L e recoupment)",
      },
      {
        target:      "Evento",
        cardinality: "1:N",
        via:         "Evento.projeto_id",
        required:    false,
        description: "Eventos vinculados ao projecto",
      },
    ],
    description:
      "Projecto musical com P&L dedicado e recoupment tracking. " +
      "Tipos: álbum, EP, single, videoclipe, show, tour, campanha, podcast.",
  },

  Inventario: {
    name:         "Inventario",
    ownerModule:  "inventory",
    typesFile:    "modules/inventory/types/inventario.types.ts",
    primaryKey:   "id",
    externalIds:  ["numero_serie", "patrimonio"],
    requiredFields: ["id", "nome", "status"],
    relationships: [],
    description:
      "Item de inventário: equipamento de estúdio, instrumento, " +
      "equipamento de PA/iluminação, veículo. " +
      "Estado: disponível, em uso, manutenção, emprestado, descartado.",
  },

  Funcionario: {
    name:         "Funcionario",
    ownerModule:  "rh",
    typesFile:    "modules/rh/types/funcionario.types.ts",
    primaryKey:   "id",
    externalIds:  ["cpf", "pis", "ctps"],
    requiredFields: ["id", "nome", "cargo", "tipo_contrato"],
    relationships: [
      {
        target:      "FeriasAusencia",
        cardinality: "1:N",
        via:         "FeriasAusencia.funcionario_id",
        required:    false,
        description: "Períodos de férias e ausências do funcionário",
      },
    ],
    description:
      "Colaborador da empresa: CLT, PJ, autónomo, estagiário, temporário. " +
      "Gestão de cargo, departamento, salário, admissão e desligamento.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MONITORING MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Takedown: {
    name:         "Takedown",
    ownerModule:  "monitoring",
    typesFile:    "modules/monitoring/types/monitoring.types.ts",
    primaryKey:   "id",
    externalIds:  ["url_infracao"],
    requiredFields: ["id"],
    relationships: [
      {
        target:      "Obra",
        cardinality: "N:1",
        via:         "obra_id",
        required:    false,
        description: "Obra cujo uso está a ser contestado",
      },
      {
        target:      "Fonograma",
        cardinality: "N:1",
        via:         "fonograma_id",
        required:    false,
        description: "Fonograma cujo uso está a ser contestado",
      },
    ],
    description:
      "Solicitação de remoção de conteúdo não autorizado. " +
      "Plataformas: YouTube, TikTok, Instagram, Spotify, etc. " +
      "Status: pendente → enviado → processando → concluído / rejeitado / falhou.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LICENSING MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Licenca: {
    name:         "Licenca",
    ownerModule:  "licensing",
    typesFile:    "modules/licensing/types/licenca.types.ts",
    primaryKey:   "id",
    externalIds:  [],
    requiredFields: ["id", "tipo", "status"],
    relationships: [
      {
        target:      "Obra",
        cardinality: "N:1",
        via:         "obra_id",
        required:    false,
        description: "Obra licenciada",
      },
      {
        target:      "Cliente",
        cardinality: "N:1",
        via:         "cliente_id",
        required:    false,
        description: "Licenciado (quem recebe o direito de uso)",
      },
      {
        target:      "Contrato",
        cardinality: "N:1",
        via:         "contrato_id",
        required:    false,
        description: "Contrato de licença associado",
      },
    ],
    description:
      "Licença de uso de obra: sincronia, mecânica, performance, " +
      "impressão, digital, streaming. Territórios, prazo e valor por uso.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MARKETING MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Campanha: {
    name:         "Campanha",
    ownerModule:  "marketing",
    typesFile:    "modules/marketing/types/campanha.types.ts",
    primaryKey:   "id",
    externalIds:  [],
    requiredFields: ["id", "nome", "tipo", "status"],
    relationships: [
      {
        target:      "Artista",
        cardinality: "N:1",
        via:         "artista_id",
        required:    false,
        description: "Artista foco da campanha",
      },
      {
        target:      "Lancamento",
        cardinality: "N:1",
        via:         "lancamento_id",
        required:    false,
        description: "Lançamento que a campanha promove",
      },
    ],
    description:
      "Campanha de marketing: digital, impressa, outdoor, rádio, " +
      "TV, influencer, email, SMS, push, release de imprensa.",
  },
};

// ─── Helpers de acesso ao catálogo ───────────────────────────────────────────

export function getEntity(name: string): EntityDefinition | undefined {
  return ENTITY_CATALOG[name];
}

export function getAllEntities(): EntityDefinition[] {
  return Object.values(ENTITY_CATALOG);
}

export function getEntitiesByModule(moduleName: string): EntityDefinition[] {
  return getAllEntities().filter(e => e.ownerModule === moduleName);
}

export function getEntityRelationships(name: string): EntityRelationship[] {
  return ENTITY_CATALOG[name]?.relationships ?? [];
}

/**
 * Devolve todas as entidades que têm relacionamento com a entidade dada.
 * Útil para detectar dependências cross-domain.
 */
export function getRelatedEntities(name: string): string[] {
  const direct = getEntityRelationships(name).map(r => r.target);
  const reverse = getAllEntities()
    .filter(e => e.relationships.some(r => r.target === name))
    .map(e => e.name);
  return [...new Set([...direct, ...reverse])];
}

