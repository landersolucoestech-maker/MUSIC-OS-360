import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { ExternalIdentifierEntity } from '../../database/entities';
import { IdentifierType, RegistrableEntityType } from '@music-os-360/types';
import type { CreateExternalIdentifierDto, UpdateExternalIdentifierDto } from './dto/external-identifier.dto';
import { isValidIsrc, isValidIswc, normalizeIsrc, normalizeIswc } from './validators/registry-validators';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import { assertSameTenantFk } from '../../common/persistence/assert-same-tenant-fk.util';

/** Physical table backing each RegistrableEntityType — all tenant_id-scoped. */
const ENTITY_TYPE_TABLE: Record<RegistrableEntityType, string> = {
  [RegistrableEntityType.WORK]: 'works',
  [RegistrableEntityType.RECORDING]: 'phonograms',
  [RegistrableEntityType.RIGHTS_HOLDER]: 'rights_holders',
  [RegistrableEntityType.RELEASE]: 'releases',
  [RegistrableEntityType.SUBMISSION]: 'society_submissions',
};

const ENTITY_TYPE_ALIASES: Record<string, RegistrableEntityType> = {
  work: RegistrableEntityType.WORK,
  works: RegistrableEntityType.WORK,
  recording: RegistrableEntityType.RECORDING,
  recordings: RegistrableEntityType.RECORDING,
  phonogram: RegistrableEntityType.RECORDING,
  phonograms: RegistrableEntityType.RECORDING,
  rights_holder: RegistrableEntityType.RIGHTS_HOLDER,
  'rights-holder': RegistrableEntityType.RIGHTS_HOLDER,
  release: RegistrableEntityType.RELEASE,
  releases: RegistrableEntityType.RELEASE,
  submission: RegistrableEntityType.SUBMISSION,
  submissions: RegistrableEntityType.SUBMISSION,
};

@Injectable()
export class ExternalIdentifierService {
  private readonly repo: Repository<ExternalIdentifierEntity> | null = null;
  private readonly ds: DataSource | null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    this.ds = ds;
    if (ds) this.repo = ds.getRepository(ExternalIdentifierEntity);
  }

  private get repository(): Repository<ExternalIdentifierEntity> {
    if (!this.repo) throw new BadRequestException('Database unavailable');
    return this.repo;
  }

  /** Normalise a route param into a known entity type, or 400. */
  normalizeEntityType(raw: string): RegistrableEntityType {
    const mapped = ENTITY_TYPE_ALIASES[(raw ?? '').toLowerCase()];
    if (!mapped) throw new BadRequestException(`Tipo de entidade inválido: ${raw}`);
    return mapped;
  }

  async listByEntity(tenantId: string, entityTypeRaw: string, entityId: string) {
    const entityType = this.normalizeEntityType(entityTypeRaw);
    const data = await this.repository.find({
      where: { tenant_id: tenantId, entity_type: entityType, entity_id: entityId },
      order: { is_primary: 'DESC', created_at: 'ASC' },
    });
    return { data, meta: { total: data.length } };
  }

  async create(
    tenantId: string,
    userId: string,
    entityTypeRaw: string,
    entityId: string,
    dto: CreateExternalIdentifierDto,
  ): Promise<ExternalIdentifierEntity> {
    const entityType = this.normalizeEntityType(entityTypeRaw);
    // find-bb1178da: entityId (route param) had no ownership check against
    // its backing table — an external identifier could silently attach to
    // another tenant's work/recording/rights-holder/release/submission.
    await assertSameTenantFk(this.ds!, ENTITY_TYPE_TABLE[entityType], entityId, tenantId, 'Entidade');
    const value = this.validateAndNormalizeValue(dto.identifier_type, dto.identifier_value);

    const entity = this.repository.create({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      provider: dto.provider,
      identifier_type: dto.identifier_type,
      identifier_value: value,
      is_primary: dto.is_primary ?? false,
      metadata: dto.metadata ?? {},
      created_by: userId || null,
    });
    return this.saveUnique(entity);
  }

  async update(tenantId: string, id: string, dto: UpdateExternalIdentifierDto): Promise<ExternalIdentifierEntity> {
    const current = await this.findById(tenantId, id);
    const nextType = dto.identifier_type ?? current.identifier_type;
    const updates: Record<string, unknown> = {};
    if (dto.identifier_value != null || dto.identifier_type != null) {
      updates.identifier_value = this.validateAndNormalizeValue(nextType, dto.identifier_value ?? current.identifier_value);
    }
    if (dto.identifier_type != null) updates.identifier_type = dto.identifier_type;
    if (dto.provider != null) updates.provider = dto.provider;
    if (dto.is_primary != null) updates.is_primary = dto.is_primary;
    if (dto.metadata != null) updates.metadata = dto.metadata;
    return this.updateUnique(tenantId, id, updates, dto.expectedUpdatedAt);
  }

  async remove(tenantId: string, id: string) {
    const current = await this.findById(tenantId, id);
    await this.repository.delete({ id: current.id, tenant_id: tenantId });
    return { deleted: true };
  }

  private async findById(tenantId: string, id: string): Promise<ExternalIdentifierEntity> {
    const found = await this.repository.findOne({ where: { id, tenant_id: tenantId } });
    if (!found) throw new NotFoundException('Identificador não encontrado');
    return found;
  }

  private validateAndNormalizeValue(type: IdentifierType, raw: string): string {
    const value = (raw ?? '').trim();
    if (!value) throw new BadRequestException('identifier_value é obrigatório.');
    if (type === IdentifierType.ISRC) {
      if (!isValidIsrc(value)) throw new BadRequestException('ISRC inválido (formato esperado: CCXXX YY NNNNN).');
      return normalizeIsrc(value);
    }
    if (type === IdentifierType.ISWC) {
      if (!isValidIswc(value)) throw new BadRequestException('ISWC inválido (formato esperado: T + 10 dígitos).');
      return normalizeIswc(value);
    }
    return value;
  }

  /** Persist, mapping the DB unique-violation into a clean 409. */
  private async saveUnique(entity: ExternalIdentifierEntity): Promise<ExternalIdentifierEntity> {
    try {
      return await this.repository.save(entity);
    } catch (err) {
      if (err instanceof QueryFailedError && (err.driverError as { code?: string })?.code === '23505') {
        throw new ConflictException('Identificador duplicado para esta entidade/tenant.');
      }
      throw err;
    }
  }

  /** Update via CAS, mapping the DB unique-violation into a clean 409 (same as saveUnique). */
  private async updateUnique(
    tenantId: string,
    id: string,
    updates: Record<string, unknown>,
    expectedUpdatedAt: string | undefined,
  ): Promise<ExternalIdentifierEntity> {
    try {
      await casUpdate(
        this.repository,
        { id, tenant_id: tenantId } as never,
        updates as never,
        expectedUpdatedAt,
        'Este identificador foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
      );
    } catch (err) {
      if (err instanceof QueryFailedError && (err.driverError as { code?: string })?.code === '23505') {
        throw new ConflictException('Identificador duplicado para esta entidade/tenant.');
      }
      throw err;
    }
    return this.findById(tenantId, id);
  }
}
