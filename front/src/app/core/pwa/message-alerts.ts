import { Injectable } from '@angular/core';
import { disableMessageAlert } from '../api/generated/fn/admin-message-alerts/disable-message-alert';
import { enableMessageAlert } from '../api/generated/fn/admin-message-alerts/enable-message-alert';
import { getMessageAlert } from '../api/generated/fn/admin-message-alerts/get-message-alert';
import { PushSubscriptionForm } from '../api/generated/models/push-subscription-form';
import { DeviceAlerts } from './device-alerts';

/**
 * The messages of the other admins in a notification on this device (2.13), the installed app's
 * especially: the ones not read within a few seconds, for the admin signed in (MessagePush).
 */
@Injectable({ providedIn: 'root' })
export class MessageAlerts extends DeviceAlerts {
  protected readonly turnedOn = 'Cet appareil sera prévenu des messages que vous n’avez pas encore lus';
  protected readonly turnedOff = 'Cet appareil ne sera plus prévenu des messages';

  protected async read(endpoint: string): Promise<boolean> {
    return (await this.api.invoke(getMessageAlert, { endpoint })).enabled;
  }

  protected turnOn(subscription: PushSubscriptionForm): Promise<unknown> {
    return this.api.invoke(enableMessageAlert, { body: subscription });
  }

  protected turnOff(endpoint: string): Promise<unknown> {
    return this.api.invoke(disableMessageAlert, { endpoint });
  }
}
