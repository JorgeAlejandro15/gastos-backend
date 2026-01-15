import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdsService } from '../households/households.service';
import { UsersService } from '../users/users.service';
import { CreateManualExpenseDto } from './dto/create-manual-expense.dto';
import { ExpensesSummaryQueryDto } from './dto/expenses-summary.query.dto';
import { ListExpensesQueryDto } from './dto/list-expenses.query.dto';
import { ExpenseEntity } from './expense.entity';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly households: HouseholdsService,
    private readonly users: UsersService,
    private readonly expenses: ExpensesService,
  ) {}

  private toDto(e: ExpenseEntity) {
    return {
      id: e.id,
      amount: e.amount,
      // Aliases: en la entidad, `amount` ya es el total del gasto.
      // Se expone también como `total`/`price` para evitar confusiones con
      // `amount` en items de compra (que suele ser cantidad).
      total: e.amount,
      price: e.amount,
      currency: e.currency,
      description: e.description,
      category: e.category ?? null,
      occurredAt: e.occurredAt,
      sourceType: e.sourceType,
      sourceId: e.sourceId ?? null,
      payer: e.payer
        ? {
            id: e.payer.id,
            email: e.payer.email,
            displayName: e.payer.displayName,
          }
        : null,
      createdAt: e.createdAt,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar gastos del hogar (con filtros)' })
  async list(
    @CurrentUser() user: CurrentUser,
    @Query() q: ListExpensesQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const { items, total } = await this.expenses.listExpensesForHousehold(
      household.id,
      {
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        payerId: q.payerId,
        category: q.category,
        sourceType: q.sourceType,
        offset: q.offset,
        limit: q.limit,
        order: q.order,
      },
    );

    return {
      total,
      items: items.map((e) => this.toDto(e)),
    };
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen del hogar (total de gastos) — basado en DB',
  })
  async summary(
    @CurrentUser() user: CurrentUser,
    @Query() q: ExpensesSummaryQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const total = await this.expenses.sumExpensesForHousehold(household.id, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      payerId: q.payerId,
      category: q.category,
      sourceType: q.sourceType,
    });

    return {
      total,
      currency: household.currency,
    };
  }

  @Get('summary/shared')
  @ApiOperation({
    summary:
      'Resumen de la lista compartida (total de gastos) — solo items de compras (owner=null)',
  })
  async sharedSummary(
    @CurrentUser() user: CurrentUser,
    @Query() q: ExpensesSummaryQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const total: number = await this.expenses.sumShoppingExpensesByListOwner(
      household.id,
      null,
      {
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        payerId: q.payerId,
        category: q.category,
      },
    );

    return {
      total,
      currency: household.currency,
    };
  }

  @Get('summary/personal')
  @ApiOperation({
    summary:
      'Resumen de listas personales (total de compras) — shopping items donde owner=userId',
  })
  async personalSummary(
    @CurrentUser() user: CurrentUser,
    @Query() q: ExpensesSummaryQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const total: number = await this.expenses.sumShoppingExpensesByListOwner(
      household.id,
      user.userId,
      {
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        payerId: q.payerId,
        category: q.category,
      },
    );

    return {
      total,
      currency: household.currency,
    };
  }

  @Get('summary/mine')
  @ApiOperation({
    summary:
      'Resumen de lo que yo pagué (total) — todos los gastos del hogar con payerId=userId',
  })
  async myPaidSummary(
    @CurrentUser() user: CurrentUser,
    @Query() q: ExpensesSummaryQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const total = await this.expenses.sumExpensesForHousehold(household.id, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      payerId: user.userId,
      category: q.category,
      sourceType: q.sourceType,
    });

    return {
      total,
      currency: household.currency,
    };
  }

  @Get('history/shared')
  @ApiOperation({
    summary: 'Historial de gastos de la lista compartida del hogar',
  })
  async sharedHistory(
    @CurrentUser() user: CurrentUser,
    @Query() q: ListExpensesQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const { items, total } =
      await this.expenses.listShoppingExpensesByListOwner(household.id, null, {
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        payerId: q.payerId,
        category: q.category,
        offset: q.offset,
        limit: q.limit,
        order: q.order,
      });

    return { total, items: items.map((e) => this.toDto(e)) };
  }

  @Get('history/personal')
  @ApiOperation({
    summary: 'Historial de gastos de la lista personal del usuario',
  })
  async personalHistory(
    @CurrentUser() user: CurrentUser,
    @Query() q: ListExpensesQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const { items, total } =
      await this.expenses.listShoppingExpensesByListOwner(
        household.id,
        user.userId,
        {
          from: q.from ? new Date(q.from) : undefined,
          to: q.to ? new Date(q.to) : undefined,
          payerId: q.payerId,
          category: q.category,
          offset: q.offset,
          limit: q.limit,
          order: q.order,
        },
      );

    return { total, items: items.map((e) => this.toDto(e)) };
  }

  @Get(':expenseId')
  @ApiOperation({ summary: 'Obtener un gasto por ID' })
  @ApiParam({ name: 'expenseId', description: 'ID del gasto' })
  async get(
    @CurrentUser() user: CurrentUser,
    @Param('expenseId') expenseId: string,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const expense = await this.expenses.getExpenseForHousehold(
      household.id,
      expenseId,
    );
    if (!expense) throw new NotFoundException('Gasto no encontrado');

    return this.toDto(expense);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un gasto manual' })
  async createManual(
    @CurrentUser() user: CurrentUser,
    @Body() dto: CreateManualExpenseDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const payerId = dto.payerId ?? user.userId;
    const inHouse = await this.households.isUserInHousehold(
      household.id,
      payerId,
    );
    if (!inHouse) {
      throw new BadRequestException('El pagador no es miembro del hogar');
    }

    const payer = await this.users.findById(payerId);
    if (!payer) throw new BadRequestException('El pagador no existe');

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    const expense = await this.expenses.createExpense({
      household,
      payer,
      amount: dto.amount,
      currency: household.currency,
      description: dto.description,
      category: dto.category ?? null,
      occurredAt,
      sourceType: 'manual',
      sourceId: null,
    });

    const full = await this.expenses.getExpenseForHousehold(
      household.id,
      expense.id,
    );
    return this.toDto(full ?? expense);
  }

  @Delete(':expenseId')
  @ApiOperation({ summary: 'Eliminar un gasto manual' })
  @ApiParam({ name: 'expenseId', description: 'ID del gasto' })
  async delete(
    @CurrentUser() user: CurrentUser,
    @Param('expenseId') expenseId: string,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household)
      throw new ForbiddenException('No tiene hogar asociado a este usuario');

    const result = await this.expenses.deleteManualExpenseForHousehold(
      household.id,
      expenseId,
    );

    if (!result.deleted && result.reason === 'not_found') {
      throw new NotFoundException('Gasto no encontrado');
    }
    if (!result.deleted && result.reason === 'not_manual') {
      throw new BadRequestException(
        'Solo se pueden eliminar gastos manuales. Si proviene de un ítem de compras, desmarque el ítem en lugar de eliminarlo.',
      );
    }

    return { ok: true };
  }
}
