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
import { FirebaseAdminService } from './firebase-admin.service';
import { PushTokenEntity } from './push-token.entity';

export type NotifyHouseholdListEventResult = {
  excludeUserId: string;
  memberCount: number;
  notifiedUserIdsCount: number;
  tokensFoundCount: number;
  expoTokensCount: number;
  fcmTokensCount: number;
  firebaseConfigured: boolean;
  fcm?: {
    successCount: number;
    failureCount: number;
    invalidTokensCount: number;
    errorCodeCounts?: Record<string, number>;
    errorMessageSamples?: Record<string, string>;
  };
  shortCircuitReason?:
    | 'no_members'
    | 'no_tokens'
    | 'firebase_not_configured'
    | 'sent';
};

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
    private readonly firebase: FirebaseAdminService,
  ) {}

  async registerPushToken(
    userId: string,
    input: {
      token: string;
      tokenType?: 'expo' | 'fcm';
      deviceType: 'ios' | 'android' | 'web';
      deviceName?: string;
    },
  ): Promise<
    { success: true; tokenId: string } | { success: false; message: string }
  > {
    const token = String(input.token || '').trim();

    const inferredType: 'expo' | 'fcm' = Expo.isExpoPushToken(token)
      ? 'expo'
      : 'fcm';
    const tokenType: 'expo' | 'fcm' = input.tokenType ?? inferredType;

    // Validación ligera
    if (tokenType === 'expo' && !Expo.isExpoPushToken(token)) {
      return { success: false, message: 'Invalid Expo push token' };
    }
    if (tokenType === 'fcm') {
      // Los tokens FCM pueden variar, pero deben tener algo de longitud.
      if (token.length < 20) {
        return { success: false, message: 'Invalid FCM device token' };
      }
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) return { success: false, message: 'User not found' };

    const existing = await this.tokensRepo.findOne({ where: { token } });
    if (existing) {
      existing.user = user;
      existing.tokenType = tokenType;
      existing.deviceType = input.deviceType;
      existing.deviceName = input.deviceName ? String(input.deviceName) : null;
      const saved = await this.tokensRepo.save(existing);
      return { success: true, tokenId: saved.id };
    }

    const created = this.tokensRepo.create({
      user,
      token,
      tokenType,
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
  ): Promise<NotifyHouseholdListEventResult> {
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
    if (userIds.length === 0) {
      return {
        excludeUserId,
        memberCount: memberRows.length,
        notifiedUserIdsCount: 0,
        tokensFoundCount: 0,
        expoTokensCount: 0,
        fcmTokensCount: 0,
        firebaseConfigured: this.firebase.isConfigured(),
        shortCircuitReason: 'no_members',
      };
    }

    const tokens = await this.tokensRepo
      .createQueryBuilder('t')
      .select(['t.token', 't.tokenType'])
      .where('t.userId IN (:...userIds)', { userIds })
      .getMany();

    const firebaseConfigured = this.firebase.isConfigured();

    const expoTokens = tokens
      .filter((t) => t.tokenType === 'expo')
      .map((t) => t.token)
      .filter((t) => Expo.isExpoPushToken(t));

    const fcmTokens = tokens
      .filter((t) => t.tokenType === 'fcm')
      .map((t) => t.token)
      .filter(Boolean);

    if (expoTokens.length === 0 && fcmTokens.length === 0) {
      return {
        excludeUserId,
        memberCount: memberRows.length,
        notifiedUserIdsCount: userIds.length,
        tokensFoundCount: tokens.length,
        expoTokensCount: 0,
        fcmTokensCount: 0,
        firebaseConfigured,
        shortCircuitReason: 'no_tokens',
      };
    }

    const { title, body, data } =
      this.buildMessageFromHouseholdListEvent(payload);

    // 1) Expo (si hay)
    if (expoTokens.length > 0) {
      const messages: ExpoPushMessage[] = expoTokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data,
      }));
      await this.sendExpoPush(messages);
    }

    // 2) FCM (si hay y Firebase Admin está configurado)
    if (fcmTokens.length > 0) {
      if (!firebaseConfigured) {
        this.logger.warn(
          `Hay ${fcmTokens.length} tokens FCM registrados pero Firebase Admin no está configurado. ` +
            `Configura FIREBASE_SERVICE_ACCOUNT_BASE64/JSON para habilitar envío FCM.`,
        );
        return {
          excludeUserId,
          memberCount: memberRows.length,
          notifiedUserIdsCount: userIds.length,
          tokensFoundCount: tokens.length,
          expoTokensCount: expoTokens.length,
          fcmTokensCount: fcmTokens.length,
          firebaseConfigured,
          shortCircuitReason: 'firebase_not_configured',
        };
      }

      const res = await this.firebase.sendToFcmTokens({
        tokens: fcmTokens,
        title,
        body,
        data,
      });

      if (res.errorCodeCounts['app/invalid-credential']) {
        const detail =
          res.errorMessageSamples?.['app/invalid-credential'] ?? '';
        this.logger.error(
          `FCM falló con app/invalid-credential. Esto suele indicar credenciales inválidas/revocadas, reloj del servidor desfasado, ` +
            `o bloqueo de red hacia oauth2.googleapis.com. Revisa FIREBASE_SERVICE_ACCOUNT_* y conectividad. ` +
            (detail ? `Detalle: ${detail}` : ''),
        );
      }

      if (res.invalidTokens.length > 0) {
        this.logger.warn(
          `Eliminando ${res.invalidTokens.length} tokens FCM inválidos`,
        );
        await this.tokensRepo
          .createQueryBuilder()
          .delete()
          .from(PushTokenEntity)
          .where('token IN (:...tokens)', { tokens: res.invalidTokens })
          .execute();
      }

      return {
        excludeUserId,
        memberCount: memberRows.length,
        notifiedUserIdsCount: userIds.length,
        tokensFoundCount: tokens.length,
        expoTokensCount: expoTokens.length,
        fcmTokensCount: fcmTokens.length,
        firebaseConfigured,
        fcm: {
          successCount: res.successCount,
          failureCount: res.failureCount,
          invalidTokensCount: res.invalidTokens.length,
          errorCodeCounts: res.errorCodeCounts,
          errorMessageSamples: res.errorMessageSamples,
        },
        shortCircuitReason: 'sent',
      };
    }

    // Solo Expo
    return {
      excludeUserId,
      memberCount: memberRows.length,
      notifiedUserIdsCount: userIds.length,
      tokensFoundCount: tokens.length,
      expoTokensCount: expoTokens.length,
      fcmTokensCount: 0,
      firebaseConfigured,
      shortCircuitReason: 'sent',
    };
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
