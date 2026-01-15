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
    await this.notifications.notifyHouseholdListEvent(payload);
  }

  @OnEvent(HouseholdEvents.LIST_ITEM_COMPLETED)
  async onListItemCompleted(payload: HouseholdListEventPayload) {
    await this.notifications.notifyHouseholdListEvent(payload);
  }

  @OnEvent(HouseholdEvents.LIST_ITEM_DELETED)
  async onListItemDeleted(payload: HouseholdListEventPayload) {
    await this.notifications.notifyHouseholdListEvent(payload);
  }
}
