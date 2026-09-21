import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import {
  WorkEntity,
  PhonogramEntity,
  ShareEntity,
  SocietyValidationErrorEntity,
} from '../../../database/entities';
import { RegistrableEntityType, SocietyValidationSeverity } from '@music-os-360/types';
import { WorkRegistryValidationService, RecordingRegistryValidationService } from './entity-validators';
import type { RegistryValidationIssue, RegistryValidationResult } from '../payloads/registry-payload.types';

@Injectable()
export class SocietyValidationService {
  private readonly works: Repository<WorkEntity> | null = null;
  private readonly phonograms: Repository<PhonogramEntity> | null = null;
  private readonly shares: Repository<ShareEntity> | null = null;
  private readonly errors: Repository<SocietyValidationErrorEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly workValidator: WorkRegistryValidationService,
    private readonly recordingValidator: RecordingRegistryValidationService,
  ) {
    if (ds) {
      this.works = ds.getRepository(WorkEntity);
      this.phonograms = ds.getRepository(PhonogramEntity);
      this.shares = ds.getRepository(ShareEntity);
      this.errors = ds.getRepository(SocietyValidationErrorEntity);
    }
  }

  private assertDb(): void {
    if (!this.works || !this.phonograms || !this.shares || !this.errors) {
      throw new BadRequestException('Database unavailable');
    }
  }

  async loadWorkWithShares(tenantId: string, workId: string): Promise<{ work: WorkEntity; shares: ShareEntity[] }> {
    this.assertDb();
    const work = await this.works!.findOne({ where: { id: workId, tenant_id: tenantId } });
    if (!work || work.deleted_at) throw new NotFoundException('Obra não encontrada');
    const shares = await this.shares!.find({ where: { tenant_id: tenantId, work_id: workId } });
    return { work, shares };
  }

  async loadRecordingWithShares(tenantId: string, recordingId: string): Promise<{ recording: PhonogramEntity; shares: ShareEntity[] }> {
    this.assertDb();
    const recording = await this.phonograms!.findOne({ where: { id: recordingId, tenant_id: tenantId } });
    if (!recording || recording.deleted_at) throw new NotFoundException('Fonograma não encontrado');
    const shares = await this.shares!.find({ where: { tenant_id: tenantId, phonogram_id: recordingId } });
    return { recording, shares };
  }

  async validateWork(tenantId: string, workId: string, submissionId?: string): Promise<RegistryValidationResult> {
    const { work, shares } = await this.loadWorkWithShares(tenantId, workId);
    const issues = this.workValidator.validate(work, shares);
    return this.persistAndSummarise(tenantId, RegistrableEntityType.WORK, workId, submissionId ?? null, issues);
  }

  async validateRecording(tenantId: string, recordingId: string, submissionId?: string): Promise<RegistryValidationResult> {
    const { recording, shares } = await this.loadRecordingWithShares(tenantId, recordingId);
    const issues = this.recordingValidator.validate(recording, shares);
    return this.persistAndSummarise(tenantId, RegistrableEntityType.RECORDING, recordingId, submissionId ?? null, issues);
  }

  private async persistAndSummarise(
    tenantId: string,
    entityType: RegistrableEntityType,
    entityId: string,
    submissionId: string | null,
    issues: RegistryValidationIssue[],
  ): Promise<RegistryValidationResult> {
    this.assertDb();
    // Replace the previous validation snapshot for this entity/submission scope.
    await this.errors!
      .createQueryBuilder()
      .delete()
      .where('tenant_id = :tenantId AND entity_type = :et AND entity_id = :eid', { tenantId, et: entityType, eid: entityId })
      .andWhere(submissionId ? 'submission_id = :sid' : 'submission_id IS NULL', submissionId ? { sid: submissionId } : {})
      .execute();

    if (issues.length > 0) {
      await this.errors!.save(
        issues.map((i) =>
          this.errors!.create({
            tenant_id: tenantId,
            submission_id: submissionId,
            entity_type: entityType,
            entity_id: entityId,
            severity: i.severity,
            field_path: i.field_path,
            code: i.code,
            message: i.message,
          }),
        ),
      );
    }

    const errorCount = issues.filter((i) => i.severity === SocietyValidationSeverity.ERROR).length;
    const warningCount = issues.filter((i) => i.severity === SocietyValidationSeverity.WARNING).length;
    return { entityType, entityId, valid: errorCount === 0, errorCount, warningCount, issues };
  }
}
