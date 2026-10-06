import 'reflect-metadata';
import { AssetLinkingService, canonicalAssetResponse } from './asset-linking.service';
import {
  AssetEntity,
  AssetVersionEntity,
  ProjectAssetEntity,
  TaskAssetEntity,
  AssetUsageLogEntity,
  UploadEntity,
} from '../../database/entities';
import type { AssetUploadedPayload } from '../../core/events/domain-events.types';

function repo(overrides: Record<string, unknown> = {}) {
  return {
    create: jest.fn((x: Record<string, unknown>) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'generated-id', ...x })),
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    update: jest.fn(async () => undefined),
    ...overrides,
  };
}

function makeDs(uploadRow: Record<string, unknown> | null) {
  const repos = new Map<unknown, ReturnType<typeof repo>>();
  repos.set(UploadEntity, repo({ findOne: jest.fn(async () => uploadRow) }));
  repos.set(AssetEntity, repo({ save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'asset-1', ...x })) }));
  repos.set(AssetVersionEntity, repo({ save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'ver-1', ...x })) }));
  repos.set(ProjectAssetEntity, repo());
  repos.set(TaskAssetEntity, repo());
  repos.set(AssetUsageLogEntity, repo());
  return {
    ds: { getRepository: jest.fn((e: unknown) => repos.get(e)) },
    repos,
  };
}

const events = () => ({ emitTyped: jest.fn() });
// AssetClassificationService fake (classification is tested in its own spec).
const classification = () => ({
  classifyAndApply: jest.fn(async () => ({ assetType: 'wav', confidence: 0.7, method: 'heuristic' })),
});
// SkillRunService fake: runs the body and returns the result.
const skillRuns = () => ({
  run: jest.fn(async (_params: unknown, fn: (ctx: { runId: string; log: () => Promise<void> }) => Promise<{ result: unknown }>) => {
    const out = await fn({ runId: 'r1', log: async () => undefined });
    return out.result;
  }),
});

const basePayload: AssetUploadedPayload = {
  uploadId: 'u1',
  tenantId: 't1',
  entityType: 'project',
  entityId: 'proj-1',
  fileName: 'master.wav',
  mimeType: 'audio/wav',
  uploadedBy: 'user-1',
  uploadedAt: new Date().toISOString(),
};

describe('AssetLinkingService.classify', () => {
  it('classifies WAV/MP3/master/image/video/document', () => {
    expect(AssetLinkingService.classify('audio/wav', 'song.wav')).toBe('wav');
    expect(AssetLinkingService.classify('audio/mpeg', 'song.mp3')).toBe('mp3');
    expect(AssetLinkingService.classify('audio/wav', 'final_master.wav')).toBe('master');
    expect(AssetLinkingService.classify('image/png', 'capa.png')).toBe('image');
    expect(AssetLinkingService.classify('video/mp4', 'reel.mp4')).toBe('video');
    expect(AssetLinkingService.classify('application/pdf', 'contrato.pdf')).toBe('document');
    expect(AssetLinkingService.classify('application/zip', 'x.zip')).toBe('unknown');
  });
});

describe('AssetLinkingService.processUpload', () => {
  const uploadRow = {
    id: 'u1',
    tenant_id: 't1',
    original_name: 'master.wav',
    mime_type: 'audio/wav',
    r2_key: 'tenant/t1/u1.wav',
    size_bytes: 1024,
    category: 'audio',
    entity: 'project',
    entity_id: 'proj-1',
    status: 'ready',
  };

  it('creates the central asset + version and links it to the project, emitting asset.linked_to_project', async () => {
    const { ds, repos } = makeDs(uploadRow);
    const ev = events();
    const svc = new AssetLinkingService(ds as never, ev as never, skillRuns() as never, classification() as never);

    const result = await svc.processUpload(basePayload);

    expect(result).toEqual({ assetId: 'asset-1', linkedProjectId: 'proj-1', linkedTaskId: null });
    expect(repos.get(AssetEntity)!.save).toHaveBeenCalled();
    expect(repos.get(AssetVersionEntity)!.save).toHaveBeenCalled();
    expect(repos.get(ProjectAssetEntity)!.save).toHaveBeenCalled();
    const emitted = ev.emitTyped.mock.calls.map((c: unknown[]) => c[0]);
    expect(emitted).toContain('asset.linked_to_project');
  });

  it('links to the task when the origin is task', async () => {
    const { ds, repos } = makeDs({ ...uploadRow, entity: 'task', entity_id: 'task-9' });
    const ev = events();
    const svc = new AssetLinkingService(ds as never, ev as never, skillRuns() as never, classification() as never);

    const result = await svc.processUpload({ ...basePayload, entityType: 'task', entityId: 'task-9' });

    expect(result).toEqual({ assetId: 'asset-1', linkedProjectId: null, linkedTaskId: 'task-9' });
    expect(repos.get(TaskAssetEntity)!.save).toHaveBeenCalled();
    const emitted = ev.emitTyped.mock.calls.map((c: unknown[]) => c[0]);
    expect(emitted).toContain('asset.linked_to_task');
  });

  it.each(['projeto', 'tarefa'])('does not link a removed Portuguese origin alias (%s): the asset is only registered', async (entity) => {
    const { ds, repos } = makeDs({ ...uploadRow, entity, entity_id: 'x-1' });
    const svc = new AssetLinkingService(ds as never, events() as never, skillRuns() as never, classification() as never);

    const result = await svc.processUpload({ ...basePayload, entityType: entity, entityId: 'x-1' });

    expect(result).toEqual({ assetId: 'asset-1', linkedProjectId: null, linkedTaskId: null });
    expect(repos.get(ProjectAssetEntity)!.save).not.toHaveBeenCalled();
    expect(repos.get(TaskAssetEntity)!.save).not.toHaveBeenCalled();
  });

  it('without DATA_SOURCE returns null (safe noop)', async () => {
    const svc = new AssetLinkingService(null, events() as never, skillRuns() as never, classification() as never);
    await expect(svc.processUpload(basePayload)).resolves.toBeNull();
  });
});

describe('AssetLinkingService.getProjectAssetsDetailed', () => {
  it('enriches the links with name/type/URL of the current version', async () => {
    const link = { id: 'pa-1', asset_id: 'asset-1', role: 'reference', source_event: 'asset.uploaded', linked_by: 'user-1', created_at: new Date() };
    const asset = { id: 'asset-1', name: 'master.wav', asset_type: 'wav', mime_type: 'audio/wav', status: 'active', current_version_id: 'ver-1' };
    const version = { id: 'ver-1', file_url: 'tenant/t1/u1.wav' };

    const repos = new Map<unknown, ReturnType<typeof repo>>();
    repos.set(ProjectAssetEntity, repo({ find: jest.fn(async () => [link]) }));
    repos.set(AssetEntity, repo({ find: jest.fn(async () => [asset]) }));
    repos.set(AssetVersionEntity, repo({ find: jest.fn(async () => [version]) }));
    repos.set(TaskAssetEntity, repo());
    repos.set(AssetUsageLogEntity, repo());
    repos.set(UploadEntity, repo());
    const ds = { getRepository: jest.fn((e: unknown) => repos.get(e)) };

    const svc = new AssetLinkingService(ds as never, events() as never, skillRuns() as never, classification() as never);
    const out = await svc.getProjectAssetsDetailed('t1', 'proj-1');

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      assetId: 'asset-1',
      name: 'master.wav',
      assetType: 'wav',
      fileUrl: 'tenant/t1/u1.wav',
      role: 'reference',
    });
  });
});

describe('canonicalAssetResponse (dual-read of legacy asset types)', () => {
  it('maps legacy asset_type and metadata.classification.assetType, keeping every other key', () => {
    const out = canonicalAssetResponse({
      id: 'a', asset_type: 'videoclipe',
      metadata: { keep: 1, classification: { assetType: 'guia', confidence: 0.7 } },
    } as never);
    expect(out.asset_type).toBe('music_video');
    expect(out.metadata).toEqual({ keep: 1, classification: { assetType: 'guide_track', confidence: 0.7 } });
  });
  it('leaves canonical rows and rows without classification untouched', () => {
    expect(canonicalAssetResponse({ asset_type: 'wav', metadata: null } as never)).toMatchObject({ asset_type: 'wav', metadata: null });
    expect(canonicalAssetResponse({ asset_type: 'contract', metadata: { classification: { assetType: 'contract' } } } as never).metadata)
      .toEqual({ classification: { assetType: 'contract' } });
  });
});

describe('AssetLinkingService.processUpload: only a verified upload becomes an asset', () => {
  const upload = (status: string) => ({
    id: 'u1', tenant_id: 't1', original_name: 'x.png', mime_type: 'image/png', r2_key: 'tenant/t1/u1.png',
    size_bytes: 10, category: 'images', entity: 'project', entity_id: 'proj-1', status,
  });
  const payload = {
    uploadId: 'u1', tenantId: 't1', entityType: 'project', entityId: 'proj-1', fileName: 'x.png',
    mimeType: 'image/png', uploadedBy: 'user-1', uploadedAt: '2026-10-06T12:00:00.000Z',
  } as AssetUploadedPayload;

  it.each(['confirmed', 'error', 'deleted', 'pending'])('does not create an asset or a link for an upload in status %s', async (status) => {
    const { ds, repos } = makeDs(upload(status));
    const ev = events();
    const runs = skillRuns();
    const svc = new AssetLinkingService(ds as never, ev as never, runs as never, classification() as never);

    expect(await svc.processUpload(payload)).toBeNull();
    expect(repos.get(AssetEntity)!.save).not.toHaveBeenCalled();
    expect(repos.get(AssetVersionEntity)!.save).not.toHaveBeenCalled();
    expect(repos.get(ProjectAssetEntity)!.save).not.toHaveBeenCalled();
    expect(ev.emitTyped).not.toHaveBeenCalled();
  });

  it('does not create an asset for an upload that does not exist', async () => {
    const { ds, repos } = makeDs(null);
    const svc = new AssetLinkingService(ds as never, events() as never, skillRuns() as never, classification() as never);
    expect(await svc.processUpload(payload)).toBeNull();
    expect(repos.get(AssetEntity)!.save).not.toHaveBeenCalled();
  });

  it('links a ready upload', async () => {
    const { ds, repos } = makeDs(upload('ready'));
    const svc = new AssetLinkingService(ds as never, events() as never, skillRuns() as never, classification() as never);
    expect(await svc.processUpload(payload)).toMatchObject({ assetId: 'asset-1', linkedProjectId: 'proj-1' });
    expect(repos.get(AssetEntity)!.save).toHaveBeenCalled();
  });
});
