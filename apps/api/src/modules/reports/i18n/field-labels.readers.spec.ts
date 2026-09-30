import { execFileSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import * as ts from 'typescript';
import { EntityMetadataService } from '../entity-metadata.service';
import { ReportEntityDefinitionService } from '../definitions/report-entity-definition.service';
import { REPORT_FORM_CONTRACTS } from '../form-contracts/report-form-contracts';
import { normalizeFieldKey } from './field-labels.pt-br';

/**
 * Every dictionary key whose technical name is Portuguese is legacy and must document
 * the reader that keeps it alive (`// reader: <kinds>` on its line in field-labels.pt-br.ts).
 * The claim is verified here, so a key nobody reads cannot survive and a new Portuguese
 * key cannot be added without a reader.
 *
 * Portuguese detection is the technical-naming census lexicon itself (scripts/naming/pt-lexicon.mjs),
 * not a second copy of it.
 */
type ReaderKind = 'entity-column' | 'report-contract' | 'request-field';
const READER_KINDS: readonly ReaderKind[] = ['entity-column', 'report-contract', 'request-field'];

const SRC_ROOT = resolve(__dirname, '../../..');
const DICTIONARY_FILE = join(__dirname, 'field-labels.pt-br.ts');
const PT_LEXICON = resolve(SRC_ROOT, '../../../scripts/naming/pt-lexicon.mjs');

interface DictionaryEntry { key: string; line: number; readers: string[] }

export function parseDictionary(source: string): DictionaryEntry[] {
  const entries: DictionaryEntry[] = [];
  source.split('\n').forEach((text, index) => {
    const match = /^ {2}([A-Za-z0-9_]+): .*,(?: \/\/ reader: ([a-z -]+))?$/.exec(text);
    if (match) entries.push({ key: match[1], line: index + 1, readers: match[2] ? match[2].trim().split(/\s+/) : [] });
  });
  return entries;
}

function portugueseKeys(keys: string[]): Set<string> {
  const script = `
    import { ptWords } from ${JSON.stringify(`file://${PT_LEXICON}`)};
    const keys = JSON.parse(process.argv[1]);
    process.stdout.write(JSON.stringify(keys.filter((k) => ptWords(k).length > 0)));
  `;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify(keys)], { encoding: 'utf8' });
  return new Set(JSON.parse(out) as string[]);
}

/** Problems of a dictionary source: Portuguese keys without a (valid, verified) reader. */
export function readerProblems(
  source: string,
  isPortuguese: (keys: string[]) => Set<string>,
  verify: (kind: ReaderKind, key: string) => boolean,
): string[] {
  const entries = parseDictionary(source);
  const pt = isPortuguese(entries.map((e) => e.key));
  const problems: string[] = [];
  for (const entry of entries) {
    if (!pt.has(entry.key)) {
      if (entry.readers.length) problems.push(`${entry.key} (line ${entry.line}): English key must not carry a reader tag`);
      continue;
    }
    if (!entry.readers.length) {
      problems.push(`${entry.key} (line ${entry.line}): Portuguese key has no documented reader`);
      continue;
    }
    for (const kind of entry.readers) {
      if (!(READER_KINDS as readonly string[]).includes(kind)) problems.push(`${entry.key}: unknown reader kind "${kind}"`);
      else if (!verify(kind as ReaderKind, entry.key)) problems.push(`${entry.key}: claimed reader "${kind}" does not reach it`);
    }
  }
  return problems;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) sourceFiles(full, out);
    else if (/\.ts$/.test(item.name) && !/\.(spec|test)\.ts$/.test(item.name)) out.push(full);
  }
  return out;
}

/** Identifier and string-literal names (comments excluded) of files that declare request fields. */
function requestFieldNames(): Set<string> {
  const names = new Set<string>();
  for (const file of sourceFiles(SRC_ROOT)) {
    if (file === DICTIONARY_FILE || file.includes(`${join(SRC_ROOT, 'database', 'migrations')}`)) continue;
    const text = readFileSync(file, 'utf8');
    if (!/class-validator|from 'zod'|DEPRECATED_/.test(text)) continue;
    const visit = (node: ts.Node): void => {
      if ((ts.isIdentifier(node) || ts.isStringLiteral(node)) && /^[A-Za-z][A-Za-z0-9_-]*$/.test(node.text)) {
        names.add(normalizeFieldKey(node.text));
      }
      ts.forEachChild(node, visit);
    };
    visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  }
  return names;
}

describe('field-labels.pt-br — every Portuguese-named key has a documented, verified reader', () => {
  const metadata = new EntityMetadataService();
  const entityColumns = new Set(metadata.scan().entities.flatMap((e) => e.columns.map((c) => normalizeFieldKey(c.name))));
  const contractIds = new Set<string>();
  for (const d of new ReportEntityDefinitionService(metadata).getDefinitions()) {
    for (const id of [d.identityColumn, d.displayColumn, d.dateColumn, ...d.exportableColumns, ...d.importableColumns,
      ...d.filterableColumns, ...d.sortableColumns, ...d.searchableColumns, ...d.sensitiveColumns, ...d.requiredImportColumns]) {
      if (id) contractIds.add(normalizeFieldKey(id));
    }
  }
  for (const c of Object.values(REPORT_FORM_CONTRACTS)) {
    const ids = [c.identityColumn, ...c.fields.flatMap((f) => [f.key, ...(f.physical ? [f.physical] : [])]),
      ...(c.repeatingGroup ? [c.repeatingGroup.key, ...c.repeatingGroup.fields.map((f) => f.key)] : []),
      ...(c.extraSortableColumns ?? []), ...(c.extraFilterableColumns ?? []), ...(c.filterableColumns ?? []), ...(c.searchableColumns ?? []),
      ...Object.keys(c.excludedFormFields ?? {}), ...Object.keys(c.formFieldAliases ?? {}), ...Object.values(c.formFieldAliases ?? {}),
      ...Object.keys(c.deprecatedColumnAliases ?? {}), ...Object.values(c.deprecatedColumnAliases ?? {})];
    for (const id of ids) contractIds.add(normalizeFieldKey(id));
  }
  const requestFields = requestFieldNames();
  const verify = (kind: ReaderKind, key: string): boolean =>
    kind === 'entity-column' ? entityColumns.has(key) : kind === 'report-contract' ? contractIds.has(key) : requestFields.has(key);

  it('the real dictionary has no undocumented, unknown or unreachable Portuguese key', () => {
    expect(readerProblems(readFileSync(DICTIONARY_FILE, 'utf8'), portugueseKeys, verify)).toEqual([]);
  });

  it('negative: a legacy key with no reader, a false claim and an unknown kind are all reported', () => {
    // The Portuguese classifier is injected, so the synthetic keys stay neutral.
    const source = [
      "  legacyOk: 'A', // reader: report-contract",
      "  legacyNoReader: 'B',",
      "  englishKey: 'C',",
      "  legacyFalseClaim: 'D', // reader: entity-column",
      "  legacyUnknownKind: 'E', // reader: nowhere",
    ].join('\n');
    const classify = (): Set<string> => new Set(['legacyOk', 'legacyNoReader', 'legacyFalseClaim', 'legacyUnknownKind']);
    const problems = readerProblems(source, classify, (kind, key) => kind === 'report-contract' && key === 'legacyOk');
    expect(problems).toEqual([
      'legacyNoReader (line 2): Portuguese key has no documented reader',
      'legacyFalseClaim: claimed reader "entity-column" does not reach it',
      'legacyUnknownKind: unknown reader kind "nowhere"',
    ]);
  });
});
