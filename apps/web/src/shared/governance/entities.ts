/**
 * shared/governance/entities.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Canonical Catalog of Entities and Relationships
 *
 * Single source of truth for:
 *   - Every domain entity
 *   - Mandatory and optional fields
 *   - Relationships (cardinality and direction)
 *   - Owning module of each entity
 *   - Location of the TypeScript types
 *   - External identity fields (ISRC, ISWC, CNPJ, etc.)
 *
 * RULE: any new domain entity must be registered here
 *        before it is implemented in the modules.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Catalog types ────────────────────────────────────────────────────────────

export type RelationshipCardinality =
  | "1:1"    // one to one
  | "1:N"    // one to many
  | "N:1"    // many to one
  | "N:N";   // many to many

export interface EntityRelationship {
  /** Target entity of the relationship */
  target: string;
  /** Cardinality */
  cardinality: RelationshipCardinality;
  /** Field(s) implementing the relationship */
  via: string;
  /** Mandatory relationship? */
  required: boolean;
  /** Relationship description */
  description: string;
}

export interface EntityDefinition {
  /** Entity name (PascalCase; the current catalog uses Portuguese entity names) */
  name: string;
  /** Owning module (source of the types and services) */
  ownerModule: string;
  /** Location of the types file */
  typesFile: string;
  /** Primary key */
  primaryKey: string;
  /** External identification fields (industry standards) */
  externalIds: string[];
  /** Mandatory fields on creation */
  requiredFields: string[];
  /** Relationships with other entities */
  relationships: EntityRelationship[];
  /** Short description */
  description: string;
}

// ─── Entity catalog ───────────────────────────────────────────────────────────

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
        description: "Active contract linked to the artist",
      },
      {
        target:      "Obra",
        cardinality: "N:N",
        via:         "Share.artista_id",
        required:    false,
        description: "Participation in works via composition shares",
      },
      {
        target:      "Lancamento",
        cardinality: "N:N",
        via:         "Lancamento.artista_ids[]",
        required:    false,
        description: "Artists participating in a release",
      },
      {
        target:      "ArtistaRelacionamento",
        cardinality: "1:N",
        via:         "relacionamentos[]",
        required:    false,
        description: "Manager, label, publisher, booker, legal, etc.",
      },
    ],
    description:
      "Central entity of the system. Represents a music artist: " +
      "solo, band, duo, trio, group or collective. " +
      "Aggregates profile, tax data, relationships, " +
      "platform metrics and contract history.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATALOG MODULE
  // ══════════════════════════════════════════════════════════════════════════

  Obra: {
    name:         "Obra",
    ownerModule:  "catalog",
    typesFile:    "modules/catalog/types/obra.types.ts",
    primaryKey:   "id",
    externalIds:  ["iswc", "ecad_code", "society_code"],
    requiredFields: ["id", "titulo"],
    relationships: [
      {
        target:      "Fonograma",
        cardinality: "1:N",
        via:         "Fonograma.obra_id",
        required:    false,
        description: "Recordings (sound recordings) of the work",
      },
      {
        target:      "Share",
        cardinality: "1:N",
        via:         "Share.obra_id",
        required:    false,
        description: "Composition participations (copyright splits)",
      },
      {
        target:      "Licenca",
        cardinality: "1:N",
        via:         "Licenca.obra_id",
        required:    false,
        description: "Usage licenses of the work",
      },
    ],
    description:
      "Musical composition (lyrics + melody). Identified by ISWC. " +
      "May have multiple sound recordings. " +
      "Managed by ECAD / UBC for collection purposes.",
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
        description: "Work of which this sound recording is a recording",
      },
      {
        target:      "Lancamento",
        cardinality: "N:N",
        via:         "Lancamento.fonograma_ids[]",
        required:    false,
        description: "Releases that include this sound recording",
      },
      {
        target:      "Share",
        cardinality: "1:N",
        via:         "Share.phonogram_id",
        required:    false,
        description: "Master participations (neighboring-rights splits)",
      },
    ],
    description:
      "Specific recording of a work. Identified by ISRC. " +
      "May appear in multiple releases. " +
      "Reference point for ECAD and Content ID claims.",
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
        description: "Work this composition share belongs to",
      },
      {
        target:      "Fonograma",
        cardinality: "N:1",
        via:         "phonogram_id",
        required:    false,
        description: "Sound recording this master share belongs to",
      },
      {
        target:      "Artista",
        cardinality: "N:1",
        via:         "artista_id",
        required:    false,
        description: "Artist holding the share",
      },
    ],
    description:
      "Percentage participation in the rights of a work or sound recording. " +
      "Types: composition, master, publishing, performance, synchronization. " +
      "Direction: inbound (receives) or outbound (pays).",
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
        description: "Main artists of the release",
      },
      {
        target:      "Fonograma",
        cardinality: "N:N",
        via:         "fonograma_ids[]",
        required:    false,
        description: "Sound recordings included in the release",
      },
    ],
    description:
      "Commercial music product: single, EP, album, compilation, live. " +
      "Aggregates sound recordings, defines the distributor, distribution platforms, " +
      "delivery and publication dates.",
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
        description: "Main artist of the contract",
      },
      {
        target:      "Cliente",
        cardinality: "N:1",
        via:         "cliente_id",
        required:    false,
        description: "Client / counterparty of the contract",
      },
    ],
    description:
      "Legal contract: exclusive, non-exclusive, licensing, " +
      "distribution, production, representation, partnership, services, management. " +
      "Digital signature support via Autentique.",
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
        description: "Contracts generated from this template",
      },
    ],
    description:
      "Reusable template for contract generation. " +
      "Supports dynamic variables ({{artista}}, {{valor}}, etc.). " +
      "Versioned and categorized by contract type.",
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
        description: "Artist linked to the transaction (P&L per artist)",
      },
      {
        target:      "Projeto",
        cardinality: "N:1",
        via:         "projeto_id",
        required:    false,
        description: "Linked project (P&L per project, recoupment)",
      },
      {
        target:      "NotaFiscal",
        cardinality: "N:1",
        via:         "nota_fiscal_id",
        required:    false,
        description: "Invoice associated with the transaction",
      },
    ],
    description:
      "Financial transaction: revenue or expense. " +
      "Basis of the P&L, cash flow and OFX reconciliation. " +
      "Categories include 'recebimentos externos de direitos' only as a label — " +
      "It is NOT a separate product domain.",
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
        description: "Transactions linked to this invoice",
      },
      {
        target:      "Cliente",
        cardinality: "N:1",
        via:         "cliente_id",
        required:    false,
        description: "Invoice recipient",
      },
    ],
    description:
      "Invoice for services or products: NFS-e, NF-e, NFC-e, receipt. " +
      "Flow: draft → pending → issued → canceled / rejected.",
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
        description: "Contracts in which this client is the counterparty",
      },
      {
        target:      "Lead",
        cardinality: "1:N",
        via:         "Lead.cliente_id",
        required:    false,
        description: "Leads originated from this client",
      },
      {
        target:      "Contato",
        cardinality: "1:N",
        via:         "Contato.cliente_id",
        required:    false,
        description: "Contacts associated with this client",
      },
    ],
    description:
      "Client or business partner: label, publisher, agency, " +
      "brand, producer, media outlet. " +
      "May be an individual or a legal entity.",
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
        description: "Existing client the lead originated from",
      },
      {
        target:      "Artista",
        cardinality: "N:1",
        via:         "artista_id",
        required:    false,
        description: "Target artist of this opportunity",
      },
    ],
    description:
      "Business opportunity in sales prospecting. " +
      "Status: new → in contact → proposal → negotiation → closed/lost. " +
      "Temperature: hot, warm, cold.",
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
        description: "Artists participating in the event",
      },
      {
        target:      "Projeto",
        cardinality: "N:1",
        via:         "projeto_id",
        required:    false,
        description: "Project the event belongs to",
      },
    ],
    description:
      "Live or studio event: show, festival, recording, " +
      "music video, rehearsal, meeting, workshop, release, live, streaming.",
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
        description: "Main artist of the project",
      },
      {
        target:      "Transacao",
        cardinality: "1:N",
        via:         "Transacao.projeto_id",
        required:    false,
        description: "Project transactions (P&L and recoupment)",
      },
      {
        target:      "Evento",
        cardinality: "1:N",
        via:         "Evento.projeto_id",
        required:    false,
        description: "Events linked to the project",
      },
    ],
    description:
      "Music project with a dedicated P&L and recoupment tracking. " +
      "Types: album, EP, single, music video, show, tour, campaign, podcast.",
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
      "Inventory item: studio equipment, instrument, " +
      "PA/lighting equipment, vehicle. " +
      "State: available, in use, maintenance, lent, discarded.",
  },

  Funcionario: {
    name:         "Funcionario",
    ownerModule:  "rh",
    typesFile:    "modules/hr/types/hr.types.ts",
    primaryKey:   "id",
    externalIds:  ["cpf", "pis", "ctps"],
    requiredFields: ["id", "nome", "cargo", "tipo_contrato"],
    relationships: [
      {
        target:      "FeriasAusencia",
        cardinality: "1:N",
        via:         "FeriasAusencia.funcionario_id",
        required:    false,
        description: "Employee vacation and absence periods",
      },
    ],
    description:
      "Company staff member: CLT, PJ, self-employed, intern, temporary. " +
      "Management of position, department, salary, hiring and termination.",
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
        description: "Work whose use is being disputed",
      },
      {
        target:      "Fonograma",
        cardinality: "N:1",
        via:         "fonograma_id",
        required:    false,
        description: "Sound recording whose use is being disputed",
      },
    ],
    description:
      "Request to remove unauthorized content. " +
      "Platforms: YouTube, TikTok, Instagram, Spotify, etc. " +
      "Status: pending → sent → processing → completed / rejected / failed.",
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
        description: "Licensed work",
      },
      {
        target:      "Cliente",
        cardinality: "N:1",
        via:         "cliente_id",
        required:    false,
        description: "Licensee (who receives the usage right)",
      },
      {
        target:      "Contrato",
        cardinality: "N:1",
        via:         "contrato_id",
        required:    false,
        description: "Associated license contract",
      },
    ],
    description:
      "Work usage license: synchronization, mechanical, performance, " +
      "print, digital, streaming. Territories, term and fee per use.",
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
        description: "Artist the campaign focuses on",
      },
      {
        target:      "Lancamento",
        cardinality: "N:1",
        via:         "lancamento_id",
        required:    false,
        description: "Release the campaign promotes",
      },
    ],
    description:
      "Marketing campaign: digital, print, outdoor, radio, " +
      "TV, influencer, email, SMS, push, press release.",
  },
};

// ─── Catalog access helpers ───────────────────────────────────────────────────

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
 * Returns every entity that has a relationship with the given entity.
 * Useful to detect cross-domain dependencies.
 */
export function getRelatedEntities(name: string): string[] {
  const direct = getEntityRelationships(name).map(r => r.target);
  const reverse = getAllEntities()
    .filter(e => e.relationships.some(r => r.target === name))
    .map(e => e.name);
  return [...new Set([...direct, ...reverse])];
}

