import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { Api } from '../api/generated/api';
import { getPushPublicKey } from '../api/generated/fn/notifications/get-push-public-key';
import { PushSubscriptionForm } from '../api/generated/models/push-subscription-form';
import { Toaster } from '../notifications/toaster';
import { NotificationsState, askPermission, isAppleMobile, isStandalone, subscriptionForm } from './new-recipe-notifications';
import { ServiceWorkerGate } from './service-worker-gate';

/**
 * An alert of the back-office on this device (new orders, messages): the same Web Push subscription as
 * the visitors' notifications, a device having only one; the backend says what it receives, so that
 * turning one alert off leaves the others alone. Each alert says how to read, turn on and off its own.
 */
export abstract class DeviceAlerts {
  protected readonly api = inject(Api);
  private readonly swPush = inject(SwPush);
  private readonly toaster = inject(Toaster);
  private readonly serviceWorker = inject(ServiceWorkerGate);

  readonly state = signal<NotificationsState>('unknown');
  readonly busy = signal(false);

  /** The toasts once turned on and off. */
  protected abstract readonly turnedOn: string;
  protected abstract readonly turnedOff: string;

  /** Whether this device receives it now. */
  protected abstract read(endpoint: string): Promise<boolean>;
  protected abstract turnOn(subscription: PushSubscriptionForm): Promise<unknown>;
  protected abstract turnOff(endpoint: string): Promise<unknown>;

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
    const enabled = await this.read(subscription.endpoint).catch(() => false);
    this.state.set(enabled ? 'on' : 'off');
  }

  async enable(): Promise<void> {
    this.busy.set(true);
    try {
      // Asked on the tap itself, before the service worker that can take a few seconds (see NewRecipeNotifications)
      await askPermission();
      await this.serviceWorker.register();
      const { publicKey } = await this.api.invoke(getPushPublicKey);
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      await this.turnOn(subscriptionForm(subscription));
      this.state.set('on');
      this.toaster.success(this.turnedOn);
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
        await this.turnOff(subscription.endpoint);
      }
      this.state.set('off');
      this.toaster.success(this.turnedOff);
    } catch {
      this.toaster.error('Impossible de désactiver les notifications pour le moment');
    } finally {
      this.busy.set(false);
    }
  }
}
