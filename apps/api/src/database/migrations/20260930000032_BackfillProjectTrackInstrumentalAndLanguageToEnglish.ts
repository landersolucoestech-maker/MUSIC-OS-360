import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000032_BackfillProjectTrackInstrumentalAndLanguageToEnglish (AP3 / R3-06)
 *
 * `project_tracks` (the tracks in development of a project, form fields of the Projects modal) persisted two Portuguese
 * machine values in varchar columns:
 *
 *   instrumental  varchar(10)  'sim' / 'nao'              -> 'yes' / 'no'   (the column is a free varchar form field,
 *                                                              NOT the boolean works.is_instrumental, so it keeps its type)
 *   language      varchar(50)  the web catalog slug ('portugues', 'ingles', 'chines-mandarim', ...)
 *                                                          -> the ISO 639 code of works.language ('pt', 'en', 'zh', 'zxx', 'und'...)
 *
 * EXACT, case-sensitive matches only ('nao' / 'não' for the instrumental flag). Any other text (a language typed in an
 * import, 'pt-BR', 'Português' with a capital, ...) is user content and stays byte-for-byte. Maps are a frozen copy of
 * project-track-vocabulary.ts (the spec asserts they are equal). No schema change, nothing is dropped.
 *
 * Expand/contract, backfill step: the shipped code writes the canonical values (web form, API service, DTO @Transform
 * before validation, report import) and keeps ACCEPTING and READING the legacy ones (API canonical on read, web readers,
 * report import cells); report export writes the PT-BR labels (Sim/Não, Português). The contract step (delete the legacy maps)
 * is gated on the census in findings/persisted-ap3.md returning 0.
 *
 * Rules of jsonb-row-backfill.ts: candidate rows only, idempotent, `updated_at` untouched, guarded UPDATE (a concurrent
 * edit wins), BEFORE/AFTER of the changed columns only in the locked-down side table
 * `project_track_vocabulary_backfill_20260930`, counts-only logs. down() restores BEFORE for the rows that still hold exactly
 * AFTER. The side table is kept.
 */
const MIGRATION = 'BackfillProjectTrackInstrumentalAndLanguageToEnglish20260930000032';
const LOG_TABLE = 'project_track_vocabulary_backfill_20260930';

const INSTRUMENTAL: Readonly<Record<string, string>> = { sim: 'yes', nao: 'no', 'não': 'no' };

/** legacy web slug (toLanguageSlug of the PT-BR label) -> ISO 639 code */
const LANGUAGE: Readonly<Record<string, string>> = {
  'alemao': 'de', 'amarico': 'am', 'arabe': 'ar', 'bengali': 'bn', 'chines-mandarim': 'zh', 'coreano': 'ko',
  'dinamarques': 'da', 'espanhol': 'es', 'finlandes': 'fi', 'frances': 'fr', 'grego': 'el', 'hebraico': 'he',
  'hindi': 'hi', 'holandes': 'nl', 'indonesio': 'id', 'ingles': 'en', 'ioruba': 'yo', 'italiano': 'it',
  'japones': 'ja', 'latim': 'la', 'malaio': 'ms', 'noruegues': 'no', 'persa': 'fa', 'polones': 'pl',
  'portugues': 'pt', 'punjabi': 'pa', 'russo': 'ru', 'suaili': 'sw', 'sueco': 'sv', 'tailandes': 'th', 'tamil': 'ta',
  'telugu': 'te', 'turco': 'tr', 'ucraniano': 'uk', 'urdu': 'ur', 'vietnamita': 'vi', 'zulu': 'zu',
  'cantones': 'yue', 'filipino': 'fil', 'multilingue': 'mul', 'instrumental-sem-letra': 'zxx', 'outro': 'und',
};

/** Exported for the unit spec only. */
export const PROJECT_TRACK_BACKFILL_MAPS = { INSTRUMENTAL, LANGUAGE } as const;

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Columns to change for a row, or null when it is already canonical / free text. Exported for the unit spec only. */
export function canonicalProjectTrackRowForBackfill(row: Record<string, unknown>): Record<string, unknown> | null {
  const set: Record<string, unknown> = {};
  const instrumental = row['instrumental'];
  if (typeof instrumental === 'string' && has(INSTRUMENTAL, instrumental)) set['instrumental'] = INSTRUMENTAL[instrumental];
  const language = row['language'];
  if (typeof language === 'string' && has(LANGUAGE, language)) set['language'] = LANGUAGE[language];
  return Object.keys(set).length > 0 ? set : null;
}

const q = (map: Readonly<Record<string, string>>): string => Object.keys(map).map((k) => `'${k}'`).join(', ');

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'project_tracks',
  logTable: LOG_TABLE,
  columns: ['instrumental', 'language'],
  jsonbColumns: [],
  candidatePredicate: `"instrumental" IN (${q(INSTRUMENTAL)}) OR "language" IN (${q(LANGUAGE)})`,
  transform(row) {
    const set = canonicalProjectTrackRowForBackfill(row);
    return set ? { set, conflicts: 0 } : null;
  },
};

export class BackfillProjectTrackInstrumentalAndLanguageToEnglish20260930000032 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    await backfillRows(queryRunner, SPEC);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await restoreRows(queryRunner, SPEC);
  }
}
