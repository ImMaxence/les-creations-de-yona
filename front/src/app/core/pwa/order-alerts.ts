import { Injectable } from '@angular/core';
import { disableOrderAlert } from '../api/generated/fn/admin-order-alerts/disable-order-alert';
import { enableOrderAlert } from '../api/generated/fn/admin-order-alerts/enable-order-alert';
import { getOrderAlert } from '../api/generated/fn/admin-order-alerts/get-order-alert';
import { PushSubscriptionForm } from '../api/generated/models/push-subscription-form';
import { DeviceAlerts } from './device-alerts';

/** "Alerte des nouvelles commandes" on this device of an admin. */
@Injectable({ providedIn: 'root' })
export class OrderAlerts extends DeviceAlerts {
  protected readonly turnedOn = 'Cet appareil sera prévenu de chaque nouvelle commande';
  protected readonly turnedOff = 'Cet appareil ne sera plus prévenu des commandes';

  protected async read(endpoint: string): Promise<boolean> {
    return (await this.api.invoke(getOrderAlert, { endpoint })).enabled;
  }

  protected turnOn(subscription: PushSubscriptionForm): Promise<unknown> {
    return this.api.invoke(enableOrderAlert, { body: subscription });
  }

  protected turnOff(endpoint: string): Promise<unknown> {
    return this.api.invoke(disableOrderAlert, { endpoint });
  }
}
