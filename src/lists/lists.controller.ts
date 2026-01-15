import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateItemDto } from './dto/create-item.dto';
import { CreateListDto } from './dto/create-list.dto';
import { ListHistoryQueryDto } from './dto/list-history.query.dto';
import { SetPurchasedDto } from './dto/set-purchased.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ListsService } from './lists.service';

@ApiTags('lists')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar listas del usuario' })
  list(@CurrentUser() user: CurrentUser) {
    return this.lists.listLists(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una lista' })
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateListDto) {
    return this.lists.createList(user.userId, dto);
  }

  @Get(':listId')
  @ApiOperation({ summary: 'Obtener una lista' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  get(@CurrentUser() user: CurrentUser, @Param('listId') listId: string) {
    return this.lists.getList(user.userId, listId);
  }

  @Get(':listId/items')
  @ApiOperation({ summary: 'Items pendientes (paginado) de la lista' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  pendingItems(
    @CurrentUser() user: CurrentUser,
    @Param('listId') listId: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limitNum = limitRaw ? Number(limitRaw) : undefined;
    return this.lists.getListPendingItemsPage(user.userId, listId, {
      limit: Number.isFinite(limitNum as number)
        ? (limitNum as number)
        : undefined,
      cursor,
    });
  }

  @Get(':listId/history')
  @ApiOperation({ summary: 'Historial de items comprados de la lista' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  history(
    @CurrentUser() user: CurrentUser,
    @Param('listId') listId: string,
    @Query() q: ListHistoryQueryDto,
  ) {
    return this.lists.getListHistoryPage(user.userId, listId, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      limit: q.limit,
      cursor: q.cursor,
    });
  }

  @Patch(':listId')
  @ApiOperation({ summary: 'Actualizar una lista' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  update(
    @CurrentUser() user: CurrentUser,
    @Param('listId') listId: string,
    @Body() dto: UpdateListDto,
  ) {
    return this.lists.updateList(user.userId, listId, dto);
  }

  @Delete(':listId')
  @ApiOperation({ summary: 'Eliminar una lista' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  remove(@CurrentUser() user: CurrentUser, @Param('listId') listId: string) {
    return this.lists.deleteList(user.userId, listId);
  }

  @Post(':listId/items')
  @ApiOperation({ summary: 'Agregar item a una lista' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  addItem(
    @CurrentUser() user: CurrentUser,
    @Param('listId') listId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.lists.addItem(user.userId, listId, dto);
  }

  @Patch(':listId/items/:itemId')
  @ApiOperation({ summary: 'Actualizar un item de una lista' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  @ApiParam({ name: 'itemId', description: 'ID del item' })
  updateItem(
    @CurrentUser() user: CurrentUser,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.lists.updateItem(user.userId, listId, itemId, dto);
  }

  @Delete(':listId/items/:itemId')
  @ApiOperation({ summary: 'Eliminar un item de una lista' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  @ApiParam({ name: 'itemId', description: 'ID del item' })
  deleteItem(
    @CurrentUser() user: CurrentUser,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.lists.deleteItem(user.userId, listId, itemId);
  }

  @Post(':listId/items/:itemId/purchase')
  @ApiOperation({ summary: 'Marcar item como comprado/no comprado' })
  @ApiParam({ name: 'listId', description: 'ID de la lista' })
  @ApiParam({ name: 'itemId', description: 'ID del item' })
  purchase(
    @CurrentUser() user: CurrentUser,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: SetPurchasedDto,
  ) {
    return this.lists.setPurchased(user.userId, listId, itemId, dto.purchased);
  }
}
