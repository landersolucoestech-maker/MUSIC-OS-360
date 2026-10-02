/**
 * Guard: the "share_type IS NULL means registry split" rule lives only in
 * share-eligibility.util.ts. Consumers must use isRegistryEligibleShare /
 * REGISTRY_ELIGIBLE_SHARE_SQL; a raw NULL check on share_type reintroduces the
 * duplicated rule and fails this spec.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const SRC = resolve(__dirname, '../..');
const ROOTS = [
  join(SRC, 'modules/shares'),
  join(SRC, 'modules/registry'),
  join(SRC, 'core/external-data/external-data-exchange.service.ts'),
];
const UTIL = join(SRC, 'modules/shares/share-eligibility.util.ts');

const RAW_NULL_PATTERNS: RegExp[] = [
  /share_type\s+IS\s+(NOT\s+)?NULL/i,
  /share_type\s*:\s*IsNull\s*\(/,
  /\[\s*['"]share_type['"]\s*\]\s*(===|!==|==|!=)\s*null\b/,
  /\bshare_type\s*(===|!==|==|!=)\s*null\b/,
];

function listTs(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((n) => listTs(join(path, n)));
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function findRawShareTypeNullChecks(source: string): string[] {
  const code = stripComments(source);
  return RAW_NULL_PATTERNS.filter((re) => re.test(code)).map((re) => re.source);
}

describe('share_type NULL rule is centralized in share-eligibility.util.ts', () => {
  const files = ROOTS.flatMap(listTs).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && f !== UTIL,
  );

  it('scans the consumer files', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))('%s has no raw share_type NULL check', (_n, f) => {
    expect(findRawShareTypeNullChecks(readFileSync(f, 'utf8'))).toEqual([]);
  });

  it('detects reintroduced raw checks (detector self-test)', () => {
    expect(findRawShareTypeNullChecks("qb.andWhere('s.share_type IS NULL')")).toHaveLength(1);
    expect(findRawShareTypeNullChecks('find({ where: { share_type: IsNull() } })')).toHaveLength(1);
    expect(findRawShareTypeNullChecks("const e = cols['share_type'] === null;")).toHaveLength(1);
    expect(findRawShareTypeNullChecks('return s.share_type === null;')).toHaveLength(1);
    expect(findRawShareTypeNullChecks('// share_type IS NULL in a comment only')).toEqual([]);
    expect(findRawShareTypeNullChecks('.andWhere(REGISTRY_ELIGIBLE_SHARE_SQL)')).toEqual([]);
  });
});
