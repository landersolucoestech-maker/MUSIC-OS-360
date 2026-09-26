/**
 * queues/services/email-queue.service.ts
 *
 * Producer service for the "emails" queue.
 * When Redis is not available, the methods are silent no-ops.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import {
  QUEUE_NAMES,
  EMAIL_JOB_NAMES,
} from '../queue.constants';
import type {
  WelcomeEmailPayload,
  PasswordResetEmailPayload,
  ContractExpiryEmailPayload,
  InviteUserEmailPayload,
  MonitoringAlertEmailPayload,
} from '../processors/email.processor';

const HIGH_PRIORITY:   Partial<JobsOptions> = { priority: 1 };
const NORMAL_PRIORITY: Partial<JobsOptions> = { priority: 5 };

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NAMES.EMAILS)
    private readonly emailQueue: Queue | null,
  ) {}

  private get available(): boolean {
    return this.emailQueue != null;
  }

  async enqueueWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
    if (!this.available) return;
    const job = await this.emailQueue!.add(EMAIL_JOB_NAMES.WELCOME, payload, {
      ...HIGH_PRIORITY,
      jobId: `welcome:${payload.userId}`,
    });
    this.logger.log(`[emails] enqueued "${EMAIL_JOB_NAMES.WELCOME}" jobId=${job.id} to=${payload.email}`);
  }

  async enqueuePasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
    if (!this.available) return;
    const job = await this.emailQueue!.add(EMAIL_JOB_NAMES.PASSWORD_RESET, payload, HIGH_PRIORITY);
    this.logger.log(`[emails] enqueued "${EMAIL_JOB_NAMES.PASSWORD_RESET}" jobId=${job.id} to=${payload.email}`);
  }

  async enqueueContractExpiryEmail(payload: ContractExpiryEmailPayload): Promise<void> {
    if (!this.available) return;
    const job = await this.emailQueue!.add(EMAIL_JOB_NAMES.CONTRACT_EXPIRY, payload, {
      ...NORMAL_PRIORITY,
      jobId: `contract-expiry:${payload.contractId}`,
    });
    this.logger.log(`[emails] enqueued "${EMAIL_JOB_NAMES.CONTRACT_EXPIRY}" jobId=${job.id} contrato=${payload.contractId}`);
  }

  async enqueueInviteUserEmail(payload: InviteUserEmailPayload): Promise<void> {
    if (!this.available) return;
    const job = await this.emailQueue!.add(EMAIL_JOB_NAMES.INVITE_USER, payload, HIGH_PRIORITY);
    this.logger.log(`[emails] enqueued "${EMAIL_JOB_NAMES.INVITE_USER}" jobId=${job.id} to=${payload.email}`);
  }

  async enqueueMonitoringAlertEmail(payload: MonitoringAlertEmailPayload): Promise<void> {
    if (!this.available) return;
    const job = await this.emailQueue!.add(EMAIL_JOB_NAMES.MONITORING_ALERT, payload, NORMAL_PRIORITY);
    this.logger.log(`[emails] enqueued "${EMAIL_JOB_NAMES.MONITORING_ALERT}" jobId=${job.id} type=${payload.alertType}`);
  }

  async getQueueStats(): Promise<{ waiting: number; active: number; completed: number; failed: number; delayed: number }> {
    if (!this.available) return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue!.getWaitingCount(),
      this.emailQueue!.getActiveCount(),
      this.emailQueue!.getCompletedCount(),
      this.emailQueue!.getFailedCount(),
      this.emailQueue!.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
