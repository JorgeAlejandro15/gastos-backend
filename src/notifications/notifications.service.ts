// File: src/notifications/notifications.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from 'expo-server-sdk';
import { Repository } from 'typeorm';
import { HouseholdMemberEntity } from '../households/household-member.entity';
import { UserEntity } from '../users/user.entity';
import { HouseholdListEventPayload } from './events/household-events';
import { PushTokenEntity } from './push-token.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(
    @InjectRepository(PushTokenEntity)
    private readonly tokensRepo: Repository<PushTokenEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(HouseholdMemberEntity)
    private readonly membersRepo: Repository<HouseholdMemberEntity>,
  ) {}

  async registerPushToken(
    userId: string,
    input: {
      token: string;
      deviceType: 'ios' | 'android' | 'web';
      deviceName?: string;
    },
  ): Promise<
    { success: true; tokenId: string } | { success: false; message: string }
  > {
    const token = String(input.token || '').trim();
    if (!Expo.isExpoPushToken(token)) {
      return { success: false, message: 'Invalid Expo push token' };
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) return { success: false, message: 'User not found' };

    const existing = await this.tokensRepo.findOne({ where: { token } });
    if (existing) {
      existing.user = user;
      existing.deviceType = input.deviceType;
      existing.deviceName = input.deviceName ? String(input.deviceName) : null;
      const saved = await this.tokensRepo.save(existing);
      return { success: true, tokenId: saved.id };
    }

    const created = this.tokensRepo.create({
      user,
      token,
      deviceType: input.deviceType,
      deviceName: input.deviceName ? String(input.deviceName) : null,
    });

    const saved = await this.tokensRepo.save(created);
    return { success: true, tokenId: saved.id };
  }

  async removePushToken(userId: string, token: string): Promise<{ ok: true }> {
    await this.tokensRepo
      .createQueryBuilder()
      .delete()
      .from(PushTokenEntity)
      .where('token = :token', { token })
      .andWhere('userId = :userId', { userId })
      .execute();

    return { ok: true };
  }

  /**
   * Envía una notificación push a todos los miembros del hogar excepto excludeUserId.
   * Se usa para eventos reales (ej: cambios en lista compartida).
   */
  async notifyHouseholdListEvent(
    payload: HouseholdListEventPayload,
  ): Promise<void> {
    const excludeUserId = payload.excludeUserId ?? payload.userId;

    const memberRows = await this.membersRepo
      .createQueryBuilder('m')
      .select('m.userId', 'userId')
      .where('m.householdId = :householdId', {
        householdId: payload.householdId,
      })
      .andWhere('m.userId != :excludeUserId', { excludeUserId })
      .getRawMany<{ userId: string }>();

    const userIds = memberRows.map((r) => r.userId).filter(Boolean);
    if (userIds.length === 0) return;

    const tokens = await this.tokensRepo
      .createQueryBuilder('t')
      .select(['t.token'])
      .where('t.userId IN (:...userIds)', { userIds })
      .getMany();

    const expoTokens = tokens
      .map((t) => t.token)
      .filter((t) => Expo.isExpoPushToken(t));

    if (expoTokens.length === 0) return;

    const { title, body, data } =
      this.buildMessageFromHouseholdListEvent(payload);

    const messages: ExpoPushMessage[] = expoTokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
    }));

    await this.sendExpoPush(messages);
  }

  buildMessageFromHouseholdListEvent(payload: HouseholdListEventPayload): {
    title: string;
    body: string;
    data: Record<string, any>;
  } {
    const who = payload.userName || 'Alguien';
    const item = payload.itemName ? `"${payload.itemName}"` : 'un ítem';

    let body = `${who} hizo un cambio en la lista`;

    switch (payload.actionType) {
      case 'list_item_added':
        body = `${who} añadió ${item}`;
        break;
      case 'list_item_completed':
        body = `${who} marcó ${item} como comprado`;
        break;
      case 'list_item_deleted':
        body = `${who} eliminó ${item}`;
        break;
      default:
        break;
    }

    return {
      title: 'Actividad en lista compartida',
      body,
      data: {
        actionType: payload.actionType,
        householdId: payload.householdId,
        listId: payload.listId,
        userId: payload.userId,
        userName: payload.userName,
        itemName: payload.itemName,
      },
    };
  }

  private async sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] =
          await this.expo.sendPushNotificationsAsync(chunk);

        const errors = tickets
          .filter((t) => t.status === 'error')
          .map((t) => t.details?.error)
          .filter((e): e is NonNullable<typeof e> => e !== undefined);

        if (errors.length) {
          this.logger.warn(
            `Expo push ticket errors: ${JSON.stringify(errors)}`,
          );
        }
      } catch (err) {
        this.logger.error(
          'Error sending Expo push notifications',
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
