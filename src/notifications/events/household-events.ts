// File: src/notifications/events/household-events.ts
// Eventos de dominio relacionados al hogar (Household) para disparar notificaciones.

export const HouseholdEvents = {
  LIST_ITEM_ADDED: 'household.list.item_added',
  LIST_ITEM_COMPLETED: 'household.list.item_completed',
  LIST_ITEM_DELETED: 'household.list.item_deleted',
} as const;

export type HouseholdEventName =
  (typeof HouseholdEvents)[keyof typeof HouseholdEvents];

export type HouseholdListEventPayload = {
  actionType: 'list_item_added' | 'list_item_completed' | 'list_item_deleted';
  householdId: string;
  listId: string;
  userId: string;
  userName: string;
  itemName?: string;
  excludeUserId?: string;
};
