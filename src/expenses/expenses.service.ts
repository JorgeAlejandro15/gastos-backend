import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { HouseholdEntity } from '../households/household.entity';
import { ShoppingItemEntity } from '../lists/shopping-item.entity';
import { ShoppingListEntity } from '../lists/shopping-list.entity';
import { UserEntity } from '../users/user.entity';
import { ExpenseEntity, type ExpenseSourceType } from './expense.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(ExpenseEntity)
    private readonly expensesRepo: Repository<ExpenseEntity>,
  ) {}

  async createExpense(
    input: {
      household: HouseholdEntity;
      payer: UserEntity;
      amount: number;
      currency: string;
      description: string;
      category?: string | null;
      occurredAt: Date;
      sourceType: ExpenseSourceType;
      sourceId?: string | null;
    },
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(ExpenseEntity)
      : this.expensesRepo;
    const expense = repo.create(input);
    return repo.save(expense);
  }

  async deleteBySource(
    sourceType: ExpenseSourceType,
    sourceId: string,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(ExpenseEntity)
      : this.expensesRepo;
    await repo.delete({ sourceType, sourceId });
  }

  async findBySource(
    sourceType: ExpenseSourceType,
    sourceId: string,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(ExpenseEntity)
      : this.expensesRepo;
    return repo.findOne({ where: { sourceType, sourceId } });
  }

  async getExpenseForHousehold(householdId: string, expenseId: string) {
    return this.expensesRepo.findOne({
      where: { id: expenseId, household: { id: householdId } },
      relations: { payer: true },
    });
  }

  async listExpensesForHousehold(
    householdId: string,
    filters: {
      from?: Date;
      to?: Date;
      payerId?: string;
      category?: string;
      sourceType?: ExpenseSourceType;
      offset?: number;
      limit?: number;
      order?: 'ASC' | 'DESC';
    },
  ) {
    const qb = this.expensesRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.payer', 'payer')
      .where('e.householdId = :householdId', { householdId });

    if (filters.from) {
      qb.andWhere('e.occurredAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('e.occurredAt <= :to', { to: filters.to });
    }
    if (filters.payerId) {
      qb.andWhere('e.payerId = :payerId', { payerId: filters.payerId });
    }
    if (filters.category) {
      qb.andWhere('e.category = :category', { category: filters.category });
    }
    if (filters.sourceType) {
      qb.andWhere('e.sourceType = :sourceType', {
        sourceType: filters.sourceType,
      });
    }

    qb.orderBy('e.occurredAt', filters.order ?? 'DESC');

    if (typeof filters.offset === 'number') qb.skip(filters.offset);
    qb.take(filters.limit ?? 50);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listShoppingExpensesByListOwner(
    householdId: string,
    ownerUserId: string | null,
    filters: {
      from?: Date;
      to?: Date;
      payerId?: string;
      category?: string;
      offset?: number;
      limit?: number;
      order?: 'ASC' | 'DESC';
    },
  ) {
    const qb = this.expensesRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.payer', 'payer')
      .leftJoin(ShoppingItemEntity, 'i', 'i.id = e.sourceId')
      .leftJoin(ShoppingListEntity, 'l', 'l.id = i.listId')
      .where('e.householdId = :householdId', { householdId })
      .andWhere("e.sourceType = 'shopping_item'");

    if (ownerUserId) {
      qb.andWhere('l.ownerId = :ownerUserId', { ownerUserId });
    } else {
      qb.andWhere('l.ownerId IS NULL');
    }

    if (filters.from)
      qb.andWhere('e.occurredAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.occurredAt <= :to', { to: filters.to });
    if (filters.payerId)
      qb.andWhere('e.payerId = :payerId', { payerId: filters.payerId });
    if (filters.category)
      qb.andWhere('e.category = :category', { category: filters.category });

    qb.orderBy('e.occurredAt', filters.order ?? 'DESC');
    if (typeof filters.offset === 'number') qb.skip(filters.offset);
    qb.take(filters.limit ?? 50);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async sumShoppingExpensesByListOwner(
    householdId: string,
    ownerUserId: string | null,
    filters: {
      from?: Date;
      to?: Date;
      payerId?: string;
      category?: string;
    },
  ) {
    const qb = this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .leftJoin(ShoppingItemEntity, 'i', 'i.id = e.sourceId')
      .leftJoin(ShoppingListEntity, 'l', 'l.id = i.listId')
      .where('e.householdId = :householdId', { householdId })
      .andWhere("e.sourceType = 'shopping_item'");

    if (ownerUserId) {
      qb.andWhere('l.ownerId = :ownerUserId', { ownerUserId });
    } else {
      qb.andWhere('l.ownerId IS NULL');
    }

    if (filters.from)
      qb.andWhere('e.occurredAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.occurredAt <= :to', { to: filters.to });
    if (filters.payerId)
      qb.andWhere('e.payerId = :payerId', { payerId: filters.payerId });
    if (filters.category)
      qb.andWhere('e.category = :category', { category: filters.category });

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  async reportTotalByPayer(
    householdId: string,
    filters: { from?: Date; to?: Date },
  ) {
    const qb = this.expensesRepo
      .createQueryBuilder('e')
      .innerJoin('e.payer', 'payer')
      .innerJoin(ShoppingItemEntity, 'i', 'i.id = e.sourceId')
      .innerJoin(ShoppingListEntity, 'l', 'l.id = i.listId')
      .where('e.householdId = :householdId', { householdId });

    // Reportes del hogar: solo lista compartida (shopping_item donde list.ownerId IS NULL)
    qb.andWhere("e.sourceType = 'shopping_item'").andWhere('l.ownerId IS NULL');

    if (filters.from)
      qb.andWhere('e.occurredAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.occurredAt <= :to', { to: filters.to });

    const rows = await qb
      .select([
        'payer.id as "payerId"',
        'payer.displayName as "displayName"',
        'SUM(e.amount) as "total"',
      ])
      .groupBy('payer.id')
      .addGroupBy('payer.displayName')
      .orderBy('SUM(e.amount)', 'DESC')
      .getRawMany<{ payerId: string; displayName: string; total: string }>();

    return rows.map((r) => ({
      payerId: r.payerId,
      displayName: r.displayName,
      total: Number(r.total),
    }));
  }

  async reportTotalByCategory(
    householdId: string,
    filters: { from?: Date; to?: Date },
  ) {
    const qb = this.expensesRepo
      .createQueryBuilder('e')
      .innerJoin(ShoppingItemEntity, 'i', 'i.id = e.sourceId')
      .innerJoin(ShoppingListEntity, 'l', 'l.id = i.listId')
      .where('e.householdId = :householdId', { householdId });

    // Reportes del hogar: solo lista compartida (shopping_item donde list.ownerId IS NULL)
    qb.andWhere("e.sourceType = 'shopping_item'").andWhere('l.ownerId IS NULL');

    if (filters.from)
      qb.andWhere('e.occurredAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.occurredAt <= :to', { to: filters.to });

    const rows = await qb
      .select([
        'COALESCE(e.category, \'(sin categoría)\') as "category"',
        'SUM(e.amount) as "total"',
      ])
      .groupBy("COALESCE(e.category, '(sin categoría)')")
      .orderBy('SUM(e.amount)', 'DESC')
      .getRawMany<{ category: string; total: string }>();

    return rows.map((r) => ({ category: r.category, total: Number(r.total) }));
  }

  async deleteManualExpenseForHousehold(
    householdId: string,
    expenseId: string,
  ) {
    const expense = await this.expensesRepo.findOne({
      where: { id: expenseId, household: { id: householdId } },
    });
    if (!expense) return { deleted: false, reason: 'not_found' as const };

    if (expense.sourceType !== 'manual') {
      return { deleted: false, reason: 'not_manual' as const };
    }

    await this.expensesRepo.delete({ id: expenseId });
    return { deleted: true, reason: null };
  }

  async sumExpensesForUser(
    householdId: string,
    payerId: string,
    filters: { from?: Date; to?: Date },
  ) {
    const qb = this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.householdId = :householdId', { householdId })
      .andWhere('e.payerId = :payerId', { payerId });

    if (filters.from)
      qb.andWhere('e.occurredAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.occurredAt <= :to', { to: filters.to });

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  async sumExpensesForHousehold(
    householdId: string,
    filters: {
      from?: Date;
      to?: Date;
      payerId?: string;
      category?: string;
      sourceType?: ExpenseSourceType;
    },
  ) {
    const qb = this.expensesRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.householdId = :householdId', { householdId });

    if (filters.from)
      qb.andWhere('e.occurredAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('e.occurredAt <= :to', { to: filters.to });
    if (filters.payerId)
      qb.andWhere('e.payerId = :payerId', { payerId: filters.payerId });
    if (filters.category)
      qb.andWhere('e.category = :category', { category: filters.category });
    if (filters.sourceType)
      qb.andWhere('e.sourceType = :sourceType', {
        sourceType: filters.sourceType,
      });

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }
}
