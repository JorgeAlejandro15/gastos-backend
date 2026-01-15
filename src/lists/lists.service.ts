import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { AppEnv } from '../config/env';
import { ExpenseEntity } from '../expenses/expense.entity';
import { ExpensesService } from '../expenses/expenses.service';
import { HouseholdsService } from '../households/households.service';
import { HouseholdEvents } from '../notifications/events/household-events';
import { UserEntity } from '../users/user.entity';
import { ShoppingItemEntity } from './shopping-item.entity';
import { ShoppingListEntity } from './shopping-list.entity';

@Injectable()
export class ListsService {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly households: HouseholdsService,
    private readonly events: EventEmitter2,
    private readonly dataSource: DataSource,
    private readonly expenses: ExpensesService,
    @InjectRepository(ShoppingListEntity)
    private readonly listsRepo: Repository<ShoppingListEntity>,
    @InjectRepository(ShoppingItemEntity)
    private readonly itemsRepo: Repository<ShoppingItemEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  private async requireUserAndHousehold(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');

    const household = await this.households.getHouseholdForUser(userId);
    if (!household) {
      throw new ForbiddenException('Usuario no asociado al hogar');
    }

    return { user, household };
  }

  /**
   * Fetches a list the user is allowed to modify.
   * IMPORTANT: does NOT load `items` to avoid accidental relation side-effects
   * (e.g. detaching purchased items) when saving/removing the list.
   */
  private async getListForWrite(userId: string, listId: string) {
    const { household } = await this.requireUserAndHousehold(userId);

    const list = await this.listsRepo.findOne({
      where: [
        { id: listId, household: { id: household.id }, owner: IsNull() },
        { id: listId, household: { id: household.id }, owner: { id: userId } },
      ],
      relations: { owner: true, createdBy: true },
    });

    if (!list) throw new NotFoundException('Lista no encontrada');
    return list;
  }

  async listLists(userId: string) {
    const { household } = await this.requireUserAndHousehold(userId);

    // Shared lists (owner is null) + personal lists (owner = user)
    return this.listsRepo.find({
      where: [
        { household: { id: household.id }, owner: IsNull() },
        { household: { id: household.id }, owner: { id: userId } },
      ],
      order: { createdAt: 'DESC' },
      relations: { owner: true },
    });
  }

  async createList(
    userId: string,
    input: { name: string; scope?: 'shared' | 'personal' },
  ) {
    const { user, household } = await this.requireUserAndHousehold(userId);

    const list = this.listsRepo.create({
      name: input.name,
      household,
      createdBy: user,
      owner: input.scope === 'personal' ? user : null,
    });

    return this.listsRepo.save(list);
  }

  async getList(userId: string, listId: string) {
    const { household } = await this.requireUserAndHousehold(userId);

    const list = await this.listsRepo.findOne({
      where: [
        { id: listId, household: { id: household.id }, owner: IsNull() },
        { id: listId, household: { id: household.id }, owner: { id: userId } },
      ],
      relations: { owner: true, createdBy: true },
    });

    if (!list) throw new NotFoundException('Lista no encontrada');

    // Pending items are fetched via cursor pagination on GET /lists/:listId/items
    // to avoid downloading huge lists in a single response.
    list.items = [];
    return list;
  }

  async getListHistory(
    userId: string,
    listId: string,
    range?: { from?: Date; to?: Date },
  ) {
    const { household } = await this.requireUserAndHousehold(userId);

    const list = await this.listsRepo.findOne({
      where: [
        { id: listId, household: { id: household.id }, owner: IsNull() },
        { id: listId, household: { id: household.id }, owner: { id: userId } },
      ],
    });
    if (!list) throw new NotFoundException('Lista no encontrada');

    const purchasedAtWhere =
      range?.from && range?.to
        ? Between(range.from, range.to)
        : range?.from
          ? MoreThanOrEqual(range.from)
          : range?.to
            ? LessThanOrEqual(range.to)
            : undefined;

    return this.itemsRepo.find({
      where: {
        list: { id: listId },
        purchased: true,
        ...(purchasedAtWhere ? { purchasedAt: purchasedAtWhere } : null),
      },
      relations: { purchasedBy: true },
      order: { purchasedAt: 'DESC' },
    });
  }

  private encodeHistoryCursor(input: {
    purchasedAt: Date;
    id: string;
  }): string {
    // Opaque cursor for stable pagination: purchasedAt (desc) + id (desc)
    const payload = {
      purchasedAt: input.purchasedAt.toISOString(),
      id: input.id,
    };

    // base64url: Node 16+ supports 'base64url'
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeHistoryCursor(
    cursor?: string,
  ): { purchasedAt: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw) as { purchasedAt?: string; id?: string };
      if (!parsed?.purchasedAt || !parsed?.id) return null;
      const purchasedAt = new Date(parsed.purchasedAt);
      if (Number.isNaN(purchasedAt.getTime())) return null;
      return { purchasedAt, id: parsed.id };
    } catch {
      return null;
    }
  }

  private encodePendingCursor(input: { createdAt: Date; id: string }): string {
    const payload = {
      createdAt: input.createdAt.toISOString(),
      id: input.id,
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodePendingCursor(
    cursor?: string,
  ): { createdAt: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw) as { createdAt?: string; id?: string };
      if (!parsed?.createdAt || !parsed?.id) return null;
      const createdAt = new Date(parsed.createdAt);
      if (Number.isNaN(createdAt.getTime())) return null;
      return { createdAt, id: parsed.id };
    } catch {
      return null;
    }
  }

  async getListPendingItemsPage(
    userId: string,
    listId: string,
    input?: { limit?: number; cursor?: string },
  ) {
    const { household } = await this.requireUserAndHousehold(userId);

    const list = await this.listsRepo.findOne({
      where: [
        { id: listId, household: { id: household.id }, owner: IsNull() },
        { id: listId, household: { id: household.id }, owner: { id: userId } },
      ],
    });
    if (!list) throw new NotFoundException('Lista no encontrada');

    const limit = Math.max(1, Math.min(100, input?.limit ?? 30));
    const decoded = this.decodePendingCursor(input?.cursor);

    const baseQb = this.itemsRepo
      .createQueryBuilder('item')
      .where('item.listId = :listId', { listId })
      .andWhere('item.purchased = false');

    // totals (count + sum)
    const total = await baseQb.clone().getCount();
    const rawSum = await baseQb
      .clone()
      .select('COALESCE(SUM(item.amount * item.price), 0)', 'totalAmount')
      .getRawOne<{ totalAmount: string }>();
    const totalAmount = Number.parseFloat(rawSum?.totalAmount ?? '0') || 0;

    if (decoded) {
      baseQb.andWhere(
        '(item.createdAt > :cursorAt OR (item.createdAt = :cursorAt AND item.id > :cursorId))',
        { cursorAt: decoded.createdAt, cursorId: decoded.id },
      );
    }

    const rows = await baseQb
      .orderBy('item.createdAt', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .take(limit + 1)
      .getMany();

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    const last = items.length ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && last?.createdAt
        ? this.encodePendingCursor({ createdAt: last.createdAt, id: last.id })
        : null;

    return { items, nextCursor, total, totalAmount };
  }

  async getListHistoryPage(
    userId: string,
    listId: string,
    input?: {
      from?: Date;
      to?: Date;
      limit?: number;
      cursor?: string;
    },
  ) {
    const { household } = await this.requireUserAndHousehold(userId);

    const list = await this.listsRepo.findOne({
      where: [
        { id: listId, household: { id: household.id }, owner: IsNull() },
        { id: listId, household: { id: household.id }, owner: { id: userId } },
      ],
    });
    if (!list) throw new NotFoundException('Lista no encontrada');

    const limit = Math.max(1, Math.min(100, input?.limit ?? 30));
    const decoded = this.decodeHistoryCursor(input?.cursor);

    const baseQb = this.itemsRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.purchasedBy', 'purchasedBy')
      .where('item.listId = :listId', { listId })
      .andWhere('item.purchased = true')
      // purchased history should have a timestamp; keep results stable.
      .andWhere('item.purchasedAt IS NOT NULL');

    if (input?.from) {
      baseQb.andWhere('item.purchasedAt >= :from', { from: input.from });
    }
    if (input?.to) {
      baseQb.andWhere('item.purchasedAt <= :to', { to: input.to });
    }

    const total = await baseQb.clone().getCount();

    if (decoded) {
      baseQb.andWhere(
        '(item.purchasedAt < :cursorAt OR (item.purchasedAt = :cursorAt AND item.id < :cursorId))',
        { cursorAt: decoded.purchasedAt, cursorId: decoded.id },
      );
    }

    const rows = await baseQb
      .orderBy('item.purchasedAt', 'DESC')
      .addOrderBy('item.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    const last = items.length ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && last?.purchasedAt
        ? this.encodeHistoryCursor({
            purchasedAt: last.purchasedAt,
            id: last.id,
          })
        : null;

    return { items, nextCursor, total };
  }

  async updateList(userId: string, listId: string, input: { name?: string }) {
    const list = await this.getListForWrite(userId, listId);
    if (typeof input.name === 'string') list.name = input.name;
    return this.listsRepo.save(list);
  }

  async deleteList(userId: string, listId: string) {
    const list = await this.getListForWrite(userId, listId);
    await this.listsRepo.remove(list);
    return { ok: true };
  }

  async addItem(
    userId: string,
    listId: string,
    input: { name: string; amount: number; price: number; category?: string },
  ) {
    const { user, household } = await this.requireUserAndHousehold(userId);
    const list = await this.getListForWrite(userId, listId);

    const item = this.itemsRepo.create({
      list,
      name: input.name,
      amount: input.amount,
      price: input.price,
      category: input.category ?? null,
      purchased: false,
    });

    const saved = await this.itemsRepo.save(item);

    // Notificar solo si la lista es compartida (owner null)
    if (!list.owner) {
      this.events.emit(HouseholdEvents.LIST_ITEM_ADDED, {
        actionType: 'list_item_added',
        householdId: household.id,
        listId: list.id,
        userId: user.id,
        userName: user.displayName,
        itemName: saved.name,
        excludeUserId: user.id,
      });
    }

    return saved;
  }

  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    input: {
      name?: string;
      amount?: number;
      price?: number;
      category?: string;
    },
  ) {
    await this.getList(userId, listId);

    const item = await this.itemsRepo.findOne({
      where: { id: itemId, list: { id: listId } },
    });
    if (!item) throw new NotFoundException('Elemento no encontrado');

    if (typeof input.name === 'string') item.name = input.name;
    if (typeof input.amount === 'number') item.amount = input.amount;
    if (typeof input.price === 'number') item.price = input.price;
    if (typeof input.category === 'string') item.category = input.category;

    return this.itemsRepo.save(item);
  }

  async deleteItem(userId: string, listId: string, itemId: string) {
    const { user, household } = await this.requireUserAndHousehold(userId);
    const list = await this.getListForWrite(userId, listId);

    const item = await this.itemsRepo.findOne({
      where: { id: itemId, list: { id: listId } },
    });
    if (!item) throw new NotFoundException('Elemento no encontrado');

    const itemName = item.name;

    await this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(ShoppingItemEntity);
      const expenseRepo = manager.getRepository(ExpenseEntity);

      const fresh = await itemRepo.findOne({ where: { id: itemId } });
      if (!fresh) return;

      if (fresh.purchased) {
        await expenseRepo.delete({
          sourceType: 'shopping_item',
          sourceId: fresh.id,
        });
      }

      await itemRepo.delete({ id: fresh.id });
    });

    // Notificar solo si la lista es compartida (owner null)
    if (!list.owner) {
      this.events.emit(HouseholdEvents.LIST_ITEM_DELETED, {
        actionType: 'list_item_deleted',
        householdId: household.id,
        listId: list.id,
        userId: user.id,
        userName: user.displayName,
        itemName,
        excludeUserId: user.id,
      });
    }

    return { ok: true };
  }

  async setPurchased(
    userId: string,
    listId: string,
    itemId: string,
    purchased: boolean,
  ) {
    const { user, household } = await this.requireUserAndHousehold(userId);
    const listForAccess = await this.getListForWrite(userId, listId);

    return this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(ShoppingItemEntity);
      const listRepo = manager.getRepository(ShoppingListEntity);

      const item = await itemRepo.findOne({
        where: { id: itemId, list: { id: listId } },
        relations: { list: true },
      });
      if (!item) throw new NotFoundException('Elemento no encontrado');

      const list = await listRepo.findOne({
        where: { id: listId },
        relations: { household: true },
      });
      if (!list || list.household.id !== household.id) {
        throw new ForbiddenException('La lista no pertenece al hogar');
      }

      const currency: string = this.config.getOrThrow('HOUSEHOLD_CURRENCY');

      if (purchased) {
        if (item.purchased) return item;

        item.purchased = true;
        item.purchasedAt = new Date();
        item.purchasedBy = user;
        await itemRepo.save(item);

        const totalAmount = Number((item.amount * item.price).toFixed(2));

        await this.expenses.createExpense(
          {
            household: list.household,
            payer: user,
            amount: totalAmount,
            currency,
            description: item.name,
            category: item.category ?? null,
            occurredAt: item.purchasedAt,
            sourceType: 'shopping_item',
            sourceId: item.id,
          },
          manager,
        );

        // Notificar solo si la lista es compartida (owner null)
        if (!listForAccess.owner) {
          this.events.emit(HouseholdEvents.LIST_ITEM_COMPLETED, {
            actionType: 'list_item_completed',
            householdId: household.id,
            listId: listForAccess.id,
            userId: user.id,
            userName: user.displayName,
            itemName: item.name,
            excludeUserId: user.id,
          });
        }

        return item;
      }

      if (!item.purchased) return item;

      item.purchased = false;
      item.purchasedAt = null;
      item.purchasedBy = null;
      await itemRepo.save(item);

      await this.expenses.deleteBySource('shopping_item', item.id, manager);

      return item;
    });
  }
}
