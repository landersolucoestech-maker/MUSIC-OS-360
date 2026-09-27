import { NotFoundException } from '@nestjs/common';
import { CampaignOperationsService } from './campaigns/campaign-operations.service';
import { NotificationsService } from './notifications/notifications.service';
import { UploadsController } from './uploads/uploads.controller';
import { DatabaseContextService } from '../database/database-context.service';

// Flag-OFF session context (P2-3): passthrough → service uses the cached repo,
// preserving the pre-wiring behaviour asserted by these ownership prechecks.
const offDbContext = (ds: unknown) => new DatabaseContextService(ds as never, undefined);

function qb(result: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  };
}

describe('ownership prechecks and tenant-scoped final operations', () => {
  it('confirma upload valido usando update e retorno final escopados por tenant', async () => {
    const upload = {
      id: 'upload-row-1',
      file_id: 'file-1',
      tenant_id: 'tenant-1',
      r2_key: 'tenant-1/file-1',
      entity: 'artist',
      entity_id: 'artist-1',
      original_name: 'cover.png',
      mime_type: 'image/png',
    };
    const precheckQb = qb(upload);
    const returnQb = qb({ ...upload, status: 'confirmed' });
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(precheckQb).mockReturnValueOnce(returnQb),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const storage = { exists: jest.fn().mockResolvedValue(true) };
    const events = { emitTyped: jest.fn() };
    const ds = { getRepository: jest.fn(() => repo) };
    const controller = new UploadsController(ds as never, storage as never, events as never, {} as never);

    await controller.confirm({ id: 'tenant-1' }, { userId: 'user-1' }, 'file-1');

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'upload-row-1', tenant_id: 'tenant-1' },
      expect.objectContaining({ status: 'confirmed' }),
    );
    expect(returnQb.where).toHaveBeenCalledWith('u.id = :id AND u.tenant_id = :tenantId', {
      id: 'upload-row-1',
      tenantId: 'tenant-1',
    });
  });

  it('blocks cross-tenant confirm/download before touching storage', async () => {
    const repo = { createQueryBuilder: jest.fn(() => qb(null)) };
    const storage = {
      exists: jest.fn(),
      createDownloadUrl: jest.fn(),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const controller = new UploadsController(ds as never, storage as never, { emitTyped: jest.fn() } as never, {} as never);

    await expect(controller.confirm({ id: 'tenant-b' }, { userId: 'user-1' }, 'file-a')).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.download({ id: 'tenant-b' }, 'file-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.exists).not.toHaveBeenCalled();
    expect(storage.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('marks a notification as read using a tenant-scoped update and final read', async () => {
    const existing = { id: 'notification-1', tenant_id: 'tenant-1' };
    const precheckQb = qb(existing);
    const returnQb = qb({ ...existing, read_at: new Date() });
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(precheckQb).mockReturnValueOnce(returnQb),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const service = new NotificationsService(ds as never, null, {} as never, offDbContext(ds));

    await service.markRead('tenant-1', 'notification-1');

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'notification-1', tenant_id: 'tenant-1' },
      expect.objectContaining({ read_at: expect.any(Date) }),
    );
    expect(returnQb.where).toHaveBeenCalledWith('n.id = :id AND n.tenant_id = :tenantId', {
      id: 'notification-1',
      tenantId: 'tenant-1',
    });
  });

  it('blocks a cross-tenant notification update', async () => {
    const repo = {
      createQueryBuilder: jest.fn(() => qb(null)),
      update: jest.fn(),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const service = new NotificationsService(ds as never, null, {} as never, offDbContext(ds));

    await expect(service.markRead('tenant-b', 'notification-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('atualiza e remove campaign task/asset usando id + campaign_id + tenant_id', async () => {
    const task = { id: 'task-1', campaign_id: 'campaign-1', tenant_id: 'tenant-1', completed_at: null };
    const asset = { id: 'asset-1', campaign_id: 'campaign-1', tenant_id: 'tenant-1' };
    const tasks = {
      findOne: jest.fn().mockResolvedValueOnce(task).mockResolvedValueOnce(task).mockResolvedValueOnce(task),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const assets = {
      findOne: jest.fn().mockResolvedValue(asset),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const campaigns = {};
    const ds = {
      getRepository: jest.fn().mockReturnValueOnce(tasks).mockReturnValueOnce(assets).mockReturnValueOnce(campaigns),
    };
    const service = new CampaignOperationsService(ds as never);

    await service.updateTask('tenant-1', 'campaign-1', 'task-1', { status: 'done' } as never);
    await service.deleteTask('tenant-1', 'campaign-1', 'task-1');
    await service.deleteAsset('tenant-1', 'campaign-1', 'asset-1');

    expect(tasks.update).toHaveBeenCalledWith(
      { id: 'task-1', campaign_id: 'campaign-1', tenant_id: 'tenant-1' },
      expect.objectContaining({ status: 'done', completed_at: expect.any(Date) }),
    );
    expect(tasks.delete).toHaveBeenCalledWith({ id: 'task-1', campaign_id: 'campaign-1', tenant_id: 'tenant-1' });
    expect(assets.update).toHaveBeenCalledWith(
      { id: 'asset-1', campaign_id: 'campaign-1', tenant_id: 'tenant-1' },
      expect.objectContaining({ deleted_at: expect.any(Date) }),
    );
  });

  it('blocks cross-tenant update/delete on campaign operations', async () => {
    const tasks = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const assets = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    };
    const ds = {
      getRepository: jest.fn().mockReturnValueOnce(tasks).mockReturnValueOnce(assets).mockReturnValueOnce({}),
    };
    const service = new CampaignOperationsService(ds as never);

    await expect(service.updateTask('tenant-b', 'campaign-a', 'task-a', {} as never)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteTask('tenant-b', 'campaign-a', 'task-a')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteAsset('tenant-b', 'campaign-a', 'asset-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(tasks.update).not.toHaveBeenCalled();
    expect(tasks.delete).not.toHaveBeenCalled();
    expect(assets.update).not.toHaveBeenCalled();
  });
});
