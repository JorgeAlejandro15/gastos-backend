// File: src/notifications/notifications.controller.ts

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type CurrentUser as CurrentUserType,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdsService } from '../households/households.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { SendHouseholdNotificationDto } from './dto/send-household-notification.dto';
import type { HouseholdListEventPayload } from './events/household-events';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly households: HouseholdsService,
  ) {}

  @Post('register-token')
  async registerToken(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notifications.registerPushToken(user.userId, dto);
  }

  @Delete('token/:token')
  async removeToken(
    @CurrentUser() user: CurrentUserType,
    @Param('token') token: string,
  ) {
    return this.notifications.removePushToken(user.userId, token);
  }

  /**
   * Endpoint de apoyo (QA/dev): enviar una notificación al hogar actual.
   * En producción, lo normal es que el backend envíe notificaciones automáticamente
   * al ocurrir eventos (ej: cambios en lista compartida).
   */
  @Post('send')
  async sendToHousehold(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: SendHouseholdNotificationDto,
  ) {
    const myHousehold = await this.households.getHouseholdForUser(user.userId);
    if (!myHousehold || myHousehold.id !== dto.householdId) {
      throw new ForbiddenException('Not a member of this household');
    }

    const actionTypeValue = dto.data?.['actionType'];
    const actionType: HouseholdListEventPayload['actionType'] =
      actionTypeValue === 'list_item_added' ||
      actionTypeValue === 'list_item_completed' ||
      actionTypeValue === 'list_item_deleted'
        ? actionTypeValue
        : 'list_item_added';

    const listIdValue = dto.data?.['listId'];
    const listId =
      typeof listIdValue === 'string'
        ? listIdValue
        : typeof listIdValue === 'number'
          ? String(listIdValue)
          : '';

    const userNameValue = dto.data?.['userName'];
    const userName = typeof userNameValue === 'string' ? userNameValue : '';

    const itemNameValue = dto.data?.['itemName'];
    const itemName =
      typeof itemNameValue === 'string' ? itemNameValue : undefined;

    // Para QA/dev: por defecto NO excluimos al usuario actual.
    // La columna userId es UUID, así que necesitamos un UUID válido si queremos "no excluir a nadie".
    // Usamos NIL UUID.
    const excludeUserId =
      dto.excludeUserId ?? '00000000-0000-0000-0000-000000000000';

    const result = await this.notifications.notifyHouseholdListEvent({
      actionType,
      householdId: dto.householdId,
      listId,
      userId: user.userId,
      userName,
      itemName,
      excludeUserId,
    });
    return { ok: true, result };
  }
}
