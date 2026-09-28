/**
 * Registry of the resolvers and writers for repeatable groups flattened into
 * rows of the same XLSX sheet.
 */
import type { DataSource, QueryRunner } from 'typeorm';
import {
  fetchProjectTracksForExport,
  insertProjectTracksForImport,
} from './project-tracks.field';
import {
  fetchReleaseTracksForExport,
  writeReleaseTracksForImport,
} from './release-tracks.field';
import {
  makeRowEmbeddedRepeatingGroupExportResolver,
  makeRowEmbeddedRepeatingGroupImportWriter,
} from './row-embedded-repeating-group';

export type RepeatingGroupExportResolver = (
  dataSource: DataSource,
  tenantId: string,
  parentIds: string[],
) => Promise<Map<string, Record<string, unknown>[]>>;

export type RepeatingGroupImportWriter = (
  queryRunner: QueryRunner,
  tenantId: string,
  parentId: string,
  items: unknown,
) => Promise<void>;

const invoiceItems = {
  tableName: 'invoices',
  jsonColumn: 'items',
  arrayKey: null,
} as const;
const eventParticipants = {
  tableName: 'events',
  jsonColumn: 'participants',
  arrayKey: null,
} as const;

export const REPEATING_GROUP_EXPORT_RESOLVERS: Record<string, RepeatingGroupExportResolver> = {
  'projects.tracks': fetchProjectTracksForExport as unknown as RepeatingGroupExportResolver,
  'releases.faixas': fetchReleaseTracksForExport as unknown as RepeatingGroupExportResolver,
  'invoices.items': makeRowEmbeddedRepeatingGroupExportResolver(invoiceItems),
  'events.participants': makeRowEmbeddedRepeatingGroupExportResolver(eventParticipants),
};

export const REPEATING_GROUP_IMPORT_WRITERS: Record<string, RepeatingGroupImportWriter> = {
  'projects.tracks': insertProjectTracksForImport,
  'releases.faixas': writeReleaseTracksForImport,
  'invoices.items': makeRowEmbeddedRepeatingGroupImportWriter(invoiceItems),
  'events.participants': makeRowEmbeddedRepeatingGroupImportWriter(eventParticipants),
};
