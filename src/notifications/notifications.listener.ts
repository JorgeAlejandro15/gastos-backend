// File: src/notifications/notifications.listener.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  HouseholdEvents,
  HouseholdListEventPayload,
} from './events/household-events';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(HouseholdEvents.LIST_ITEM_ADDED)
  async onListItemAdded(payload: HouseholdListEventPayload) {
    try {
      await this.notifications.notifyHouseholdListEvent(payload);
    } catch (err) {
      console.error(
        '[NotificationsListener] Error en notifyHouseholdListEvent (LIST_ITEM_ADDED):',
        err,
      );
    }
  }

  @OnEvent(HouseholdEvents.LIST_ITEM_COMPLETED)
  async onListItemCompleted(payload: HouseholdListEventPayload) {
    try {
      await this.notifications.notifyHouseholdListEvent(payload);
    } catch (err) {
      console.error(
        '[NotificationsListener] Error en notifyHouseholdListEvent (LIST_ITEM_COMPLETED):',
        err,
      );
    }
  }

  @OnEvent(HouseholdEvents.LIST_ITEM_DELETED)
  async onListItemDeleted(payload: HouseholdListEventPayload) {
    try {
      await this.notifications.notifyHouseholdListEvent(payload);
    } catch (err) {
      console.error(
        '[NotificationsListener] Error en notifyHouseholdListEvent (LIST_ITEM_DELETED):',
        err,
      );
    }
  }
}
