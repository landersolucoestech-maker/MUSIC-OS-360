import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { EncryptionService } from '../../../core/security/encryption.service';
import { normalizeIsrc, isValidIsrc } from '../../registry/validators/registry-validators';
import { ReportEntityDefinitionService } from '../definitions/report-entity-definition.service';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import {
  contractEncryptedFields,
  contractMetadataFields,
  getReportFormContract,
  type ReportFormContract,
  type ReportRepeatingGroupSpec,
} from '../form-contracts/report-form-contracts';
import { REPEATING_GROUP_IMPORT_WRITERS } from '../computed-fields/registry';
import { ImportAuditService } from './import-audit.service';
import { ImportEngineService } from './import-engine.service';
import type { RowValidation } from './import.types';
import { FinanceCategoryRulesService } from '../../finance-category-rules/finance-category-rules.service';
import { UNCATEGORIZED_PLACEHOLDER, toRuleTransactionType } from '../../transactions/transactions.service';

export interface ImportCommitResult {
  entity: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  warnings: string[];
  errors: string[];
}

interface RowGroup {
  generalRow: RowValidation;
  itemRows: RowValidation[];
}

const MULTI_VALUE_SEPARATOR = ' | ';
const RELATION_TARGETS: Record<string, string> = {
  artist_id: 'artists',
  project_id: 'projects',
  release_id: 'releases',
  contrato_id: 'contracts',
  client_id: 'clients',
  campaign_id: 'campaigns',
};
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quote(name: string): string {
  if (!IDENT.test(name)) throw new BadRequestException(`Identificador inválido: ${name}`);
  return `"${name}"`;
}

function normalizeImportedValue(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { return JSON.parse(trimmed); } catch { return value; }
  }
  return value;
}

function groupRows(contract: ReportFormContract | null, rows: RowValidation[]): RowGroup[] {
  const repeatingGroup = contract?.repeatingGroup;
  if (!contract || !repeatingGroup) return rows.map((row) => ({ generalRow: row, itemRows: [row] }));

  const generalKeys = contract.fields.map((field) => field.key);
  const groups: RowGroup[] = [];
  let currentSignature: string | null = null;
  let current: RowGroup | null = null;

  for (const row of rows) {
    const signature = JSON.stringify(generalKeys.map((key) => row.data[key] ?? null));
    if (!current || signature !== currentSignature) {
      current = { generalRow: row, itemRows: [] };
      groups.push(current);
      currentSignature = signature;
    }
    current.itemRows.push(row);
  }
  return groups;
}

function deriveRepeatingItems(group: RowGroup, repeatingGroup: ReportRepeatingGroupSpec): unknown[] {
  const explicitItems = group.itemRows.flatMap(
    (row) => row.repeatingGroups?.[repeatingGroup.key] ?? [],
  );
  if (explicitItems.length > 0) return explicitItems;

  return group.itemRows
    .map((row) => {
      const item: Record<string, unknown> = {};
      for (const field of repeatingGroup.fields) {
        const raw = row.data[field.key];
        const text = raw === null || raw === undefined ? '' : String(raw);
        item[field.key] = field.multi
          ? text.split(MULTI_VALUE_SEPARATOR).map((part) => part.trim()).filter(Boolean)
          : (text === '' ? null : text);
      }
      return item;
    })
    .filter((item) => Object.values(item).some(
      (value) => Array.isArray(value) ? value.length > 0 : value !== null,
    ));
}

@Injectable()
export class ImportCommitService {
  constructor(
    @Inject(DATA_SOURCE) @Optional() private readonly ds: DataSource | null,
    private readonly engine: ImportEngineService,
    private readonly definitions: ReportEntityDefinitionService,
    private readonly audit: ImportAuditService,
    private readonly encryption: EncryptionService,
    @Optional() private readonly financeCategoryRules: FinanceCategoryRulesService,
  ) {}

  async commit(
    entity: string,
    file: { filename: string; content: Buffer },
    tenantId: string | undefined,
    userId: string,
  ): Promise<ImportCommitResult> {
    if (!tenantId) throw new ForbiddenException('Tenant não identificado');

    const validation = await this.engine.validateFile(entity, file, tenantId);
    const def = this.definitions.getDefinition(entity)!;
    const contract = getReportFormContract(entity);

    if (validation.errors.length > 0 || validation.invalidRows > 0) {
      const rowErrors = validation.rows
        .filter((row) => !row.valid)
        .flatMap((row) => row.errors.map((error) => `Linha ${row.index + 2}: ${error.column} — ${error.message}`));
      return {
        entity,
        totalRows: validation.totalRows,
        importedRows: 0,
        failedRows: validation.invalidRows || validation.totalRows,
        warnings: validation.warnings,
        errors: [...validation.errors, ...rowErrors],
      };
    }

    if (!this.ds) throw new ServiceUnavailableException('Banco de dados indisponível');
    const groups = groupRows(contract, validation.rows);
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

    const errors: string[] = [];
    try {
      for (const group of groups) await this.assertNotDuplicate(qr, def, contract, group.generalRow, tenantId, errors);
      for (const row of validation.rows) await this.assertRelationships(qr, def, row, tenantId, errors);
      for (const row of validation.rows) this.assertValidIsrc(def, contract, row, errors);

      if (errors.length > 0) {
        await qr.rollbackTransaction();
        this.audit.record({ userId, tenantId, entity, recordCount: validation.totalRows, successCount: 0, failureCount: validation.totalRows, status: 'rolledback' });
        return { entity, totalRows: validation.totalRows, importedRows: 0, failedRows: validation.totalRows, warnings: validation.warnings, errors };
      }

      for (const group of groups) await this.insertGroup(qr, def, contract, group, tenantId);

      await qr.commitTransaction();
      this.audit.record({ userId, tenantId, entity, recordCount: validation.totalRows, successCount: validation.totalRows, failureCount: 0, status: 'committed' });
      return { entity, totalRows: validation.totalRows, importedRows: validation.totalRows, failedRows: 0, warnings: validation.warnings, errors: [] };
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      this.audit.record({ userId, tenantId, entity, recordCount: validation.totalRows, successCount: 0, failureCount: validation.totalRows, status: 'rolledback' });
      throw error;
    } finally {
      await qr.release();
    }
  }

  private async assertNotDuplicate(
    qr: QueryRunner,
    def: ReportEntityDefinition,
    contract: ReportFormContract | null,
    row: RowValidation,
    tenantId: string,
    errors: string[],
  ): Promise<void> {
    const value = row.data[def.identityColumn];
    if (value === null || value === undefined || value === '') return;
    const identityColumn = contract?.fields.find((field) => field.key === def.identityColumn)?.physical ?? def.identityColumn;
    const found = await qr.query(
      `SELECT 1 FROM ${quote(def.tableName)} WHERE ${quote(identityColumn)} = $1 AND ${quote('tenant_id')} = $2 LIMIT 1`,
      [value, tenantId],
    );
    if (Array.isArray(found) && found.length > 0) {
      errors.push(`Linha ${row.index + 2}: já existe registro com ${def.identityColumn}="${String(value)}" (create-only).`);
    }
  }

  private async assertRelationships(
    qr: QueryRunner,
    def: ReportEntityDefinition,
    row: RowValidation,
    tenantId: string,
    errors: string[],
  ): Promise<void> {
    for (const column of def.importableColumns) {
      if (!/_id$/.test(column)) continue;
      const target = RELATION_TARGETS[column];
      if (!target) continue;
      const value = row.data[column];
      if (value === null || value === undefined || value === '') continue;
      const found = await qr.query(
        `SELECT 1 FROM ${quote(target)} WHERE ${quote('id')} = $1 AND ${quote('tenant_id')} = $2 LIMIT 1`,
        [value, tenantId],
      );
      if (!Array.isArray(found) || found.length === 0) {
        errors.push(`Linha ${row.index + 2}: relacionamento inválido ${column}="${String(value)}".`);
      }
    }
  }

  /**
   * find-fb2cfb1b: bulk import only ran the generic normalizeImportedValue
   * (trim + JSON-parse) on ISRC, never the ISRC-specific format check the
   * manual-entry path (phonograms/works services) and the registry-submission
   * flow already enforce. Runs before the insert phase, same pre-check
   * pattern as assertRelationships, so an invalid ISRC rolls back cleanly
   * with a row-scoped error instead of throwing mid-transaction.
   */
  private assertValidIsrc(
    def: ReportEntityDefinition,
    contract: ReportFormContract | null,
    row: RowValidation,
    errors: string[],
  ): void {
    for (const column of def.importableColumns) {
      const physicalColumn = contract?.fields.find((field) => field.key === column)?.physical ?? column;
      if (physicalColumn !== 'isrc') continue;
      const value = row.data[column];
      if (typeof value !== 'string' || value.trim() === '') continue;
      if (!isValidIsrc(value)) {
        errors.push(`Linha ${row.index + 2}: ISRC inválido "${value}". Formato esperado: CCXXXYYNNNNN (12 caracteres, hífens opcionais).`);
      }
    }
  }

  private async insertGroup(
    qr: QueryRunner,
    def: ReportEntityDefinition,
    contract: ReportFormContract | null,
    group: RowGroup,
    tenantId: string,
  ): Promise<void> {
    const generalKeys = contract ? contract.fields.map((field) => field.key) : def.importableColumns;
    const encryptedFields = contract ? contractEncryptedFields(contract) : {};
    const metadataFields = contract ? contractMetadataFields(contract) : {};
    const cols: string[] = [];
    const values: unknown[] = [];
    const metadataByColumn: Record<string, Record<string, unknown>> = {};
    for (const physicalColumn of new Set(Object.values(metadataFields))) metadataByColumn[physicalColumn] = {};

    for (const column of generalKeys) {
      if (!(column in group.generalRow.data)) continue;
      const rawValue = contract ? normalizeImportedValue(group.generalRow.data[column]) : group.generalRow.data[column];
      if (contract && rawValue === null) continue;

      const encryptedColumn = encryptedFields[column];
      if (encryptedColumn) {
        cols.push(encryptedColumn);
        values.push(typeof rawValue === 'string' ? this.encryption.encryptNullable(rawValue) : null);
        continue;
      }

      const metadataColumn = metadataFields[column];
      if (metadataColumn) {
        metadataByColumn[metadataColumn][column] = rawValue;
        continue;
      }

      const field = contract?.fields.find((item) => item.key === column);
      const physicalColumn = field?.physical ?? column;
      // find-fb2cfb1b: normalize to the same canonical form the manual-entry
      // path now enforces (registry-validators.ts normalizeIsrc) — format
      // validity itself was already checked in assertValidIsrc() before this
      // transaction reached the insert phase.
      if (physicalColumn === 'isrc' && typeof rawValue === 'string' && rawValue.trim() !== '') {
        cols.push(physicalColumn);
        values.push(normalizeIsrc(rawValue));
        continue;
      }
      cols.push(physicalColumn);
      values.push(rawValue);
    }

    for (const [physicalColumn, object] of Object.entries(metadataByColumn)) {
      if (Object.keys(object).length === 0) continue;
      cols.push(physicalColumn);
      values.push(object);
    }

    if (def.tableName === 'transactions') {
      await this.resolveTransactionCategoria(group.generalRow.data, cols, values, tenantId);
    }

    cols.push('tenant_id');
    values.push(tenantId);

    const repeatingGroup = contract?.repeatingGroup;
    const items = repeatingGroup ? deriveRepeatingItems(group, repeatingGroup) : [];
    const hasRepeatingItems = items.length > 0;
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const sql = `INSERT INTO ${quote(def.tableName)} (${cols.map(quote).join(', ')}) VALUES (${placeholders})` +
      (hasRepeatingItems ? ` RETURNING ${quote('id')}` : '');
    const result = await qr.query(sql, values);

    if (!repeatingGroup || !hasRepeatingItems) return;
    const insertedId = (result as Array<{ id: string }>)[0]?.id;
    if (!insertedId) throw new Error(`[reports-import] INSERT sem id retornado para grupo repetível: ${def.tableName}`);

    const writer = REPEATING_GROUP_IMPORT_WRITERS[`${def.tableName}.${repeatingGroup.key}`];
    if (!writer) throw new Error(`[reports-import] grupo repetível sem writer registrado: ${def.tableName}.${repeatingGroup.key}`);

    await writer(qr, tenantId, insertedId, items);
  }

  /**
   * `transactions.categoria` é NOT NULL sem default. A criação manual
   * (TransactionsService) já tem fallback para "outros" + auto-categorização
   * por regra (Task W); o importador XLSX não tinha nenhum dos dois — uma
   * célula vazia quebrava o INSERT. Reaproveita o mesmo
   * FinanceCategoryRulesService.suggestCategoryForTransaction usado na
   * criação manual; nunca duplica o matcher.
   */
  private async resolveTransactionCategoria(
    rowData: Record<string, unknown>,
    cols: string[],
    values: unknown[],
    tenantId: string,
  ): Promise<void> {
    const raw = rowData['categoria'];
    let categoria = (typeof raw === 'string' && raw.trim()) || UNCATEGORIZED_PLACEHOLDER;

    if (categoria.toLowerCase() === UNCATEGORIZED_PLACEHOLDER && this.financeCategoryRules) {
      const ruleType = toRuleTransactionType(rowData['tipo_transacao']);
      const descricao = rowData['descricao'];
      if (ruleType && typeof descricao === 'string' && descricao.trim()) {
        try {
          const suggestion = await this.financeCategoryRules.suggestCategoryForTransaction(tenantId, ruleType, descricao);
          if (suggestion) categoria = suggestion.categoryName;
        } catch { /* mantém o placeholder */ }
      }
    }

    const index = cols.indexOf('categoria');
    if (index >= 0) values[index] = categoria;
    else { cols.push('categoria'); values.push(categoria); }
  }
}
