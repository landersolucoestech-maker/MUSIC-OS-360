import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { ActivityLogEntity, NotificationSettingEntity } from '../../database/entities';
import type { NotificationDbContext } from './notifications.service';
import {
  NOTIFICATION_SETTING_KEYS,
  NotificationSettingInputDto,
  type NotificationSettingKey,
} from './dto/update-notification-settings.dto';

type SettingConfig = Record<string, unknown>;

export interface ResolvedNotificationSetting {
  id: string | null;
  notificationKey: NotificationSettingKey;
  enabled: boolean;
  config: SettingConfig;
  updatedAt: string | null;
}

const DEFAULTS: Record<NotificationSettingKey, { enabled: boolean; config: SettingConfig }> = {
  delivery_channels: { enabled: true, config: { email: true, sms: false, push: true } },
  contract_created: { enabled: true, config: {} },
  contract_expiring: { enabled: true, config: { daysBefore: [30, 15, 7] } },
  contract_expired: { enabled: true, config: {} },
  contract_renewal: {
    enabled: true,
    config: { daysBefore: [30], reminderTypes: ['contract'] },
  },
  low_balance: { enabled: false, config: { minimumAmountCents: 100000 } },
  financial_activity: { enabled: true, config: {} },
  weekly_financial_summary: { enabled: false, config: { weekday: 1, time: '09:00' } },
  weekly_activity_report: {
    enabled: false,
    config: { frequency: 'weekly', weekday: 1, time: '09:00', recipients: [] },
  },
  automatic_reminders: {
    enabled: true,
    config: {
      daysBefore: [7, 3, 1],
      reminderTypes: ['contract', 'pending_task', 'recommended_action'],
    },
  },
  critical_system_alerts: {
    enabled: true,
    config: {
      channels: { system: true, email: true, push: true, websocket: true },
    },
  },
  operational_notifications: { enabled: true, config: {} },
  automatic_backup: { enabled: true, config: {} },
  delivery_preferences: {
    enabled: true,
    config: { frequency: 'immediate', preferredTime: '09:00' },
  },
};

const FREQUENCIES = ['immediate', 'daily', 'weekly', 'biweekly', 'monthly', 'event'];
const REMINDER_TYPES = ['contract', 'pending_task', 'recommended_action'];

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${field} deve ser um objeto`);
  }
  return value as Record<string, unknown>;
}

function requireTime(value: unknown, field: string): void {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new BadRequestException('O horário deve usar o formato HH:mm.');
  }
}

function requireWeekday(value: unknown, field: string): void {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 6) {
    throw new BadRequestException('O dia da semana informado é inválido.');
  }
}

function requireDays(value: unknown, field: string): void {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 12 ||
    value.some((day) => !Number.isInteger(day) || day < 0 || day > 365) ||
    new Set(value).size !== value.length
  ) {
    throw new BadRequestException(`${field} deve conter dias únicos entre 0 e 365`);
  }
}

function requireStringList(
  value: unknown,
  field: string,
  allowed?: readonly string[],
): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new BadRequestException(`${field} deve ser uma lista de textos`);
  }
  const strings = value as string[];
  if (allowed && strings.some((item) => !allowed.includes(item))) {
    throw new BadRequestException(`${field} contém valor não suportado`);
  }
  return strings;
}

function validateConfig(key: NotificationSettingKey, input: SettingConfig): SettingConfig {
  const config = requireObject(input, 'config');

  if (key === 'delivery_channels') {
    for (const channel of ['email', 'sms', 'push']) {
      if (typeof config[channel] !== 'boolean') {
        throw new BadRequestException('Configuração de canais inválida.');
      }
    }
  }

  if (key === 'contract_expiring' || key === 'contract_renewal' || key === 'automatic_reminders') {
    requireDays(config['daysBefore'], 'config.daysBefore');
  }

  if (key === 'contract_renewal' || key === 'automatic_reminders') {
    requireStringList(config['reminderTypes'], 'config.reminderTypes', REMINDER_TYPES);
  }

  if (key === 'low_balance') {
    const amount = config['minimumAmountCents'];
    if (!Number.isInteger(amount) || Number(amount) < 0 || Number(amount) > 999999999999) {
      throw new BadRequestException('O valor mínimo deve ser um número inteiro positivo.');
    }
  }

  if (key === 'weekly_financial_summary' || key === 'weekly_activity_report') {
    requireWeekday(config['weekday'], 'config.weekday');
    requireTime(config['time'], 'config.time');
  }

  if (key === 'weekly_activity_report') {
    if (typeof config['frequency'] !== 'string' || !FREQUENCIES.includes(config['frequency'])) {
      throw new BadRequestException('Frequência não suportada.');
    }
    const recipients = requireStringList(config['recipients'], 'config.recipients');
    if (recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new BadRequestException('A lista de destinatários contém um e-mail inválido.');
    }
  }

  if (key === 'critical_system_alerts') {
    const channels = requireObject(config['channels'], 'config.channels');
    for (const channel of ['system', 'email', 'push', 'websocket']) {
      if (typeof channels[channel] !== 'boolean') {
        throw new BadRequestException('Configuração de canais inválida.');
      }
    }
  }

  if (key === 'delivery_preferences') {
    if (typeof config['frequency'] !== 'string' || !FREQUENCIES.includes(config['frequency'])) {
      throw new BadRequestException('Frequência não suportada.');
    }
    requireTime(config['preferredTime'], 'config.preferredTime');
  }

  return config;
}

@Injectable()
export class NotificationSettingsService {
  private readonly repository: Repository<NotificationSettingEntity> | null;

  constructor(
    @Inject(DATA_SOURCE) dataSource: DataSource | null,
    private readonly dbContext: DatabaseContextService,
  ) {
    this.repository = dataSource?.getRepository(NotificationSettingEntity) ?? null;
  }

  private repo(manager?: EntityManager): Repository<NotificationSettingEntity> {
    if (manager) return manager.getRepository(NotificationSettingEntity);
    if (!this.repository) throw new Error('Notification settings repository unavailable');
    return this.repository;
  }

  private resolve(
    key: NotificationSettingKey,
    row?: NotificationSettingEntity,
  ): ResolvedNotificationSetting {
    return {
      id: row?.id ?? null,
      notificationKey: key,
      enabled: row?.enabled ?? DEFAULTS[key].enabled,
      config: { ...DEFAULTS[key].config, ...(row?.config_json ?? {}) },
      updatedAt: row?.updated_at?.toISOString() ?? null,
    };
  }

  async list(
    tenantId: string,
    context?: NotificationDbContext,
  ): Promise<ResolvedNotificationSetting[]> {
    return this.dbContext.runInTenantContext(
      { tenantId, orgId: context?.orgId ?? null, role: context?.role ?? null },
      async (manager) => {
        const rows = await this.repo(manager).find({ where: { tenant_id: tenantId } });
        const byKey = new Map(rows.map((row) => [row.notification_key, row]));
        return NOTIFICATION_SETTING_KEYS.map((key) => this.resolve(key, byKey.get(key)));
      },
    );
  }

  async update(
    tenantId: string,
    userId: string,
    inputs: NotificationSettingInputDto[],
    context?: NotificationDbContext,
  ): Promise<ResolvedNotificationSetting[]> {
    if (new Set(inputs.map((input) => input.notificationKey)).size !== inputs.length) {
      throw new BadRequestException('Notificação duplicada na configuração.');
    }

    return this.dbContext.runInTenantContext(
      { tenantId, orgId: context?.orgId ?? null, role: context?.role ?? null },
      async (manager) => {
        const repository = this.repo(manager);
        const activityRepository = manager.getRepository(ActivityLogEntity);

        for (const input of inputs) {
          const config = validateConfig(input.notificationKey, input.config);
          const existing = await repository.findOne({
            where: { tenant_id: tenantId, notification_key: input.notificationKey },
          });
          const setting = existing ?? repository.create({
            tenant_id: tenantId,
            notification_key: input.notificationKey,
          });
          setting.enabled = input.enabled;
          setting.config_json = config;
          const saved = await repository.save(setting);

          await activityRepository.save(activityRepository.create({
            tenant_id: tenantId,
            entity_type: 'notification_setting',
            entity_id: saved.id,
            action: 'updated',
            description: `Atualizou a configuração de notificação ${saved.notification_key}`,
            metadata: {
              notificationKey: saved.notification_key,
              enabled: saved.enabled,
              config: saved.config_json,
            },
            user_id: userId,
            user_name: null,
            user_avatar_url: null,
          }));
        }

        const rows = await repository.find({ where: { tenant_id: tenantId } });
        const byKey = new Map(rows.map((row) => [row.notification_key, row]));
        return NOTIFICATION_SETTING_KEYS.map((key) => this.resolve(key, byKey.get(key)));
      },
    );
  }
}
