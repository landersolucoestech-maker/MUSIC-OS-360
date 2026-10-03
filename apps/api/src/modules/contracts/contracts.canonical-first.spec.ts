import 'reflect-metadata';
import { ContractsService } from './contracts.service';

/**
 * Canonical-first reads of the write payload: the deprecated names a pre-canonical web build still sends
 * (`exclusivo`, `versoes`) are read ONLY when the canonical name is absent (CZ-026 compatibility window).
 */
const build = (dto: Record<string, unknown>) =>
  (Object.create(ContractsService.prototype) as unknown as {
    buildEntityPayload(d: Record<string, unknown>, r: Record<string, unknown>): Record<string, unknown>;
  }).buildEntityPayload(dto, {});

describe('ContractsService.buildEntityPayload: canonical name wins over the deprecated spelling', () => {
  it('exclusive: the canonical value wins, the deprecated one is a fallback only', () => {
    expect(build({ exclusive: false, exclusivo: true })['exclusive']).toBe(false);
    expect(build({ exclusive: true, exclusivo: false })['exclusive']).toBe(true);
    expect(build({ exclusivo: true })['exclusive']).toBe(true);
    expect(build({})['exclusive']).toBe(false);
  });

  it('versions: the canonical list wins, the deprecated list is a fallback only', () => {
    const canonical = [{ version: 1, date: '2026-01-01', description: 'canonical' }];
    const legacy = [{ version: 9, date: '2025-01-01', description: 'legacy' }];
    const both = build({ versions: canonical, versoes: legacy })['versions'] as Array<Record<string, unknown>>;
    expect(JSON.stringify(both)).toContain('canonical');
    expect(JSON.stringify(both)).not.toContain('legacy');
    expect(JSON.stringify(build({ versoes: legacy })['versions'])).toContain('legacy');
    expect(build({})['versions']).toEqual([]);
  });
});
