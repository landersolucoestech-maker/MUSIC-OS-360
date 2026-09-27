import { Injectable, BadRequestException } from '@nestjs/common';
import {
  RegistrableEntityType,
  SocietyDriver,
  SocietyName,
  SocietySubmissionStatus,
} from '@music-os-360/types';
import { SocietyValidationService } from './validation/society-validation.service';
import { AbramusPayloadBuilderService } from './payloads/abramus-payload-builder.service';
import { SocietySubmissionService } from './society/society-submission.service';
import { SocietyAdapterRegistry } from './adapters/society-adapter.registry';
import type { ExportFormat, ExportResult } from './adapters/society-adapter.contract';
import type { RegistryValidationResult } from './payloads/registry-payload.types';
import type { PrepareSubmissionDto, SubmitToSocietyDto } from './dto/operations.dto';
import type { SocietySubmissionResult } from './adapters/society-adapter.contract';

/**
 * Orchestrates the registry flow on top of the building blocks:
 * validate → prepare (submission + immutable snapshot) → export.
 * `submit`/`sync` (driver-dependent) land in the next phase.
 */
@Injectable()
export class RegistryOperationsService {
  constructor(
    private readonly validation: SocietyValidationService,
    private readonly abramus: AbramusPayloadBuilderService,
    private readonly submissions: SocietySubmissionService,
    private readonly adapters: SocietyAdapterRegistry,
  ) {}

  validateWork(tenantId: string, workId: string): Promise<RegistryValidationResult> {
    return this.validation.validateWork(tenantId, workId);
  }

  validateRecording(tenantId: string, recordingId: string): Promise<RegistryValidationResult> {
    return this.validation.validateRecording(tenantId, recordingId);
  }

  async prepareWork(tenantId: string, userId: string, workId: string, opts: PrepareSubmissionDto) {
    await this.validation.loadWorkWithShares(tenantId, workId); // 404 if missing
    return this.prepare(tenantId, userId, RegistrableEntityType.WORK, workId, opts, (sid) =>
      this.validation.validateWork(tenantId, workId, sid),
    );
  }

  async prepareRecording(tenantId: string, userId: string, recordingId: string, opts: PrepareSubmissionDto) {
    await this.validation.loadRecordingWithShares(tenantId, recordingId); // 404 if missing
    return this.prepare(tenantId, userId, RegistrableEntityType.RECORDING, recordingId, opts, (sid) =>
      this.validation.validateRecording(tenantId, recordingId, sid),
    );
  }

  submitWork(tenantId: string, userId: string, workId: string, dto: SubmitToSocietyDto) {
    return this.submitEntity(tenantId, userId, RegistrableEntityType.WORK, workId, dto,
      (sid) => this.validation.validateWork(tenantId, workId, sid),
      (adapter, payload) => adapter.submitWork(payload));
  }

  submitRecording(tenantId: string, userId: string, recordingId: string, dto: SubmitToSocietyDto) {
    return this.submitEntity(tenantId, userId, RegistrableEntityType.RECORDING, recordingId, dto,
      (sid) => this.validation.validateRecording(tenantId, recordingId, sid),
      (adapter, payload) => adapter.submitRecording(payload));
  }

  /**
   * Submit a prepared (VALID/READY) submission via its driver. Blocks on
   * critical validation errors, regenerates a fresh immutable snapshot, then
   * delegates to the adapter. MANUAL_EXPORT does not auto-submit — it returns to
   * READY with manual instructions (honest, no fake "SUBMITTED").
   */
  private async submitEntity(
    tenantId: string,
    userId: string,
    entityType: RegistrableEntityType,
    entityId: string,
    dto: SubmitToSocietyDto,
    validate: (submissionId: string) => Promise<RegistryValidationResult>,
    callAdapter: (adapter: ReturnType<SocietyAdapterRegistry['resolve']>, payload: Record<string, unknown>) => Promise<SocietySubmissionResult>,
  ) {
    const submission = dto.submission_id
      ? await this.submissions.findById(tenantId, dto.submission_id)
      : await this.submissions.findLatestForEntity(tenantId, entityType, entityId, [
          SocietySubmissionStatus.VALID,
          SocietySubmissionStatus.READY,
        ]);
    if (!submission) {
      throw new BadRequestException('Nenhuma submissão preparada (VALID/READY). Use prepare antes de submeter.');
    }

    const validation = await validate(submission.id);
    if (!validation.valid) {
      throw new BadRequestException({ message: 'Validação com erros críticos; corrija antes de submeter.', validation });
    }

    // Fresh immutable snapshot reflecting the exact data being submitted.
    const payload = await this.abramus.build(tenantId, entityType, entityId);
    await this.submissions.createSnapshot(tenantId, userId, submission.id, payload);

    let current = submission;
    if (current.status === SocietySubmissionStatus.VALID) {
      current = await this.submissions.transition(tenantId, userId, submission.id, {
        status: SocietySubmissionStatus.READY,
        message: 'Pronto para submissão',
      });
    }

    const { snapshot } = await this.submissions.getCurrentPayload(tenantId, submission.id);
    const adapter = this.adapters.resolve(current.driver);
    const result = await callAdapter(adapter, snapshot?.payload ?? {});

    if (result.accepted) {
      const finalSubmission = await this.submissions.transition(tenantId, userId, submission.id, {
        status: SocietySubmissionStatus.SUBMITTED,
        protocol: result.protocol ?? undefined,
        external_id: result.externalId ?? undefined,
        message: result.message,
      });
      return { submission: finalSubmission, result, manual: false };
    }
    // Manual driver: stays READY; operator exports + submits + records protocol.
    return { submission: current, result, manual: true };
  }

  /** Re-build the payload and store a NEW immutable snapshot version. */
  async regeneratePayload(tenantId: string, userId: string, submissionId: string) {
    const sub = await this.submissions.findById(tenantId, submissionId);
    const payload = await this.abramus.build(tenantId, sub.entity_type, sub.entity_id);
    const snapshot = await this.submissions.createSnapshot(tenantId, userId, submissionId, payload);
    return { snapshot };
  }

  /** Serialise the current snapshot (always via the manual/export serialiser). */
  async exportSubmission(tenantId: string, submissionId: string, format: ExportFormat): Promise<ExportResult> {
    const sub = await this.submissions.findById(tenantId, submissionId);
    const { snapshot } = await this.submissions.getCurrentPayload(tenantId, submissionId);
    if (!snapshot) {
      throw new BadRequestException('Gere os dados da submissão antes de exportar.');
    }
    const adapter = this.adapters.resolve(SocietyDriver.MANUAL_EXPORT);
    const base = `submission-${sub.society}-${submissionId.slice(0, 8)}-v${snapshot.version}`;
    return adapter.exportPayload(snapshot.payload, format, base);
  }

  private async prepare(
    tenantId: string,
    userId: string,
    entityType: RegistrableEntityType,
    entityId: string,
    opts: PrepareSubmissionDto,
    validate: (submissionId: string) => Promise<RegistryValidationResult>,
  ) {
    const submission = await this.submissions.createSubmission(tenantId, userId, {
      society: opts.society ?? SocietyName.ABRAMUS,
      driver: opts.driver ?? SocietyDriver.MANUAL_EXPORT,
      entityType,
      entityId,
      accountId: opts.account_id ?? null,
    });

    const validation = await validate(submission.id);
    const payload = await this.abramus.build(tenantId, entityType, entityId);
    await this.submissions.createSnapshot(tenantId, userId, submission.id, payload);

    await this.submissions.transition(tenantId, userId, submission.id, {
      status: SocietySubmissionStatus.VALIDATING,
      message: 'Validação automática',
    });
    const finalSubmission = await this.submissions.transition(tenantId, userId, submission.id, {
      status: validation.valid ? SocietySubmissionStatus.VALID : SocietySubmissionStatus.INVALID,
      message: validation.valid ? 'Validação OK' : `${validation.errorCount} erro(s) de validação`,
    });

    return { submission: finalSubmission, validation };
  }
}
