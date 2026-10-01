/**
 * society-payload-builder.service.spec.ts
 *
 * Phase 5 / C6: buildWorkPayload()/buildRecordingPayload() only include shares
 * eligible for registration (share_type IS NULL, not soft-deleted); financial/
 * pending shares never enter the society submission payload.
 * shareToParty() throws BadRequestException for incomplete registration data
 * instead of silently becoming '' or 0.
 */
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SocietyPayloadBuilderService } from './society-payload-builder.service';
import { WorkEntity, PhonogramEntity, ShareEntity, ExternalIdentifierEntity } from '../../../database/entities';

function makeRepo(rows: Record<string, unknown>[]) {
  return {
    findOne: jest.fn(async (opts: { where: Record<string, unknown> }) =>
      rows.find((r) => r['id'] === opts.where['id']) ?? null),
    find: jest.fn(async () => rows),
  };
}

function makeDs(opts: {
  works?: Record<string, unknown>[];
  phonograms?: Record<string, unknown>[];
  shares?: Record<string, unknown>[];
  identifiers?: Record<string, unknown>[];
}) {
  const worksRepo = makeRepo(opts.works ?? []);
  const phonogramsRepo = makeRepo(opts.phonograms ?? []);
  const sharesRepo = makeRepo(opts.shares ?? []);
  const identifiersRepo = makeRepo(opts.identifiers ?? []);
  const map = new Map<unknown, unknown>([
    [WorkEntity, worksRepo],
    [PhonogramEntity, phonogramsRepo],
    [ShareEntity, sharesRepo],
    [ExternalIdentifierEntity, identifiersRepo],
  ]);
  return { getRepository: jest.fn((e: unknown) => map.get(e)) } as never;
}

const baseWork = { id: 'w1', tenant_id: 't1', title: 'Obra', deleted_at: null, alternative_titles: [], ai_tools: [], ai_prompts: [] };

describe('SocietyPayloadBuilderService.buildWorkPayload — share eligibility (Phase 5 / C6)', () => {
  it('includes an eligible share (share_type null, not deleted) in the payload', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({
      works: [baseWork],
      shares: [{ id: 's1', share_type: null, deleted_at: null, holder_name: 'Autor A', percentage: '100', party_role: 'author' }],
    }));
    const payload = await svc.buildWorkPayload('t1', 'w1');
    expect(payload.splits).toHaveLength(1);
    expect(payload.splits[0].name).toBe('Autor A');
  });

  it('free-text Portuguese publisher role ("Editora ...", persisted party_role is free text) is still routed to publishers; canonical roles unchanged', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({
      works: [baseWork],
      shares: [
        { id: 's1', share_type: null, deleted_at: null, holder_name: 'Autor A', percentage: '50', party_role: 'author' },
        { id: 's2', share_type: null, deleted_at: null, holder_name: 'Editora B', percentage: '30', party_role: 'Editora Musical' },
        { id: 's3', share_type: null, deleted_at: null, holder_name: 'Pub C', percentage: '20', party_role: 'publisher' },
      ],
    }));
    const payload = await svc.buildWorkPayload('t1', 'w1');
    expect(payload.publishers.map((p) => p.name).sort()).toEqual(['Editora B', 'Pub C']);
    expect(payload.authors.map((p) => p.name)).toEqual(['Autor A']);
  });

  it('excludes a financial/pending share (share_type set) from the payload', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({
      works: [baseWork],
      shares: [{ id: 's1', share_type: 'external_receivable', deleted_at: null, holder_name: 'Financeiro', percentage: '100', party_role: 'author' }],
    }));
    const payload = await svc.buildWorkPayload('t1', 'w1');
    expect(payload.splits).toHaveLength(0);
  });

  it('excludes a soft-deleted share even with share_type null', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({
      works: [baseWork],
      shares: [{ id: 's1', share_type: null, deleted_at: new Date(), holder_name: 'X', percentage: '100', party_role: 'author' }],
    }));
    const payload = await svc.buildWorkPayload('t1', 'w1');
    expect(payload.splits).toHaveLength(0);
  });

  it('mixed set: keeps only the eligible shares, with correct percentages', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({
      works: [baseWork],
      shares: [
        { id: 's1', share_type: null, deleted_at: null, holder_name: 'A', percentage: '60', party_role: 'author' },
        { id: 's2', share_type: 'external_receivable', deleted_at: null, holder_name: 'Financeiro', percentage: '999', party_role: 'author' },
        { id: 's3', share_type: null, deleted_at: null, holder_name: 'B', percentage: '40', party_role: 'author' },
      ],
    }));
    const payload = await svc.buildWorkPayload('t1', 'w1');
    expect(payload.splits.map((p) => p.name).sort()).toEqual(['A', 'B']);
    expect(payload.splits.reduce((sum, p) => sum + (p.percentage ?? 0), 0)).toBe(100);
  });

  it('throws BadRequestException when an eligible share has no holder_name (incomplete registration data)', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({
      works: [baseWork],
      shares: [{ id: 's1', share_type: null, deleted_at: null, holder_name: null, credited_name: null, percentage: '100', party_role: 'author' }],
    }));
    await expect(svc.buildWorkPayload('t1', 'w1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when an eligible share has no percentage (not coerced to 0)', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({
      works: [baseWork],
      shares: [{ id: 's1', share_type: null, deleted_at: null, holder_name: 'A', percentage: null, party_role: 'author' }],
    }));
    await expect(svc.buildWorkPayload('t1', 'w1')).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the work does not exist/was deleted', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({ works: [] }));
    await expect(svc.buildWorkPayload('t1', 'missing-work')).rejects.toThrow(NotFoundException);
  });
});

describe('SocietyPayloadBuilderService.buildRecordingPayload — share eligibility (Phase 5 / C6)', () => {
  const baseRec = { id: 'r1', tenant_id: 't1', title: 'Faixa', deleted_at: null };

  it('contributors includes only eligible shares', async () => {
    const svc = new SocietyPayloadBuilderService(makeDs({
      phonograms: [baseRec],
      shares: [
        { id: 's1', share_type: null, deleted_at: null, holder_name: 'Intérprete', percentage: '100', party_role: 'performer' },
        { id: 's2', share_type: 'external_receivable', deleted_at: null, holder_name: 'Financeiro', percentage: '100', party_role: 'author' },
      ],
    }));
    const payload = await svc.buildRecordingPayload('t1', 'r1');
    expect(payload.contributors).toHaveLength(1);
    expect(payload.contributors[0].name).toBe('Intérprete');
  });
});
