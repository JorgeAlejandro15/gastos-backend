import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { IncomeEntity, type IncomeSource } from './income.entity';

@Injectable()
export class IncomesService {
  constructor(
    @InjectRepository(IncomeEntity)
    private readonly incomesRepo: Repository<IncomeEntity>,
  ) {}

  async createIncome(input: {
    ownerId: string;
    amount: number;
    currency: string;
    description: string;
    category?: string | null;
    source: IncomeSource;
    occurredAt: Date;
  }) {
    const income = this.incomesRepo.create({
      owner: { id: input.ownerId } as UserEntity,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      category: input.category ?? null,
      source: input.source,
      occurredAt: input.occurredAt,
    });

    return this.incomesRepo.save(income);
  }

  async getIncomeForUser(userId: string, incomeId: string) {
    return this.incomesRepo.findOne({
      where: { id: incomeId, owner: { id: userId } },
      relations: { owner: true },
    });
  }

  async requireIncomeForUser(userId: string, incomeId: string) {
    const income = await this.getIncomeForUser(userId, incomeId);
    if (!income) throw new NotFoundException('Ingreso no encontrado');
    return income;
  }

  async deleteIncomeForUser(userId: string, incomeId: string) {
    const income = await this.getIncomeForUser(userId, incomeId);
    if (!income) return { deleted: false, reason: 'not_found' as const };

    await this.incomesRepo.delete({ id: income.id });
    return { deleted: true, reason: null };
  }

  async updateIncomeForUser(
    userId: string,
    incomeId: string,
    patch: {
      amount?: number;
      description?: string;
      category?: string | null;
      source?: IncomeSource;
      occurredAt?: Date;
    },
  ) {
    const income = await this.getIncomeForUser(userId, incomeId);
    if (!income) return null;

    if (typeof patch.amount === 'number') income.amount = patch.amount;
    if (typeof patch.description === 'string')
      income.description = patch.description;
    if (patch.category !== undefined) income.category = patch.category;
    if (patch.source) income.source = patch.source;
    if (patch.occurredAt) income.occurredAt = patch.occurredAt;

    return this.incomesRepo.save(income);
  }

  async listIncomesForUser(
    userId: string,
    filters: {
      from?: Date;
      to?: Date;
      source?: IncomeSource;
      category?: string;
      offset?: number;
      limit?: number;
      order?: 'ASC' | 'DESC';
    },
  ) {
    const qb = this.incomesRepo
      .createQueryBuilder('i')
      .where('i.ownerId = :userId', { userId });

    if (filters.from)
      qb.andWhere('i.occurredAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('i.occurredAt <= :to', { to: filters.to });
    if (filters.source)
      qb.andWhere('i.source = :source', { source: filters.source });
    if (filters.category)
      qb.andWhere('i.category = :category', { category: filters.category });

    qb.orderBy('i.occurredAt', filters.order ?? 'DESC');

    if (typeof filters.offset === 'number') qb.skip(filters.offset);
    qb.take(filters.limit ?? 50);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async sumIncomesForUser(
    userId: string,
    filters: {
      from?: Date;
      to?: Date;
      source?: IncomeSource;
      category?: string;
    },
  ) {
    const qb = this.incomesRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.amount), 0)', 'total')
      .where('i.ownerId = :userId', { userId });

    if (filters.from)
      qb.andWhere('i.occurredAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('i.occurredAt <= :to', { to: filters.to });
    if (filters.source)
      qb.andWhere('i.source = :source', { source: filters.source });
    if (filters.category)
      qb.andWhere('i.category = :category', { category: filters.category });

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }
}
