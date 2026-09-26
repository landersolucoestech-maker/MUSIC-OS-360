/**
 * modules/reports/entity-metadata.types.ts
 *
 * PHASE 1 — types of the Reports Center's entity-driven inventory.
 * The source of truth is the backend (TypeORM entities), never the frontend.
 */

/** Explicit, mandatory classification of every persisted entity. */
export enum EntityCategory {
  /** Operational business entity, eligible for export/import. */
  REPORTABLE = 'REPORTABLE',
  /** Operational, but not exportable by default (sub-entity, noise). */
  NOT_REPORTABLE = 'NOT_REPORTABLE',
  /** Internal domain structure (not aimed at the end user). */
  INTERNAL = 'INTERNAL',
  /** Join table / N:N. */
  JUNCTION = 'JUNCTION',
  /** Infraestrutura (logs, eventos, filas, jobs, org/tenant structure). */
  INFRA = 'INFRA',
  /** Security / RBAC / auth / audit. */
  SECURITY = 'SECURITY',
  /** Billing / subscription. */
  BILLING = 'BILLING',
  /** Internal AI infrastructure (Skills/Automations — invisible to the user). */
  AI_INTERNAL = 'AI_INTERNAL',
  /** Unclassified — the test MUST fail if this occurs. */
  UNKNOWN = 'UNKNOWN',
}

export interface ColumnMeta {
  name: string;
  /** Explicit pt-BR label (central layer). `null` when not yet translated. */
  label: string | null;
  type: string;
  nullable: boolean;
  /** Column has a DEFAULT in the schema (Postgres fills it when omitted from the INSERT). */
  hasDefault: boolean;
  primary: boolean;
  generated: boolean;
  isEnum: boolean;
  enumValues?: string[];
  isCreatedAt: boolean;
  isUpdatedAt: boolean;
  isDeletedAt: boolean;
  isTenantId: boolean;
}

export interface RelationMeta {
  property: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  target: string;
}

export interface EntityReport {
  entityName: string;
  tableName: string;
  /** The entity's pt-BR label (central i18n layer). `null` when not translated. */
  label: string | null;
  category: EntityCategory;
  reportable: boolean;
  columns: ColumnMeta[];
  relations: RelationMeta[];
  hasTenantId: boolean;
  hasSoftDelete: boolean;
  hasTimestamps: boolean;
  risks: string[];
  /**
   * The physical table exists in the database. Filled by the availability overlay
   * (controller). `undefined` when the check was not applied (e.g. a pure
   * metadata scan, without a DataSource).
   */
  available?: boolean;
}

export interface EntitiesInventory {
  totalEntities: number;
  reportableEntities: number;
  nonReportableEntities: number;
  unknownEntities: number;
  entities: EntityReport[];
}
