import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { redactDiagnosticText } from '../../../core/filters/redact-diagnostic';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { SocietySyncJobEntity } from '../../../database/entities';
import { SocietyDriver, SocietyName, SocietySyncJobStatus, classifyFailureCode, type ApiErrorCode } from '@music-os-360/types';
import { SocietyAdapterRegistry } from '../adapters/society-adapter.registry';
import type { RunSyncDto } from '../dto/operations.dto';

/** Wire shape of a sync job: the raw `error_message` stays internal, clients get `error_code`. */
export type PublicSocietySyncJob = Omit<SocietySyncJobEntity, 'error_message'> & { error_code: ApiErrorCode | null };

export function toPublicSocietySyncJob(job: SocietySyncJobEntity): PublicSocietySyncJob {
  const { error_message: rawError, ...rest } = job;
  return { ...rest, error_code: rawError ? classifyFailureCode(rawError, 'INTEGRATION_CALL_FAILED') : null };
}

/**
 * Status reconciliation jobs. With the MANUAL_EXPORT driver there is no external
 * API to poll, so a job simply records that statuses are tracked manually — it
 * never pretends to have synced. PARTNER_API/PORTAL_RPA, while disabled, finish
 * the job as a clean no-op (or FAILED if an enabled driver errors).
 */
@Injectable()
export class SocietySyncService {
  private readonly jobs: Repository<SocietySyncJobEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly adapters: SocietyAdapterRegistry,
  ) {
    if (ds) this.jobs = ds.getRepository(SocietySyncJobEntity);
  }

  private get repo(): Repository<SocietySyncJobEntity> {
    if (!this.jobs) throw new BadRequestException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.jobs;
  }

  async runSync(tenantId: string, userId: string, dto: RunSyncDto): Promise<SocietySyncJobEntity> {
    const society = dto.society ?? SocietyName.ABRAMUS;
    const driver = dto.driver ?? SocietyDriver.MANUAL_EXPORT;

    let job = await this.repo.save(this.repo.create({
      tenant_id: tenantId,
      society,
      driver,
      status: SocietySyncJobStatus.RUNNING,
      started_at: new Date(),
      created_by: userId || null,
    }));

    try {
      const adapter = this.adapters.resolve(driver);
      let message: string;
      if (driver === SocietyDriver.MANUAL_EXPORT) {
        message = 'Driver manual: status acompanhado fora do sistema (sem sincronização automática).';
      } else if (!adapter.enabled) {
        message = `Driver ${driver} desabilitado: nada a sincronizar.`;
      } else {
        // Enabled partner/RPA would poll here; the stub refuses, surfaced as FAILED.
        await adapter.getSubmissionStatus('healthcheck');
        message = 'Sincronização concluída.';
      }
      job = await this.finish(job, SocietySyncJobStatus.SUCCESS, null, { message });
    } catch (err) {
      job = await this.finish(job, SocietySyncJobStatus.FAILED, err instanceof Error ? err.message : 'Falha desconhecida', {});
    }
    return job;
  }

  async list(tenantId: string) {
    const data = await this.repo.find({ where: { tenant_id: tenantId }, order: { created_at: 'DESC' }, take: 100 });
    return { data, meta: { total: data.length } };
  }

  async findById(tenantId: string, id: string): Promise<SocietySyncJobEntity> {
    const job = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!job) throw new NotFoundException('Job de sincronização não encontrado');
    return job;
  }

  private async finish(
    job: SocietySyncJobEntity,
    status: SocietySyncJobStatus,
    errorMessage: string | null,
    metadata: Record<string, unknown>,
  ): Promise<SocietySyncJobEntity> {
    job.status = status;
    job.finished_at = new Date();
    // Persisted raw provider text: redact secrets/PII and cap before storage (R3-11); never returned on the wire.
    job.error_message = errorMessage === null ? null : redactDiagnosticText(errorMessage).slice(0, 500);
    job.metadata = { ...job.metadata, ...metadata };
    return this.repo.save(job);
  }
}
