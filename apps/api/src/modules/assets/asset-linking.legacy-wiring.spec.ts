import 'reflect-metadata';
import { AssetLinkingService } from './asset-linking.service';
import {
  AssetEntity,
  AssetVersionEntity,
  ProjectAssetEntity,
  TaskAssetEntity,
} from '../../database/entities';

/**
 * Dual-read: rows not yet backfilled by 20260930000025 may still hold guia/videoclipe/contrato.
 * The detailed views must return the canonical ids; canonical and unknown types pass through.
 */
describe('AssetLinkingService detailed views canonicalize asset_type', () => {
  const link = (assetId: string) => ({
    id: `link-${assetId}`, asset_id: assetId, role: 'reference', source_event: null, linked_by: 'u1', created_at: new Date('2026-01-01'),
  });

  function build(assetRows: Array<Record<string, unknown>>) {
    const repos = new Map<unknown, Record<string, jest.Mock>>();
    repos.set(AssetEntity, { find: jest.fn(async () => assetRows) });
    repos.set(AssetVersionEntity, { find: jest.fn(async () => []) });
    repos.set(ProjectAssetEntity, { find: jest.fn(async () => assetRows.map((a) => link(a['id'] as string))) });
    repos.set(TaskAssetEntity, { find: jest.fn(async () => assetRows.map((a) => link(a['id'] as string))) });
    const ds = { getRepository: jest.fn((e: unknown) => repos.get(e) ?? { find: jest.fn(async () => []) }) };
    return new AssetLinkingService(ds as never, { emitTyped: jest.fn() } as never, {} as never, {} as never);
  }

  const rows = [
    { id: 'a1', name: 'x', asset_type: 'guia', current_version_id: null, mime_type: 'audio/wav', status: 'active' },
    { id: 'a2', name: 'y', asset_type: 'videoclipe', current_version_id: null, mime_type: 'video/mp4', status: 'active' },
    { id: 'a3', name: 'z', asset_type: 'contrato', current_version_id: null, mime_type: 'application/pdf', status: 'active' },
    { id: 'a4', name: 'w', asset_type: 'wav', current_version_id: null, mime_type: 'audio/wav', status: 'active' },
    { id: 'a5', name: 'v', asset_type: null, current_version_id: null, mime_type: null, status: 'active' },
  ];
  const EXPECTED = ['guide_track', 'music_video', 'contract', 'wav', null];

  it('getProjectAssetsDetailed returns canonical assetType for stored legacy rows', async () => {
    const out = await build(rows).getProjectAssetsDetailed('t1', 'p1');
    expect(out.map((o) => o.assetType)).toEqual(EXPECTED);
  });

  it('getTaskAssetsDetailed returns canonical assetType for stored legacy rows', async () => {
    const out = await build(rows).getTaskAssetsDetailed('t1', 'task1');
    expect(out.map((o) => o.assetType)).toEqual(EXPECTED);
  });
});
