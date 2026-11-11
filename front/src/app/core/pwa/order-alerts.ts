import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { attempt } from '../api/attempt';
import { Api } from '../api/generated/api';
import { disableOrderAlert } from '../api/generated/fn/admin-order-alerts/disable-order-alert';
import { enableOrderAlert } from '../api/generated/fn/admin-order-alerts/enable-order-alert';
import { getOrderAlert } from '../api/generated/fn/admin-order-alerts/get-order-alert';
import { getPushPublicKey } from '../api/generated/fn/notifications/get-push-public-key';
import { Toaster } from '../notifications/toaster';
import { NotificationsState, askPermission, isAppleMobile, isStandalone, subscriptionForm } from './new-recipe-notifications';
import { ServiceWorkerGate } from './service-worker-gate';

/**
 * "Alerte des nouvelles commandes" on this device of an admin. Same Web Push subscription as
 * the visitors' notifications, a device having only one: the backend says what it receives, so that
 * turning this off leaves the notifications of new recipes alone.
 */
@Injectable({ providedIn: 'root' })
export class OrderAlerts {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);
  private readonly serviceWorker = inject(ServiceWorkerGate);

  readonly state = signal<NotificationsState>('unknown');
  readonly busy = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    afterNextRender(() => {
      if (!this.swPush.isEnabled || !('PushManager' in window) || !('Notification' in window)) {
        this.state.set(isAppleMobile() && !isStandalone() ? 'install-first' : 'unsupported');
        return;
      }
      void this.readState();
    });
  }

  private async readState(): Promise<void> {
    // A browser tab without the app nor notifications has no service worker (ServiceWorkerGate): nothing to read
    if (!(await this.serviceWorker.kept())) {
      this.state.set(Notification.permission === 'denied' ? 'blocked' : 'off');
      return;
    }
    const subscription = await firstValueFrom(this.swPush.subscription);
    if (!subscription) {
      this.state.set(Notification.permission === 'denied' ? 'blocked' : 'off');
      return;
    }
    const status = await attempt(this.api.invoke(getOrderAlert, { endpoint: subscription.endpoint }));
    this.state.set(status.ok && status.value.enabled ? 'on' : 'off');
  }

  async enable(): Promise<void> {
    this.busy.set(true);
    try {
      // Asked on the tap itself, before the service worker that can take a few seconds (see NewRecipeNotifications)
      await askPermission();
      await this.serviceWorker.register();
      const { publicKey } = await this.api.invoke(getPushPublicKey);
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      await this.api.invoke(enableOrderAlert, { body: subscriptionForm(subscription) });
      this.state.set('on');
      this.toaster.success('Cet appareil sera prévenu de chaque nouvelle commande');
    } catch {
      if (Notification.permission === 'denied') {
        this.state.set('blocked');
        this.toaster.error('Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur');
      } else {
        this.toaster.error("Impossible d'activer les notifications sur cet appareil pour le moment");
      }
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    this.busy.set(true);
    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      if (subscription) {
        await this.api.invoke(disableOrderAlert, { endpoint: subscription.endpoint });
      }
      this.state.set('off');
      this.toaster.success('Cet appareil ne sera plus prévenu des commandes');
    } catch {
      this.toaster.error('Impossible de désactiver les notifications pour le moment');
    } finally {
      this.busy.set(false);
    }
  }
}
