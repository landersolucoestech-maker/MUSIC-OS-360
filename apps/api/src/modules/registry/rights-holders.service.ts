import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { RightsHolderEntity } from '../../database/entities';
import { HolderType } from '@music-os-360/types';
import type { CreateRightsHolderDto, UpdateRightsHolderDto, QueryRightsHolderDto } from './dto/rights-holder.dto';
import { isValidDocument } from './validators/registry-validators';
import { casUpdate } from '../../common/persistence/optimistic-update.util';

@Injectable()
export class RightsHoldersService {
  private readonly repo: Repository<RightsHolderEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(RightsHolderEntity);
  }

  private get repository(): Repository<RightsHolderEntity> {
    if (!this.repo) throw new BadRequestException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.repo;
  }

  async list(tenantId: string, q: QueryRightsHolderDto) {
    const qb = this.repository
      .createQueryBuilder('h')
      .where('h.tenant_id = :tenantId', { tenantId })
      .andWhere('h.deleted_at IS NULL');

    if (q.holder_type) qb.andWhere('h.holder_type = :ht', { ht: q.holder_type });
    if (q.search) {
      qb.andWhere('(h.legal_name ILIKE :s OR h.artistic_name ILIKE :s)', { s: `%${q.search}%` });
    }

    qb.orderBy('h.legal_name', 'ASC').skip(q.offset ?? 0).take(q.limit ?? 50);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: q.offset ?? 0, limit: q.limit ?? 50 } };
  }

  async findById(tenantId: string, id: string): Promise<RightsHolderEntity> {
    const holder = await this.repository.findOne({ where: { id, tenant_id: tenantId } });
    if (!holder || holder.deleted_at) throw new NotFoundException('Titular não encontrado');
    return holder;
  }

  async create(tenantId: string, userId: string, dto: CreateRightsHolderDto): Promise<RightsHolderEntity> {
    this.assertValidDocument(dto.document_type, dto.document_number);
    await this.assertUniqueDocument(tenantId, dto.document_number ?? null, null);

    const entity = this.repository.create({
      tenant_id: tenantId,
      legal_name: dto.legal_name.trim(),
      artistic_name: dto.artistic_name ?? null,
      document_type: dto.document_type ?? null,
      document_number: dto.document_number ?? null,
      country: dto.country ?? null,
      ipi_cae: dto.ipi_cae ?? null,
      society: dto.society ?? null,
      society_member_code: dto.society_member_code ?? null,
      holder_type: dto.holder_type ?? HolderType.OTHER,
      created_by: userId || null,
      updated_by: userId || null,
    });
    return this.repository.save(entity);
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateRightsHolderDto): Promise<RightsHolderEntity> {
    const current = await this.findById(tenantId, id);
    const nextDocType = dto.document_type ?? current.document_type;
    const nextDocNumber = dto.document_number ?? current.document_number;
    this.assertValidDocument(nextDocType, nextDocNumber);
    if (dto.document_number != null && dto.document_number !== current.document_number) {
      await this.assertUniqueDocument(tenantId, dto.document_number, id);
    }

    const updates: Record<string, unknown> = {
      ...(dto.legal_name != null ? { legal_name: dto.legal_name.trim() } : {}),
      ...(dto.artistic_name != null ? { artistic_name: dto.artistic_name } : {}),
      ...(dto.document_type != null ? { document_type: dto.document_type } : {}),
      ...(dto.document_number != null ? { document_number: dto.document_number } : {}),
      ...(dto.country != null ? { country: dto.country } : {}),
      ...(dto.ipi_cae != null ? { ipi_cae: dto.ipi_cae } : {}),
      ...(dto.society != null ? { society: dto.society } : {}),
      ...(dto.society_member_code != null ? { society_member_code: dto.society_member_code } : {}),
      ...(dto.holder_type != null ? { holder_type: dto.holder_type } : {}),
      updated_by: userId || null,
    };
    await casUpdate(
      this.repository,
      { id, tenant_id: tenantId } as never,
      updates as never,
      dto.expectedUpdatedAt,
      'Este titular foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    const current = await this.findById(tenantId, id);
    current.deleted_at = new Date();
    await this.repository.save(current);
    return { deleted: true };
  }

  private assertValidDocument(documentType: string | null | undefined, value: string | null | undefined): void {
    if (!isValidDocument(documentType, value)) {
      throw new BadRequestException('Documento inválido para o tipo informado.');
    }
  }

  private async assertUniqueDocument(tenantId: string, documentNumber: string | null, ignoreId: string | null): Promise<void> {
    if (!documentNumber) return;
    const qb = this.repository
      .createQueryBuilder('h')
      .where('h.tenant_id = :tenantId AND h.document_number = :doc AND h.deleted_at IS NULL', {
        tenantId,
        doc: documentNumber,
      });
    if (ignoreId) qb.andWhere('h.id != :id', { id: ignoreId });
    const existing = await qb.getOne();
    if (existing) throw new ConflictException('Já existe um titular com este documento neste workspace.');
  }
}
