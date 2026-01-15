import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpensesService } from '../expenses/expenses.service';
import { HouseholdsService } from '../households/households.service';
import { IncomesService } from '../incomes/incomes.service';
import { DateRangeQueryDto } from './dto/date-range.query.dto';

@ApiTags('reports')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly households: HouseholdsService,
    private readonly expenses: ExpensesService,
    private readonly incomes: IncomesService,
  ) {}

  @Get('expenses/by-payer')
  @ApiOperation({ summary: 'Reporte: total de gastos por pagador' })
  async expensesByPayer(
    @CurrentUser() user: CurrentUser,
    @Query() q: DateRangeQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const rows = await this.expenses.reportTotalByPayer(household.id, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });

    return {
      householdId: household.id,
      from: q.from ?? null,
      to: q.to ?? null,
      items: rows,
    };
  }

  @Get('expenses/by-category')
  @ApiOperation({ summary: 'Reporte: total de gastos por categoría' })
  async expensesByCategory(
    @CurrentUser() user: CurrentUser,
    @Query() q: DateRangeQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const rows = await this.expenses.reportTotalByCategory(household.id, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });

    return {
      householdId: household.id,
      from: q.from ?? null,
      to: q.to ?? null,
      items: rows,
    };
  }

  @Get('balance')
  @ApiOperation({
    summary: 'Balance personal: ingresos - gastos (por rango de fechas)',
  })
  async balance(
    @CurrentUser() user: CurrentUser,
    @Query() q: DateRangeQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;

    const [totalIncome, totalExpense] = await Promise.all([
      this.incomes.sumIncomesForUser(user.userId, { from, to }),
      this.expenses.sumExpensesForUser(household.id, user.userId, { from, to }),
    ]);

    return {
      userId: user.userId,
      householdId: household.id,
      currency: household.currency,
      from: q.from ?? null,
      to: q.to ?? null,
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense,
    };
  }
}
