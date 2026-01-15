import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
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
import { CreateIncomeDto } from './dto/create-income.dto';
import { IncomesSummaryQueryDto } from './dto/incomes-summary.query.dto';
import { ListIncomesQueryDto } from './dto/list-incomes.query.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { IncomeEntity } from './income.entity';
import { IncomesService } from './incomes.service';

@ApiTags('incomes')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('incomes')
export class IncomesController {
  constructor(
    private readonly households: HouseholdsService,
    private readonly incomes: IncomesService,
  ) {}

  private toDto(i: IncomeEntity) {
    return {
      id: i.id,
      amount: i.amount,
      currency: i.currency,
      description: i.description,
      category: i.category ?? null,
      source: i.source,
      occurredAt: i.occurredAt,
      createdAt: i.createdAt,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar ingresos del usuario (personales)' })
  async list(
    @CurrentUser() user: CurrentUser,
    @Query() q: ListIncomesQueryDto,
  ) {
    // Enforce that user belongs to a household (keeps it consistent with the rest of the app)
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const { items, total } = await this.incomes.listIncomesForUser(
      user.userId,
      {
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        source: q.source,
        category: q.category,
        offset: q.offset,
        limit: q.limit,
        order: q.order,
      },
    );

    return { total, items: items.map((i) => this.toDto(i)) };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen (suma) de ingresos del usuario' })
  async summary(
    @CurrentUser() user: CurrentUser,
    @Query() q: IncomesSummaryQueryDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const total = await this.incomes.sumIncomesForUser(user.userId, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      source: q.source,
      category: q.category,
    });

    return { total, currency: household.currency };
  }

  @Get(':incomeId')
  @ApiOperation({ summary: 'Obtener un ingreso por ID (solo dueño)' })
  @ApiParam({ name: 'incomeId', description: 'ID del ingreso' })
  async get(
    @CurrentUser() user: CurrentUser,
    @Param('incomeId') incomeId: string,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const income = await this.incomes.getIncomeForUser(user.userId, incomeId);
    if (!income) throw new NotFoundException('Ingreso no encontrado');

    return this.toDto(income);
  }

  @Patch(':incomeId')
  @ApiOperation({ summary: 'Editar un ingreso (solo dueño)' })
  @ApiParam({ name: 'incomeId', description: 'ID del ingreso' })
  async update(
    @CurrentUser() user: CurrentUser,
    @Param('incomeId') incomeId: string,
    @Body() dto: UpdateIncomeDto,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const updated = await this.incomes.updateIncomeForUser(
      user.userId,
      incomeId,
      {
        amount: dto.amount,
        description: dto.description,
        category:
          dto.category !== undefined
            ? dto.category
              ? dto.category
              : null
            : undefined,
        source: dto.source,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    );

    if (!updated) throw new NotFoundException('Ingreso no encontrado');

    return this.toDto(updated);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un ingreso (personal)' })
  async create(@CurrentUser() user: CurrentUser, @Body() dto: CreateIncomeDto) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    const income = await this.incomes.createIncome({
      ownerId: user.userId,
      amount: dto.amount,
      currency: household.currency,
      description: dto.description,
      category: dto.category ?? null,
      source: dto.source,
      occurredAt,
    });

    return this.toDto(income);
  }

  @Delete(':incomeId')
  @ApiOperation({ summary: 'Eliminar un ingreso (solo dueño)' })
  @ApiParam({ name: 'incomeId', description: 'ID del ingreso' })
  async remove(
    @CurrentUser() user: CurrentUser,
    @Param('incomeId') incomeId: string,
  ) {
    const household = await this.households.getHouseholdForUser(user.userId);
    if (!household) throw new ForbiddenException('No tiene hogar asociado');

    const result = await this.incomes.deleteIncomeForUser(
      user.userId,
      incomeId,
    );
    if (!result.deleted && result.reason === 'not_found') {
      throw new NotFoundException('Ingreso no encontrado');
    }

    return { ok: true };
  }
}
