/**
 * modules/assets/asset-linking.service.ts
 *
 * Asset Linking Skill (real). When an upload is confirmed (asset.uploaded event):
 *   1. ensures a CENTRAL asset record (assets + asset_versions v1);
 *   2. performs a minimal classification by MIME/name (the full classification is the
 *      Asset Classification Skill, a later phase);
 *   3. links the asset to the originating project and/or task (project_assets /
 *      task_assets), idempotently;
 *   4. records usage (asset_usage_logs);
 *   5. emits asset.linked_to_project / asset.linked_to_task.
 *
 * The whole execution runs inside SkillRunService.run() → automatic persistence, logs,
 * auditing and skill.* events. Internal infrastructure, invisible
 * to the end user.
 */

import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import {
  AssetEntity,
  AssetVersionEntity,
  ProjectAssetEntity,
  TaskAssetEntity,
  AssetUsageLogEntity,
  UploadEntity,
} from '../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import type { AssetUploadedPayload } from '../../core/events/domain-events.types';
import { SkillRunService } from '../../core/skills/skill-run.service';
import { AssetClassificationService } from './asset-classification.service';
import { canonicalAssetType } from '../../common/compat/asset-type';

const PROJECT_ENTITY_ALIASES = new Set(['project', 'projeto', 'projects', 'projetos']);
const TASK_ENTITY_ALIASES = new Set(['task', 'tarefa', 'tasks', 'tarefas', 'marketing_task', 'marketing_tasks', 'audiovisual_task']);

export interface AssetLinkResult {
  assetId: string;
  linkedProjectId: string | null;
  linkedTaskId: string | null;
}

@Injectable()
export class AssetLinkingService {
  private readonly logger = new Logger(AssetLinkingService.name);
  private readonly assets: Repository<AssetEntity> | null = null;
  private readonly versions: Repository<AssetVersionEntity> | null = null;
  private readonly projectAssets: Repository<ProjectAssetEntity> | null = null;
  private readonly taskAssets: Repository<TaskAssetEntity> | null = null;
  private readonly usageLogs: Repository<AssetUsageLogEntity> | null = null;
  private readonly uploads: Repository<UploadEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly events: EventsService,
    private readonly skillRuns: SkillRunService,
    private readonly classification: AssetClassificationService,
  ) {
    if (ds) {
      this.assets = ds.getRepository(AssetEntity);
      this.versions = ds.getRepository(AssetVersionEntity);
      this.projectAssets = ds.getRepository(ProjectAssetEntity);
      this.taskAssets = ds.getRepository(TaskAssetEntity);
      this.usageLogs = ds.getRepository(AssetUsageLogEntity);
      this.uploads = ds.getRepository(UploadEntity);
    }
  }

  /** Minimal classification by MIME/name (the dedicated skill refines it later). */
  static classify(mimeType: string, fileName: string): string {
    const name = (fileName ?? '').toLowerCase();
    const mime = (mimeType ?? '').toLowerCase();
    if (mime.startsWith('audio/')) {
      if (name.includes('master')) return 'master';
      if (name.endsWith('.wav') || mime.includes('wav')) return 'wav';
      if (name.endsWith('.mp3') || mime.includes('mpeg')) return 'mp3';
      return 'audio';
    }
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf') return 'document';
    return 'unknown';
  }

  /** Processes an asset.uploaded: creates the central asset + links it to the project/task. */
  async processUpload(payload: AssetUploadedPayload): Promise<AssetLinkResult | null> {
    if (!this.assets) {
      this.logger.warn('AssetLinkingService: DATA_SOURCE unavailable — linking skipped.');
      return null;
    }

    return this.skillRuns.run<AssetLinkResult>(
      {
        tenantId: payload.tenantId,
        userId: payload.uploadedBy,
        skillName: 'asset-linking',
        entityType: 'upload',
        entityId: payload.uploadId,
        input: payload as unknown as Record<string, unknown>,
      },
      async (ctx) => {
        const upload = await this.uploads!.findOne({
          where: { id: payload.uploadId, tenant_id: payload.tenantId },
        });
        if (!upload) {
          throw new Error(`Upload "${payload.uploadId}" not found for tenant ${payload.tenantId}`);
        }

        const assetType = AssetLinkingService.classify(upload.mime_type, upload.original_name);
        await ctx.log('info', `Classified as "${assetType}"`, { assetType });

        // 1. Idempotent central asset (by upload origin/source_id).
        let asset = await this.assets!.findOne({
          where: { tenant_id: payload.tenantId, source: 'upload', source_id: payload.uploadId },
        });
        if (!asset) {
          asset = await this.assets!.save(
            this.assets!.create({
              tenant_id: payload.tenantId,
              name: upload.original_name,
              asset_type: assetType,
              mime_type: upload.mime_type,
              status: 'active',
              source: 'upload',
              source_id: payload.uploadId,
              created_by: payload.uploadedBy,
              metadata: { category: upload.category },
            }),
          );
          const version = await this.versions!.save(
            this.versions!.create({
              tenant_id: payload.tenantId,
              asset_id: asset.id,
              version: 1,
              file_url: upload.r2_key,
              mime_type: upload.mime_type,
              size_bytes: upload.size_bytes != null ? String(upload.size_bytes) : null,
              created_by: payload.uploadedBy,
            }),
          );
          await this.assets!.update({ id: asset.id }, { current_version_id: version.id });
          await ctx.log('info', 'Central asset created', { assetId: asset.id, versionId: version.id });

          // Automatic classification (dedicated skill) refines asset_type + auditing.
          const classified = await this.classification.classifyAndApply(
            payload.tenantId, asset.id, upload.mime_type, upload.original_name, upload.category, payload.uploadedBy,
          );
          asset.asset_type = classified.assetType;
          await ctx.log('info', `Classified as "${classified.assetType}"`, classified as unknown as Record<string, unknown>);
        }

        // 2. Link to project/task according to the upload's polymorphic origin.
        const entity = (upload.entity ?? payload.entityType ?? '').toLowerCase();
        const entityId = upload.entity_id ?? payload.entityId ?? null;
        let linkedProjectId: string | null = null;
        let linkedTaskId: string | null = null;

        if (entityId && PROJECT_ENTITY_ALIASES.has(entity)) {
          await this.linkAssetToProject(payload.tenantId, asset.id, entityId, {
            role: 'reference',
            sourceEvent: DOMAIN_EVENTS.ASSET_UPLOADED,
            actorId: payload.uploadedBy,
          });
          linkedProjectId = entityId;
          await ctx.log('info', 'Linked to the project', { projectId: entityId });
        } else if (entityId && TASK_ENTITY_ALIASES.has(entity)) {
          await this.linkAssetToTask(payload.tenantId, asset.id, entityId, {
            role: 'reference',
            sourceEvent: DOMAIN_EVENTS.ASSET_UPLOADED,
            actorId: payload.uploadedBy,
          });
          linkedTaskId = entityId;
          await ctx.log('info', 'Linked to the task', { taskId: entityId });
        } else {
          await this.recordUsage(payload.tenantId, asset.id, 'registered', {
            targetType: entity || null,
            targetId: entityId,
            actorId: payload.uploadedBy,
          });
          await ctx.log('info', 'Asset registered without a direct project/task link');
        }

        const result: AssetLinkResult = { assetId: asset.id, linkedProjectId, linkedTaskId };
        return { result, output: result as unknown as Record<string, unknown> };
      },
    );
  }

  /** Links an asset to a project (idempotent) + log + event. */
  async linkAssetToProject(
    tenantId: string,
    assetId: string,
    projectId: string,
    opts: { role?: string; sourceEvent?: string; actorId?: string | null } = {},
  ): Promise<void> {
    if (!this.projectAssets) return;
    const role = opts.role ?? 'reference';
    const existing = await this.projectAssets.findOne({
      where: { tenant_id: tenantId, project_id: projectId, asset_id: assetId },
    });
    if (!existing) {
      await this.projectAssets.save(
        this.projectAssets.create({
          tenant_id: tenantId,
          project_id: projectId,
          asset_id: assetId,
          role,
          source_event: opts.sourceEvent ?? null,
          linked_by: opts.actorId ?? null,
        }),
      );
    }
    await this.recordUsage(tenantId, assetId, 'linked_to_project', {
      targetType: 'project',
      targetId: projectId,
      actorId: opts.actorId ?? null,
    });
    this.events.emitTyped(DOMAIN_EVENTS.ASSET_LINKED_TO_PROJECT, {
      tenantId,
      userId: opts.actorId ?? undefined,
      aggregateType: 'asset',
      aggregateId: assetId,
      payload: {
        assetId,
        projectId,
        tenantId,
        role,
        sourceEvent: opts.sourceEvent ?? 'manual',
        linkedBy: opts.actorId ?? null,
        linkedAt: new Date().toISOString(),
      },
    });
  }

  /** Links an asset to a task (idempotent) + log + event. */
  async linkAssetToTask(
    tenantId: string,
    assetId: string,
    taskId: string,
    opts: { role?: string; sourceEvent?: string; actorId?: string | null } = {},
  ): Promise<void> {
    if (!this.taskAssets) return;
    const role = opts.role ?? 'reference';
    const existing = await this.taskAssets.findOne({
      where: { tenant_id: tenantId, task_id: taskId, asset_id: assetId },
    });
    if (!existing) {
      await this.taskAssets.save(
        this.taskAssets.create({
          tenant_id: tenantId,
          task_id: taskId,
          asset_id: assetId,
          role,
          source_event: opts.sourceEvent ?? null,
          linked_by: opts.actorId ?? null,
        }),
      );
    }
    await this.recordUsage(tenantId, assetId, 'linked_to_task', {
      targetType: 'task',
      targetId: taskId,
      actorId: opts.actorId ?? null,
    });
    this.events.emitTyped(DOMAIN_EVENTS.ASSET_LINKED_TO_TASK, {
      tenantId,
      userId: opts.actorId ?? undefined,
      aggregateType: 'asset',
      aggregateId: assetId,
      payload: {
        assetId,
        taskId,
        tenantId,
        role,
        sourceEvent: opts.sourceEvent ?? 'manual',
        linkedBy: opts.actorId ?? null,
        linkedAt: new Date().toISOString(),
      },
    });
  }

  /** Records a usage/audit entry of the asset. */
  async recordUsage(
    tenantId: string,
    assetId: string,
    action: string,
    opts: { targetType?: string | null; targetId?: string | null; actorId?: string | null; metadata?: Record<string, unknown> } = {},
  ): Promise<void> {
    if (!this.usageLogs) return;
    await this.usageLogs.save(
      this.usageLogs.create({
        tenant_id: tenantId,
        asset_id: assetId,
        action,
        target_type: opts.targetType ?? null,
        target_id: opts.targetId ?? null,
        actor_id: opts.actorId ?? null,
        metadata: opts.metadata ?? {},
      }),
    );
  }

  /** Queries the assets linked to a project (future use: Content/Scheduling). */
  async listProjectAssets(tenantId: string, projectId: string): Promise<ProjectAssetEntity[]> {
    if (!this.projectAssets) return [];
    return this.projectAssets.find({ where: { tenant_id: tenantId, project_id: projectId } });
  }

  /** Queries the assets linked to a task. */
  async listTaskAssets(tenantId: string, taskId: string): Promise<TaskAssetEntity[]> {
    if (!this.taskAssets) return [];
    return this.taskAssets.find({ where: { tenant_id: tenantId, task_id: taskId } });
  }

  /** Enriches links with the asset data + URL of the current version. */
  private async enrich(
    tenantId: string,
    links: Array<{ id: string; asset_id: string; role: string; source_event: string | null; linked_by: string | null; created_at: Date }>,
  ): Promise<LinkedAssetView[]> {
    if (!this.assets || links.length === 0) return [];
    const assetIds = Array.from(new Set(links.map((l) => l.asset_id)));
    const assets = await this.assets.find({ where: { tenant_id: tenantId, id: In(assetIds) } });
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const versionIds = assets.map((a) => a.current_version_id).filter((v): v is string => !!v);
    const versions = versionIds.length && this.versions
      ? await this.versions.find({ where: { tenant_id: tenantId, id: In(versionIds) } })
      : [];
    const versionById = new Map(versions.map((v) => [v.id, v]));

    return links.map((link) => {
      const asset = assetById.get(link.asset_id);
      const version = asset?.current_version_id ? versionById.get(asset.current_version_id) : undefined;
      return {
        linkId: link.id,
        assetId: link.asset_id,
        role: link.role,
        sourceEvent: link.source_event,
        linkedBy: link.linked_by,
        linkedAt: link.created_at,
        name: asset?.name ?? null,
        // dual-read: rows not yet backfilled by 20260930000025 may still hold guia/videoclipe/contrato
        assetType: asset?.asset_type == null ? null : (canonicalAssetType(asset.asset_type) as string),
        mimeType: asset?.mime_type ?? null,
        status: asset?.status ?? null,
        fileUrl: version?.file_url ?? null,
      };
    });
  }

  /** Project assets with details (consumer: Content/Scheduling, future UI). */
  async getProjectAssetsDetailed(tenantId: string, projectId: string): Promise<LinkedAssetView[]> {
    const links = await this.listProjectAssets(tenantId, projectId);
    return this.enrich(tenantId, links);
  }

  /** Task assets with details. */
  async getTaskAssetsDetailed(tenantId: string, taskId: string): Promise<LinkedAssetView[]> {
    const links = await this.listTaskAssets(tenantId, taskId);
    return this.enrich(tenantId, links);
  }

  /** Detail of a central asset + its versions. */
  async getAssetById(
    tenantId: string,
    assetId: string,
  ): Promise<{ asset: AssetEntity; versions: AssetVersionEntity[] } | null> {
    if (!this.assets) return null;
    const asset = await this.assets.findOne({ where: { tenant_id: tenantId, id: assetId } });
    if (!asset) return null;
    const versions = this.versions
      ? await this.versions.find({ where: { tenant_id: tenantId, asset_id: assetId }, order: { version: 'DESC' } })
      : [];
    return { asset: canonicalAssetResponse(asset), versions };
  }
}

/**
 * Dual-read of the asset classification: rows written before migration
 * 20260930000025 may still hold guia/videoclipe/contrato in `asset_type` and in
 * `metadata.classification.assetType`; the response is always canonical.
 */
export function canonicalAssetResponse(asset: AssetEntity): AssetEntity {
  const metadata = asset.metadata as Record<string, unknown> | null | undefined;
  const classification = metadata?.['classification'] as Record<string, unknown> | undefined;
  const nextMetadata =
    classification && typeof classification['assetType'] === 'string'
      ? { ...metadata, classification: { ...classification, assetType: canonicalAssetType(classification['assetType']) } }
      : metadata;
  return { ...asset, asset_type: canonicalAssetType(asset.asset_type) as string, metadata: nextMetadata } as AssetEntity;
}

/** Enriched view of an asset linked to a project/task. */
export interface LinkedAssetView {
  linkId: string;
  assetId: string;
  role: string;
  sourceEvent: string | null;
  linkedBy: string | null;
  linkedAt: Date;
  name: string | null;
  assetType: string | null;
  mimeType: string | null;
  status: string | null;
  fileUrl: string | null;
}
