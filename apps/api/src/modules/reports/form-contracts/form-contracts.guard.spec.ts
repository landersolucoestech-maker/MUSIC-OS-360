/**
 * PERMANENT GUARD — form (DTO) ↔ central contract ↔ importer.
 */
import 'reflect-metadata';
import { getMetadataStorage } from 'class-validator';
import { EntityMetadataService } from '../entity-metadata.service';
import { ReportEntityDefinitionService } from '../definitions/report-entity-definition.service';
import { tryGetFieldLabelPtBr } from '../i18n/field-labels.pt-br';
import {
  REPORT_FORM_CONTRACTS,
  contractEncryptedFields,
  contractExportableColumns,
  contractImportableColumns,
  contractMetadataFields,
} from './report-form-contracts';
import {
  REPEATING_GROUP_EXPORT_RESOLVERS,
  REPEATING_GROUP_IMPORT_WRITERS,
} from '../computed-fields/registry';

import { CreateArtistDto } from '../../artists/dto/create-artist.dto';
import { CreateWorkDto } from '../../works/dto/create-work.dto';
import { CreatePhonogramDto } from '../../phonograms/dto/create-phonogram.dto';
import { CreateContractDto } from '../../contracts/dto/create-contract.dto';
import { CreateEmployeeDto } from '../../hr/dto/create-employee.dto';
import { CreateClientDto } from '../../clients/dto/clients.dto';
import { CreateProjectDto } from '../../projects/dto/projects.dto';
import { CreateLicenseDto } from '../../licensing/dto/licensing.dto';
import { CreateReleaseDto } from '../../releases/dto/releases.dto';
import { CreateShareDto } from '../../shares/dto/shares.dto';
import { CreateAudiovisualProjectDto } from '../../audiovisual/dto/audiovisual.dto';
import { CreateEventDto } from '../../events/dto/events.dto';
import { CreateInventoryItemDto } from '../../inventory/dto/inventory.dto';
import { CreateLeadDto } from '../../leads/dto/leads.dto';
import { CreateMarketingTaskDto } from '../../marketing/dto/marketing-tasks.dto';
import { CreateMarketingContentDto } from '../../marketing/dto/marketing-contents.dto';
import { CreateBriefingDto } from '../../briefings/dto/briefings.dto';

const FORM_DTO_BY_TABLE: Record<string, new () => object> = {
  artists: CreateArtistDto,
  works: CreateWorkDto,
  phonograms: CreatePhonogramDto,
  contracts: CreateContractDto,
  employees: CreateEmployeeDto,
  clients: CreateClientDto,
  projects: CreateProjectDto,
  licenses: CreateLicenseDto,
  releases: CreateReleaseDto,
  shares: CreateShareDto,
  audiovisual_projects: CreateAudiovisualProjectDto,
  events: CreateEventDto,
  inventory_items: CreateInventoryItemDto,
  leads: CreateLeadDto,
  marketing_tasks: CreateMarketingTaskDto,
  marketing_content_posts: CreateMarketingContentDto,
  briefings: CreateBriefingDto,
};

/**
 * Temporary, auditable exceptions to the report contract. Persistence of
 * these fields remains protected by database/form-field-dto-parity.spec.ts.
 */
const REPORT_DTO_EXCLUSIONS: Record<string, Record<string, string>> = {
  licenses: {
    artist_id: 'a Central de Relatórios expõe o nome do artista; o vínculo UUID permanece validado no serviço',
    remuneration_type: 'persistido em coluna própria, ainda não incluído no layout público de Licenciamento',
    currency: 'alias de entrada para a coluna física moeda, validado pelo serviço de licenciamento',
    amount: 'alias de entrada para a coluna física valor, validado pelo serviço de licenciamento',
    percentage: 'persistido em coluna própria, ainda não incluído no layout público de Licenciamento',
  },
};

function dtoFields(dto: new () => object): string[] {
  const validationMetadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);
  return Array.from(new Set(validationMetadata.map((m) => m.propertyName)));
}

/**
 * Deprecated DTO properties (Swagger `deprecated: true`) are transitional input
 * aliases of a canonical field, normalized before persistence — never form
 * fields of their own, so they need no contract entry.
 */
function isDeprecatedDtoField(dto: new () => object, field: string): boolean {
  const meta = Reflect.getMetadata('swagger/apiModelProperties', dto.prototype, field) as { deprecated?: boolean } | undefined;
  return meta?.deprecated === true;
}

describe('form-contracts — permanent guard form ↔ contract ↔ import/export', () => {
  const metadata = new EntityMetadataService();
  const inv = metadata.scan();
  const defs = new ReportEntityDefinitionService(metadata);
  const colsByTable = new Map(
    inv.entities.map((e) => [e.tableName, new Set(e.columns.map((c) => c.name))]),
  );

  it('every table with a mapped form DTO has a registered central contract', () => {
    for (const table of Object.keys(FORM_DTO_BY_TABLE)) {
      expect(REPORT_FORM_CONTRACTS[table]).toBeDefined();
    }
  });

  it('EVERY DTO field is in the contract, in a physical alias, or in a documented exclusion', () => {
    const offenders: string[] = [];
    for (const [table, dto] of Object.entries(FORM_DTO_BY_TABLE)) {
      const contract = REPORT_FORM_CONTRACTS[table];
      const keys = new Set(contract.fields.map((f) => f.key));
      const physicalAliases = new Set(
        contract.fields.map((f) => f.physical).filter((value): value is string => Boolean(value)),
      );
      const aliases = contract.formFieldAliases ?? {};
      const reportExclusions = REPORT_DTO_EXCLUSIONS[table] ?? {};
      for (const field of dtoFields(dto)) {
        if (isDeprecatedDtoField(dto, field)) continue;
        const covered =
          keys.has(field) ||
          physicalAliases.has(field) ||
          aliases[field] !== undefined ||
          contract.excludedFormFields[field] !== undefined ||
          reportExclusions[field] !== undefined;
        if (!covered) offenders.push(`${table}.${field}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every additional exclusion references a real DTO field and has a reason', () => {
    for (const [table, exclusions] of Object.entries(REPORT_DTO_EXCLUSIONS)) {
      const fields = new Set(dtoFields(FORM_DTO_BY_TABLE[table]));
      for (const [field, reason] of Object.entries(exclusions)) {
        expect(fields.has(field)).toBe(true);
        expect(reason.trim().length).toBeGreaterThan(20);
      }
    }
  });

  it('every alias points to an existing contract key', () => {
    const offenders: string[] = [];
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      const keys = new Set(contract.fields.map((f) => f.key));
      for (const [alias, target] of Object.entries(contract.formFieldAliases ?? {})) {
        if (!keys.has(target)) offenders.push(`${table}.${alias}→${target}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every main contract column has physical backing', () => {
    const offenders: string[] = [];
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      if (table === 'accounting_summary') continue;
      const real = colsByTable.get(table);
      expect(real).toBeDefined();
      const encrypted = contractEncryptedFields(contract);
      const metaFields = contractMetadataFields(contract);
      for (const f of contract.fields) {
        const ok =
          (f.storage === 'column' && real!.has(f.physical ?? f.key)) ||
          (f.storage === 'encrypted' && encrypted[f.key] !== undefined && real!.has(encrypted[f.key])) ||
          (f.storage === 'metadata' && metaFields[f.key] !== undefined && real!.has(metaFields[f.key]));
        if (!ok) offenders.push(`${table}.${f.key} (${f.storage})`);
        if (f.storage === 'encrypted' && real!.has(f.key)) {
          offenders.push(`${table}.${f.key} (encrypted key colide com coluna física)`);
        }
      }
      const keys = contract.fields.map((x) => x.key);
      if (new Set(keys).size !== keys.length) offenders.push(`${table} (keys duplicadas)`);
    }
    expect(offenders).toEqual([]);
  });

  it('every repeating group has a registered export resolver and import writer', () => {
    const offenders: string[] = [];
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      const group = contract.repeatingGroup;
      if (!group) continue;
      const registryKey = `${table}.${group.key}`;
      if (!REPEATING_GROUP_EXPORT_RESOLVERS[registryKey]) {
        offenders.push(`${registryKey} (sem resolver de export registrado)`);
      }
      if (!REPEATING_GROUP_IMPORT_WRITERS[registryKey]) {
        offenders.push(`${registryKey} (sem writer de import registrado)`);
      }
      const mainKeys = new Set(contract.fields.map((f) => f.key));
      for (const field of group.fields) {
        if (mainKeys.has(field.key)) offenders.push(`${registryKey}.${field.key} (colide com campo principal)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('published definition = central contract', () => {
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      const def = defs.getDefinition(table);
      expect(def).not.toBeNull();
      expect(def!.exportableColumns).toEqual(contractExportableColumns(contract));
      expect(def!.importableColumns).toEqual(contractImportableColumns(contract));
      expect(def!.identityColumn).toBe(contract.identityColumn);
      const exportOnly = contract.fields.every((f) => f.importable === false);
      expect(def!.supportsImport).toBe(!exportOnly);
      expect(def!.supportsExport).toBe(true);
    }
  });

  it('no main column is sensitive/internal', () => {
    const offenders: string[] = [];
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      for (const f of contract.fields) {
        if (
          f.key === 'id' ||
          f.key === 'tenant_id' ||
          f.key === 'metadata' ||
          /_encrypted$|token|password|secret/i.test(f.key)
        ) offenders.push(`${table}.${f.key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every main and repeating column has a pt-BR label', () => {
    const offenders: string[] = [];
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      for (const f of contract.fields) {
        if (tryGetFieldLabelPtBr(f.key) === null) offenders.push(`${table}.${f.key}`);
      }
      for (const field of contract.repeatingGroup?.fields ?? []) {
        if (tryGetFieldLabelPtBr(field.key) === null) {
          offenders.push(`${table}.${contract.repeatingGroup!.key}.${field.key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('artists\' "Dados Bancários" group exports consecutively, in the form\'s visual field order (regression: "agência" must not become detached again in "Equipe e negócios")', () => {
    const keys = REPORT_FORM_CONTRACTS.artists.fields.map((f) => f.key);
    const bankGroup = ['bank_name', 'bank_branch', 'bank_account', 'pix_key', 'account_holder'];
    const indices = bankGroup.map((key) => keys.indexOf(key));
    expect(indices).toEqual(indices.slice().sort((a, b) => a - b));
    for (const [i, key] of bankGroup.entries()) {
      expect(indices[i]).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(indices[i]).toBe(indices[i - 1] + 1);
    }
  });

  it('identityColumn is a direct importable column or the contract is export-only', () => {
    for (const contract of Object.values(REPORT_FORM_CONTRACTS)) {
      const exportOnly = contract.fields.every((f) => f.importable === false);
      if (exportOnly) continue;
      const spec = contract.fields.find((f) => f.key === contract.identityColumn);
      expect(spec).toBeDefined();
      expect(spec!.storage).toBe('column');
      expect(spec!.importable !== false).toBe(true);
    }
  });
});
