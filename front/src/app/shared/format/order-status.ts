import { OrderTracking } from '../../core/api/generated/models/order-tracking';

export type OrderStatus = OrderTracking['status'];

/** The way of an order, in order; "Annulée" is not on it. */
export const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'NEW', label: 'Reçue' },
  { status: 'ACCEPTED', label: 'Acceptée' },
  { status: 'IN_PREPARATION', label: 'En préparation' },
  { status: 'READY', label: 'Prête' },
  { status: 'PICKED_UP', label: 'Récupérée' },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  ACCEPTED: 'Acceptée',
  IN_PREPARATION: 'En préparation',
  READY: 'Prête',
  PICKED_UP: 'Récupérée',
  CANCELLED: 'Annulée',
};

/** Its badge in the back-office: new to look at, in progress, done, cancelled. */
export function orderStatusBadge(status: OrderStatus): string {
  switch (status) {
    case 'NEW':
      return 'badge--featured';
    case 'PICKED_UP':
      return 'badge--published';
    case 'CANCELLED':
      return 'badge--draft';
    default:
      return 'badge--scheduled';
  }
}
