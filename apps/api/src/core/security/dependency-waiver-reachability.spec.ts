/**
 * Keeps the reachability claims behind scripts/dependency-audit-waivers.json true.
 * A waiver is only valid while the vulnerable code path stays unreachable; these
 * checks fail as soon as a change makes one reachable again.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !/\.(spec|e2e-spec)\.ts$/.test(entry.name) ? [full] : [];
  });
}

function offenders(pattern: RegExp, allowed: string[] = []): string[] {
  return sourceFiles(SRC)
    .map((file) => relative(SRC, file))
    .filter((file) => !allowed.includes(file) && pattern.test(readFileSync(join(SRC, file), 'utf8')));
}

describe('dependency waiver reachability', () => {
  it('advisory 1117063 (@nestjs/core SseStream): no Server-Sent Events handler exists', () => {
    expect(offenders(/@Sse\s*\(|\bSSE_METADATA\b|\bSseStream\b|text\/event-stream/)).toEqual([]);
  });

  it('advisories 1108110/1108111 (xlsx): untrusted workbooks are read only in the isolated worker', () => {
    expect(offenders(/\bXLSX\.(read|readFile)\s*\(/, [
      join('modules', 'reports', 'import', 'xlsx-isolated-reader.ts'),
    ])).toEqual([]);
  });
});
